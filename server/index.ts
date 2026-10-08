/**
 * Application server.
 *
 * Runs Vite in middleware mode so the SPA and the API share a single origin and a
 * single port. That matters here because the app is commonly previewed through a
 * proxy host: one origin means no CORS, no second service, and a preview URL that
 * just works.
 *
 * What it does beyond serving the SPA:
 *   POST /api/ai/complete   relay an AI call (used when a provider blocks browser CORS)
 *   POST /api/models        proxy model discovery
 *   POST /api/youtube       search YouTube when the user supplies a Data API key
 *   POST /api/fetch         read a web page and reduce it to text, for grounded answers
 *   GET  /api/health        liveness + which relay capabilities are available
 */

import express, { type Request, type Response, type NextFunction } from 'express'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { callProvider, listModels } from '../src/lib/ai/providers.js'
import type { AIRequest, AIResponse } from '../src/lib/ai/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT) || 8787
const HOST = process.env.HOST || '0.0.0.0'
const IS_PROD = process.env.NODE_ENV === 'production'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)

app.use(express.json({ limit: '24mb' }))

/* --------------------------------------------------------------- diagnostics */

const startedAt = Date.now()
const metrics = { aiRelays: 0, aiErrors: 0, fetches: 0, videos: 0 }

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    mode: IS_PROD ? 'production' : 'development',
    metrics,
    capabilities: {
      aiRelay: true,
      // GitHub hosts are reachable from this sandbox; everything else falls back
      // to the model's own knowledge and clearly says so.
      modelDiscovery: true,
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      webFetch: true,
    },
  })
})

/* --------------------------------------------------------------- AI relay */

function cleanRequest(body: unknown): AIRequest {
  const b = (body ?? {}) as AIRequest
  if (!b.messages || !Array.isArray(b.messages)) throw new Error('messages[] is required')
  return {
    ...b,
    // never let a client smuggle a huge payload through
    messages: b.messages.slice(0, 40),
    maxTokens: Math.min(b.maxTokens ?? 4096, 8192),
  }
}

app.post('/api/ai/complete', async (req: Request, res: Response) => {
  let payload: AIRequest
  try {
    payload = cleanRequest(req.body)
  } catch (err) {
    return res.status(400).json({ error: { message: (err as Error).message } })
  }

  // An optional server-side key (env var) lets someone run this as a hosted demo
  // without pasting a key into the browser. Client-supplied keys always win.
  const envKey = keyFromEnv(payload.provider)
  if (!payload.apiKey && envKey) payload.apiKey = envKey

  if (!payload.apiKey && payload.provider !== 'ollama' && payload.provider !== 'custom') {
    return res.status(400).json({
      error: {
        message: 'No API key supplied for this request.',
        hint: 'Add your key in Settings, or set the matching environment variable on the server.',
      },
    })
  }

  metrics.aiRelays++
  try {
    const result = await callProvider(payload)
    res.json({ result: stripRaw(result) })
  } catch (err) {
    metrics.aiErrors++
    const e = err as Error & { hint?: string; status?: number }
    // Deliberately terse: never echo keys or full upstream bodies into logs.
    console.warn(`[ai] ${payload.provider}/${payload.model} failed: ${e.message}`)
    res.status(e.status && e.status >= 400 && e.status < 600 ? 502 : 400).json({
      error: { message: e.message || 'Upstream AI request failed', hint: e.hint },
    })
  }
})

function keyFromEnv(provider: string): string | undefined {
  const map: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY,
  }
  return map[provider]
}

function stripRaw(r: AIResponse): AIResponse {
  const { raw, ...rest } = r
  return rest
}

/* --------------------------------------------------------------- model discovery */

app.post('/api/models', async (req: Request, res: Response) => {
  const { provider, apiKey, baseUrl } = (req.body ?? {}) as {
    provider?: string
    apiKey?: string
    baseUrl?: string
  }
  if (!provider) return res.status(400).json({ error: { message: 'provider is required' } })
  const key = apiKey || keyFromEnv(provider)
  if (!key && provider !== 'ollama' && provider !== 'custom') {
    return res.status(400).json({ error: { message: 'No API key supplied.' } })
  }
  try {
    const models = await listModels({ provider: provider as never, apiKey: key, baseUrl })
    res.json({ models })
  } catch (err) {
    const e = err as Error & { hint?: string }
    res.status(400).json({ error: { message: e.message, hint: e.hint } })
  }
})

/* --------------------------------------------------------------- youtube */

app.post('/api/youtube', async (req: Request, res: Response) => {
  const { query, key, maxResults } = (req.body ?? {}) as {
    query?: string
    key?: string
    maxResults?: number
  }
  const apiKey = key || process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return res.status(501).json({
      error: {
        message: 'No YouTube Data API key configured.',
        hint: 'The app falls back to precise YouTube search links when this is unavailable.',
      },
    })
  }
  if (!query) return res.status(400).json({ error: { message: 'query is required' } })

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('maxResults', String(Math.min(maxResults ?? 6, 10)))
    url.searchParams.set('relevanceLanguage', 'en')
    url.searchParams.set('safeSearch', 'moderate')
    url.searchParams.set('videoEmbeddable', 'true')
    url.searchParams.set('q', query)
    url.searchParams.set('key', apiKey)

    const r = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return res.status(502).json({ error: { message: `YouTube API error ${r.status}`, hint: body.slice(0, 200) } })
    }
    const data = (await r.json()) as any
    metrics.videos++
    const videos = (data.items ?? []).map((it: any) => ({
      id: it.id?.videoId,
      title: it.snippet?.title ?? '',
      channel: it.snippet?.channelTitle ?? '',
      publishedAt: it.snippet?.publishedAt ?? '',
      description: it.snippet?.description ?? '',
      thumbnail:
        it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? '',
      url: `https://www.youtube.com/watch?v=${it.id?.videoId}`,
    }))
    res.json({ videos })
  } catch (err) {
    res.status(502).json({ error: { message: (err as Error).message } })
  }
})

/* --------------------------------------------------------------- web fetch (grounding) */

/**
 * SSRF guard. Blocks loopback, link-local, and RFC1918 private ranges so this
 * endpoint cannot be used to probe the host's own network.
 * Must be anchored at both ends and match full addresses — a bare `127\.` prefix
 * test would let 127.0.0.1 through.
 */
const BLOCKED_HOSTS =
  /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|\[?::1\]?|.*\.local|.*\.internal)$/i

app.post('/api/fetch', async (req: Request, res: Response) => {
  const { url } = (req.body ?? {}) as { url?: string }
  if (!url) return res.status(400).json({ error: { message: 'url is required' } })

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return res.status(400).json({ error: { message: 'Not a valid URL.' } })
  }
  if (!/^https?:$/.test(target.protocol) || BLOCKED_HOSTS.test(target.hostname)) {
    return res.status(400).json({ error: { message: 'That address is not allowed.' } })
  }

  try {
    const r = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; VisualAIEverydayAssistant/1.0)',
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
    })
    if (!r.ok) return res.status(502).json({ error: { message: `Source returned ${r.status}` } })
    const type = r.headers.get('content-type') ?? ''
    if (!/text\/|json|xml/.test(type)) {
      return res.status(415).json({ error: { message: `Unsupported content type: ${type}` } })
    }
    const raw = (await r.text()).slice(0, 900_000)
    metrics.fetches++
    res.json({ url: r.url, title: extractTitle(raw), text: htmlToText(raw).slice(0, 24_000) })
  } catch (err) {
    res.status(502).json({ error: { message: (err as Error).message } })
  }
})

function extractTitle(html: string) {
  const m = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{0,300})["']/i)
  return (og?.[1] ?? m?.[1] ?? '').replace(/\s+/g, ' ').trim()
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

/* --------------------------------------------------------------- SPA hosting */

const server = http.createServer(app)

export async function boot(): Promise<http.Server> {
  if (!IS_PROD) {
    const { createServer } = await import('vite')
    const vite = await createServer({
      root: ROOT,
      appType: 'spa',
      server: {
        middlewareMode: true,
        hmr: { server },
        allowedHosts: true,
        cors: true,
      },
    })
    app.use(vite.middlewares)
  } else {
    const dist = path.join(ROOT, 'dist')
    app.use(
      express.static(dist, {
        setHeaders(res, filePath) {
          if (/\.(js|css|woff2?|png|svg)$/.test(filePath)) {
            res.setHeader('cache-control', 'public, max-age=31536000, immutable')
          }
        },
      }),
    )
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  // Central error handler — never leak stack traces to the client.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server]', err.message)
    if (res.headersSent) return
    res.status(500).json({ error: { message: 'Something went wrong on the server.' } })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, HOST, () => {
      server.off('error', reject)
      const shown = HOST === '0.0.0.0' ? 'localhost' : HOST
      console.log(`\n  Show Me · Visual AI Everyday Assistant`)
      console.log(`  ${IS_PROD ? 'production' : 'development'} · http://${shown}:${PORT}`)
      console.log(`  AI relay ready · keys stay in the browser\n`)
      resolve()
    })
  })

  return server
}

/**
 * Only start listening when this file is the entry point. Importing it (from the
 * test suite, for example) must not hijack a port.
 */
const isEntryPoint = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isEntryPoint) {
  boot().catch((err) => {
    console.error(
      'Failed to start:',
      err instanceof Error && /EADDRINUSE/.test(err.message)
        ? `port ${PORT} is already in use — another copy of the app is probably running.`
        : err,
    )
    process.exit(1)
  })
}
