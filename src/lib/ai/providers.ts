/**
 * Provider adapters.
 *
 * One normalised request shape in, one normalised response out — for Google Gemini,
 * OpenAI, Anthropic, OpenRouter, Groq, any OpenAI-compatible gateway, and local
 * Ollama. Every adapter is a pure fetch() call with no SDK dependency, so the exact
 * same code runs in the browser (direct, using the user's own key) and on the server
 * (proxy fallback for providers that block browser CORS).
 */

import type {
  AIRequest,
  AIResponse,
  ChatMessage,
  ImagePart,
  ModelInfo,
  ProviderId,
  ProviderMeta,
} from './types'

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    needsKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyHint: 'Starts with AIza… · free key from aistudio.google.com',
    docsUrl: 'https://aistudio.google.com/apikey',
    freeTier: 'Free tier: ~1,500 requests/day, no credit card required.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    needsKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyHint: 'Starts with sk-…',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    needsKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyHint: 'Starts with sk-ant-…',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    needsKey: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'Starts with sk-or-… · one key, hundreds of models',
    docsUrl: 'https://openrouter.ai/keys',
    freeTier: 'Many models have a `:free` suffix you can use at no cost.',
    openAICompatible: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    needsKey: true,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyHint: 'Starts with gsk_…',
    docsUrl: 'https://console.groq.com/keys',
    freeTier: 'Free tier with very fast inference (limits apply per model).',
    openAICompatible: true,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (on-device)',
    needsKey: false,
    defaultBaseUrl: 'http://localhost:11434/v1',
    keyHint: 'No key needed — runs on your own machine',
    docsUrl: 'https://ollama.com',
    openAICompatible: true,
  },
  custom: {
    id: 'custom',
    label: 'Custom / self-hosted',
    needsKey: false,
    defaultBaseUrl: '',
    keyHint: 'Any OpenAI-compatible endpoint',
    docsUrl: '',
    openAICompatible: true,
  },
  demo: {
    id: 'demo',
    label: 'Built-in demo engine',
    needsKey: false,
    defaultBaseUrl: '',
    keyHint: 'No key needed — works offline',
    docsUrl: '',
  },
}

/** Order shown in Settings. Gemini first because its free tier needs no card. */
export const PROVIDER_ORDER: ProviderId[] = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'groq',
  'ollama',
  'custom',
]

export class AIError extends Error {
  status?: number
  provider: ProviderId
  retryable: boolean
  hint?: string
  constructor(
    message: string,
    opts: { provider: ProviderId; status?: number; retryable?: boolean; hint?: string },
  ) {
    super(message)
    this.name = 'AIError'
    this.provider = opts.provider
    this.status = opts.status
    this.retryable = opts.retryable ?? false
    this.hint = opts.hint
  }
}

/* ------------------------------------------------------------------ helpers */

function trimBase(base: string) {
  return base.replace(/\/+$/, '')
}

function dataUrl(img: ImagePart) {
  return `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`
}

function humanise(message: string, provider: ProviderId, status?: number) {
  const lower = message.toLowerCase()
  if (status === 401 || status === 403 || lower.includes('api key not valid') || lower.includes('incorrect api key')) {
    return {
      msg: `Your ${PROVIDERS[provider].label} API key was rejected.`,
      hint: 'Double-check the key in Settings — and make sure it was copied in full.',
      retryable: false,
    }
  }
  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    return {
      msg: `${PROVIDERS[provider].label} says you have hit a rate or quota limit.`,
      hint: 'Wait a moment, or switch model in Settings. Free tiers are per-minute and per-day limited.',
      retryable: true,
    }
  }
  if (status === 400 && lower.includes('model')) {
    return {
      msg: `That model isn't available on your ${PROVIDERS[provider].label} account.`,
      hint: 'Open Settings and tap “Detect models” to pick one your key can actually use.',
      retryable: false,
    }
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return {
      msg: `Couldn't reach ${PROVIDERS[provider].label} from your browser.`,
      hint: 'The app will try routing the request through its own server instead.',
      retryable: true,
    }
  }
  if (status === 413 || lower.includes('too large') || lower.includes('request entity')) {
    return {
      msg: 'That image is too large to send.',
      hint: 'Try a smaller photo — the app downscales automatically, but very large originals can still fail.',
      retryable: false,
    }
  }
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('finish_reason: safety')) {
    return {
      msg: 'The AI refused this request on safety grounds.',
      hint: 'Rephrase what you want to do, or show a different photo. Hard-stop safety rules still apply.',
      retryable: false,
    }
  }
  return { msg: message, hint: undefined, retryable: status ? status >= 500 : true }
}

async function readError(res: Response, provider: ProviderId) {
  let body = ''
  try {
    const text = await res.text()
    try {
      const parsed = JSON.parse(text)
      body =
        parsed?.error?.message ??
        parsed?.error?.errors?.[0]?.message ??
        parsed?.message ??
        parsed?.detail ??
        text
    } catch {
      body = text
    }
  } catch {
    body = ''
  }
  const { msg, hint, retryable } = humanise(
    body || `Request failed with status ${res.status}`,
    provider,
    res.status,
  )
  return new AIError(msg, { provider, status: res.status, retryable, hint })
}

/** Flatten messages to a plain text transcript (used by the offline demo engine). */
export function transcript(messages: ChatMessage[]) {
  return messages
    .map((m) => {
      const text = m.parts
        .map((p) => (p.type === 'text' ? p.text : p.type === 'evidence' ? `[${p.title}: ${p.snippet}]` : ''))
        .filter(Boolean)
        .join('\n')
      return `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${text}`
    })
    .join('\n\n')
}

function collectImages(messages: ChatMessage[]): ImagePart[] {
  const out: ImagePart[] = []
  for (const m of messages) for (const p of m.parts) if (p.type === 'image') out.push(p)
  return out
}

function evidenceBlock(messages: ChatMessage[]) {
  const items = messages.flatMap((m) => m.parts.filter((p) => p.type === 'evidence'))
  if (!items.length) return ''
  return items
    .map((e, i) => `[${i + 1}] ${e.title} — ${e.source ?? 'web'}\n${e.snippet}${e.url ? `\n(${e.url})` : ''}`)
    .join('\n\n')
}

/* -------------------------------------------------------------- Gemini */

async function gemini(req: AIRequest): Promise<AIResponse> {
  const base = trimBase(req.baseUrl || PROVIDERS.gemini.defaultBaseUrl)
  const contents = req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: m.parts.flatMap((p): Record<string, unknown>[] => {
      if (p.type === 'text') return [{ text: p.text }]
      if (p.type === 'image')
        return [{ inlineData: { mimeType: p.mimeType || 'image/jpeg', data: p.data } }]
      return [{ text: `Source [${p.title}]${p.url ? ` (${p.url})` : ''}: ${p.snippet}` }]
    }),
  }))

  const generationConfig: Record<string, unknown> = {}
  if (req.temperature !== undefined) generationConfig.temperature = req.temperature
  if (req.maxTokens) generationConfig.maxOutputTokens = req.maxTokens
  if (req.json) generationConfig.responseMimeType = 'application/json'
  if (req.json && req.schema) generationConfig.responseSchema = req.schema
  // Gemini 2.5+ uses thinking budgets; keeping it modest makes the app feel fast.
  if (req.model.includes('2.5') || req.model.includes('3')) {
    generationConfig.thinkingConfig = { thinkingBudget: req.thinking ? 4096 : 0 }
  }

  const body: Record<string, unknown> = { contents, generationConfig }
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] }
  if (req.webSearch) body.tools = [{ google_search: {} }]

  const res = await fetch(`${base}/models/${encodeURIComponent(req.model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': req.apiKey ?? '' },
    body: JSON.stringify(body),
    signal: req.signal,
  })
  if (!res.ok) throw await readError(res, 'gemini')
  const data = await res.json()

  const cand = data?.candidates?.[0]
  const text =
    cand?.content?.parts?.map((p: any) => p?.text ?? '').join('') ??
    ''
  if (!text && !cand) {
    const reason = data?.promptFeedback?.blockReason
    throw new AIError(
      reason ? `Gemini blocked this request (${reason}).` : 'Gemini returned an empty response.',
      { provider: 'gemini', retryable: false, hint: reason ? 'Try a different photo or rephrase.' : undefined },
    )
  }
  const grounded = Array.isArray(cand?.groundingMetadata?.groundingChunks)
    ? cand.groundingMetadata.groundingChunks.length > 0
    : undefined

  return {
    text,
    model: req.model,
    provider: 'gemini',
    grounded,
    usage: {
      promptTokens: data?.usageMetadata?.promptTokenCount,
      completionTokens: data?.usageMetadata?.candidatesTokenCount,
      totalTokens: data?.usageMetadata?.totalTokenCount,
    },
    raw: data,
  }
}

/* -------------------------------------------------------------- OpenAI-compatible */

function isReasoningModel(model: string) {
  return /^(o1|o3|o4|gpt-5)/i.test(model) || /reasoning/i.test(model)
}

async function openAICompatible(
  req: AIRequest,
  provider: ProviderId,
  baseUrl: string,
  extraHeaders: Record<string, string> = {},
): Promise<AIResponse> {
  const base = trimBase(baseUrl)
  const messages = req.messages.map((m) => ({
    role: m.role,
    content:
      m.parts.length === 1 && m.parts[0].type === 'text'
        ? (m.parts[0] as { text: string }).text
        : m.parts.map((p) => {
            if (p.type === 'text') return { type: 'text', text: p.text }
            if (p.type === 'image') return { type: 'image_url', image_url: { url: dataUrl(p) } }
            return { type: 'text', text: `Source [${p.title}]${p.url ? ` (${p.url})` : ''}: ${p.snippet}` }
          }),
  }))

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.system ? [{ role: 'system', content: req.system }, ...messages] : messages,
  }
  if (req.temperature !== undefined && !isReasoningModel(req.model)) body.temperature = req.temperature
  if (req.maxTokens) {
    if (isReasoningModel(req.model)) body.max_completion_tokens = req.maxTokens
    else body.max_tokens = req.maxTokens
  }
  if (req.json) body.response_format = { type: 'json_object' }
  if (provider === 'openrouter') {
    body.provider = { require_parameters: false }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...extraHeaders,
  }
  if (req.apiKey) headers.authorization = `Bearer ${req.apiKey}`
  if (provider === 'openrouter') {
    // OpenRouter uses these to attribute traffic to an app in the user's dashboard.
    headers['http-referer'] = 'https://github.com/LulamileMkhungela/Visual-AI-Everyday-Assistant'
    headers['x-title'] = 'Show Me · Visual AI Everyday Assistant'
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  })
  if (!res.ok) throw await readError(res, provider)
  const data = await res.json()
  const choice = data?.choices?.[0]
  const text =
    typeof choice?.message?.content === 'string'
      ? choice.message.content
      : Array.isArray(choice?.message?.content)
        ? choice.message.content.map((c: any) => c?.text ?? '').join('')
        : ''
  if (!text) {
    throw new AIError('The model returned an empty response.', { provider, retryable: true })
  }
  return {
    text,
    model: data?.model ?? req.model,
    provider,
    usage: {
      promptTokens: data?.usage?.prompt_tokens,
      completionTokens: data?.usage?.completion_tokens,
      totalTokens: data?.usage?.total_tokens,
    },
    raw: data,
  }
}

/* -------------------------------------------------------------- Anthropic */

async function anthropic(req: AIRequest): Promise<AIResponse> {
  const base = trimBase(req.baseUrl || PROVIDERS.anthropic.defaultBaseUrl)
  const messages = req.messages.map((m) => {
    const content = m.parts
      .map((p) => {
        if (p.type === 'text') return { type: 'text', text: p.text }
        if (p.type === 'image')
          return {
            type: 'image',
            source: { type: 'base64', media_type: p.mimeType || 'image/jpeg', data: p.data },
          }
        return { type: 'text', text: `Source [${p.title}]${p.url ? ` (${p.url})` : ''}: ${p.snippet}` }
      })
      .filter(Boolean)
    return { role: m.role, content }
  })

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    messages,
  }
  if (req.system) body.system = req.system
  if (req.temperature !== undefined) body.temperature = req.temperature
  if (req.webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]

  const res = await fetch(`${base}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': req.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      // allows the call to work from a page instead of only a server
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal: req.signal,
  })
  if (!res.ok) throw await readError(res, 'anthropic')
  const data = await res.json()
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((c: any) => c?.type === 'text')
        .map((c: any) => c.text)
        .join('')
    : ''
  if (!text) throw new AIError('Claude returned an empty response.', { provider: 'anthropic', retryable: true })
  return {
    text,
    model: data?.model ?? req.model,
    provider: 'anthropic',
    grounded: Array.isArray(data?.content) && data.content.some((c: any) => c?.type === 'web_search_tool_result'),
    usage: {
      promptTokens: data?.usage?.input_tokens,
      completionTokens: data?.usage?.output_tokens,
    },
    raw: data,
  }
}

/* -------------------------------------------------------------- router */

export async function callProvider(req: AIRequest): Promise<AIResponse> {
  switch (req.provider) {
    case 'gemini':
      return gemini(req)
    case 'openai':
      return openAICompatible(req, 'openai', req.baseUrl || PROVIDERS.openai.defaultBaseUrl)
    case 'anthropic':
      return anthropic(req)
    case 'openrouter':
      return openAICompatible(req, 'openrouter', req.baseUrl || PROVIDERS.openrouter.defaultBaseUrl)
    case 'groq':
      return openAICompatible(req, 'groq', req.baseUrl || PROVIDERS.groq.defaultBaseUrl)
    case 'ollama':
      return openAICompatible(req, 'ollama', req.baseUrl || PROVIDERS.ollama.defaultBaseUrl)
    case 'custom':
      if (!req.baseUrl) {
        throw new AIError('No base URL set for the custom provider.', {
          provider: 'custom',
          hint: 'Open Settings and enter the OpenAI-compatible endpoint, e.g. https://my-host/v1',
        })
      }
      return openAICompatible(req, 'custom', req.baseUrl)
    default:
      throw new AIError(`Unknown provider: ${req.provider}`, { provider: 'custom' })
  }
}

/* -------------------------------------------------------------- model discovery */

function classify(id: string): ModelInfo['tier'] {
  const s = id.toLowerCase()
  if (/(thinking|reasoning|pro|o3|o4|opus|sonnet|405b|r1)/.test(s)) return 'reasoning'
  if (/(flash|mini|nano|haiku|instant|small|8b|3b|lite)/.test(s)) return 'fast'
  if (/(gpt-4|gemini-2.5|gemini-3|llama-4|scout|maverick|70b)/.test(s)) return 'balanced'
  return 'unknown'
}

function visionCapable(id: string, provider: ProviderId) {
  const s = id.toLowerCase()
  if (/(embedding|embed|whisper|tts|dall-e|davinci|moderation|image-generation|imagen|veo|rerank|guard)/.test(s))
    return false
  if (provider === 'openai') return /(gpt-4|gpt-5|o3|o4|vision|gpt-4\.1|chatgpt)/.test(s)
  if (provider === 'anthropic') return /claude/.test(s) && /(3|4|opus|sonnet|haiku)/.test(s)
  if (provider === 'gemini') return /gemini/.test(s)
  if (provider === 'groq') return /(scout|maverick|vision|llama-4)/.test(s)
  return /(gpt-4|gpt-5|claude|gemini|llama-4|scout|maverick|qwen.*vl|llava|vision|pixtral|internvl|molmo)/.test(s)
}

/** Models that are known-good for this app's vision + JSON workload, best first. */
export const PREFERRED: Record<string, string[]> = {
  gemini: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-lite-latest', 'gemini-2.5-pro'],
  openai: ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini', 'gpt-5', 'gpt-4.1-mini', 'o4-mini'],
  anthropic: ['claude-sonnet-4-5', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  openrouter: [
    'google/gemini-2.5-flash',
    'anthropic/claude-sonnet-4.5',
    'openai/gpt-4o-mini',
    'google/gemma-3-27b-it:free',
    'qwen/qwen2.5-vl-72b-instruct:free',
  ],
  groq: ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'],
  ollama: ['llama3.2-vision', 'qwen2.5vl', 'llava', 'gemma3'],
  custom: [],
}

/** Pick a sensible default model for a provider, preferring ones we know work. */
export function pickDefaultModel(provider: ProviderId, available: ModelInfo[]): string {
  const pref = PREFERRED[provider] ?? []
  for (const p of pref) {
    const hit = available.find((m) => m.id === p || m.id.endsWith(`/${p}`))
    if (hit) return hit.id
  }
  const vision = available.filter((m) => m.vision)
  const pool = vision.length ? vision : available
  const ranked = [...pool].sort((a, b) => {
    const rank = (m: ModelInfo) => (m.tier === 'balanced' ? 0 : m.tier === 'fast' ? 1 : m.tier === 'reasoning' ? 2 : 3)
    const d = rank(a) - rank(b)
    return d !== 0 ? d : a.id.localeCompare(b.id)
  })
  return ranked[0]?.id ?? pref[0] ?? ''
}

export async function listModels(opts: {
  provider: ProviderId
  apiKey?: string
  baseUrl?: string
  signal?: AbortSignal
}): Promise<ModelInfo[]> {
  const { provider, apiKey, baseUrl, signal } = opts
  const out: ModelInfo[] = []

  if (provider === 'gemini') {
    const base = trimBase(baseUrl || PROVIDERS.gemini.defaultBaseUrl)
    const res = await fetch(`${base}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': apiKey ?? '' },
      signal,
    })
    if (!res.ok) throw await readError(res, 'gemini')
    const data = await res.json()
    for (const m of data?.models ?? []) {
      const id = String(m.name ?? '').replace(/^models\//, '')
      if (!id) continue
      const methods: string[] = m.supportedGenerationMethods ?? []
      if (!methods.includes('generateContent')) continue
      if (/(embedding|aqa|imagen|veo|tts|native-audio|live)/.test(id)) continue
      out.push({ id, label: m.displayName ?? id, vision: /gemini/.test(id), tier: classify(id) })
    }
    return out
  }

  if (provider === 'anthropic') {
    const base = trimBase(baseUrl || PROVIDERS.anthropic.defaultBaseUrl)
    const res = await fetch(`${base}/models?limit=100`, {
      headers: { 'x-api-key': apiKey ?? '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      signal,
    })
    if (!res.ok) throw await readError(res, 'anthropic')
    const data = await res.json()
    for (const m of data?.data ?? []) {
      const id = String(m.id ?? '')
      if (!id) continue
      out.push({ id, label: m.display_name ?? id, vision: /claude/.test(id), tier: classify(id) })
    }
    return out
  }

  // OpenAI + all OpenAI-compatible gateways
  const meta = PROVIDERS[provider]
  const base = trimBase(baseUrl || meta.defaultBaseUrl)
  if (!base) throw new AIError('Enter a base URL first.', { provider })
  const headers: Record<string, string> = {}
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  const res = await fetch(`${base}/models`, { headers, signal })
  if (!res.ok) throw await readError(res, provider)
  const data = await res.json()
  const rows: any[] = Array.isArray(data) ? data : (data?.data ?? [])
  for (const m of rows) {
    const id = String(m?.id ?? '')
    if (!id) continue
    const vision = visionCapable(id, provider)
    if (provider === 'groq' && !vision) continue
    out.push({ id, label: m?.name ?? id, vision, tier: classify(id) })
  }
  return out
}
