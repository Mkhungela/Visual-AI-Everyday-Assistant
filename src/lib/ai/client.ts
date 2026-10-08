/**
 * The AI client.
 *
 * Two routes to the model:
 *
 *  - `direct`  — the browser calls the provider itself with the user's own key.
 *                Cheapest and fastest; the key never leaves the device.
 *  - `server`  — the request goes to this app's own /api/ai/complete endpoint, which
 *                relays it. Needed for providers that refuse cross-origin browser
 *                calls, and as a safety net when a direct call is blocked.
 *
 * The client tries the preferred route and transparently retries the other one when
 * the failure looks like a network/CORS problem rather than a bad key.
 */

import { extractJson } from './json'
import { AIError, PROVIDERS, callProvider } from './providers'
import type { AIRequest, AIResponse, ProviderId, RunMode } from './types'

export interface AISettings {
  provider: ProviderId
  model: string
  apiKey: string
  baseUrl?: string
  runMode: RunMode
  /** try a repair round-trip when the model returns unparseable JSON */
  selfHeal: boolean
  /** allow the app to fall back to a different configured provider */
  allowFallback: boolean
  temperature: number
  webSearch: boolean
}

export const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  model: '',
  apiKey: '',
  runMode: 'direct',
  selfHeal: true,
  allowFallback: true,
  temperature: 0.4,
  webSearch: true,
}

/** Fire the request along one specific route. */
async function runOnRoute(req: AIRequest, route: RunMode): Promise<AIResponse> {
  if (route === 'server') {
    const res = await fetch('/api/ai/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: req.signal,
    })
    if (!res.ok) {
      let message = `Server relay failed (${res.status})`
      let hint: string | undefined
      try {
        const j = await res.json()
        message = j?.error?.message ?? message
        hint = j?.error?.hint
      } catch {
        /* keep default */
      }
      throw new AIError(message, {
        provider: req.provider,
        status: res.status,
        retryable: res.status >= 500,
        hint,
      })
    }
    const data = (await res.json()) as { result: AIResponse }
    return data.result
  }
  return callProvider(req)
}

/** True when a failure is worth retrying on the *other* route. */
function routeWorthRetrying(err: unknown): boolean {
  if (!(err instanceof AIError)) return true // network TypeError etc.
  if (err.status === 401 || err.status === 403) return false // bad key — server won't help
  const m = (err.message || '').toLowerCase()
  if (m.includes('couldn\u2019t reach') || m.includes("couldn't reach")) return true
  if (m.includes('failed to fetch') || m.includes('network')) return true
  return err.retryable && !err.status
}

export async function completeAI(req: AIRequest, settings: AISettings): Promise<AIResponse> {
  const primary: RunMode = settings.runMode
  const secondary: RunMode = primary === 'direct' ? 'server' : 'direct'

  try {
    return await runOnRoute(req, primary)
  } catch (err) {
    if (routeWorthRetrying(err)) {
      try {
        return await runOnRoute(req, secondary)
      } catch (err2) {
        // Surface whichever error is more actionable.
        if (err2 instanceof AIError) throw err2
        throw err
      }
    }
    throw err
  }
}

export interface JsonResult<T> {
  data: T
  response: AIResponse
  healed: boolean
}

/**
 * Ask for JSON and keep asking until it parses.
 * Returns null data (never throws for content reasons) so the caller can decide.
 */
export async function completeJSON<T>(
  req: AIRequest,
  settings: AISettings,
  opts: { validate?: (raw: unknown) => T | null } = {},
): Promise<JsonResult<T | null>> {
  const first = await completeAI({ ...req, json: true }, settings)
  let parsed = extractJson(first.text)
  let data = parsed === null ? null : opts.validate ? opts.validate(parsed) : (parsed as T)
  if (data !== null) return { data, response: first, healed: false }

  if (!settings.selfHeal) return { data: null, response: first, healed: false }

  // One repair attempt: hand the model back its own output and demand clean JSON.
  const repairReq: AIRequest = {
    ...req,
    json: false,
    temperature: 0,
    messages: [
      ...req.messages,
      { role: 'assistant', parts: [{ type: 'text', text: first.text.slice(0, 12000) }] },
      {
        role: 'user',
        parts: [
          {
            type: 'text',
            text:
              'That reply was not valid JSON. Reply with ONLY the corrected, complete JSON object. ' +
              'No prose, no code fences, no commentary, no trailing commas. Keep every field you already produced.',
          },
        ],
      },
    ],
  }
  const second = await completeAI(repairReq, settings)
  parsed = extractJson(second.text)
  data = parsed === null ? null : opts.validate ? opts.validate(parsed) : (parsed as T)
  return { data, response: second, healed: true }
}

/* -------------------------------------------------------------- diagnostics */

export interface ProbeResult {
  ok: boolean
  message: string
  hint?: string
  models?: { id: string; label: string; vision: boolean }[]
  text?: string
  latencyMs?: number
}

/** Run a cheap round-trip so the user can confirm their key works before relying on it. */
export async function probeProvider(params: {
  provider: ProviderId
  apiKey: string
  model: string
  baseUrl?: string
  runMode: RunMode
}): Promise<ProbeResult> {
  const started = Date.now()
  try {
    const res = await completeAI(
      {
        provider: params.provider,
        model: params.model,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        messages: [
          {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'Reply with exactly: READY. Then on a new line, name one everyday object you can help someone use.',
              },
            ],
          },
        ],
        maxTokens: 80,
        temperature: 0,
      },
      { ...DEFAULT_SETTINGS, runMode: params.runMode },
    )
    return {
      ok: true,
      message: `Connected to ${PROVIDERS[params.provider].label} · ${res.model}`,
      text: res.text.trim(),
      latencyMs: Date.now() - started,
    }
  } catch (err) {
    if (err instanceof AIError) return { ok: false, message: err.message, hint: err.hint }
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}
