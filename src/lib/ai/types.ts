/**
 * Shared AI types.
 *
 * These types are used by BOTH the browser bundle and the Express server, so this
 * module must stay free of any browser-only or Node-only imports.
 */

export type ProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'groq'
  | 'ollama'
  | 'custom'
  | 'demo'

export type RunMode = 'direct' | 'server'

/** A base64 image with no data-URL prefix. */
export interface ImagePart {
  type: 'image'
  mimeType: string
  /** base64 payload only (no `data:image/...;base64,` prefix) */
  data: string
  /** optional label used by the prompt builder, e.g. "before"/"after"/"ingredient" */
  label?: string
}

/** A snippet pulled from web research. Powers the "grounded" answer style. */
export interface EvidencePart {
  type: 'evidence'
  title: string
  url?: string
  source?: string
  snippet: string
}

export type Part =
  | { type: 'text'; text: string }
  | ImagePart
  | EvidencePart

export interface ChatMessage {
  role: 'user' | 'assistant'
  parts: Part[]
}

export interface ModelInfo {
  id: string
  label: string
  vision: boolean
  /** roughly "flash" | "pro" | "reasoning" — used for smart default picking */
  tier?: 'fast' | 'balanced' | 'reasoning' | 'unknown'
}

export interface AIRequest {
  provider: ProviderId
  model: string
  apiKey?: string
  /** override for self-hosted / OpenAI-compatible gateways */
  baseUrl?: string
  system?: string
  messages: ChatMessage[]
  /** ask the provider for strict JSON when it supports it */
  json?: boolean
  /** a JSON shape hint (loose subset of JSON Schema) for providers that accept it */
  schema?: unknown
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  /** extra request options */
  webSearch?: boolean
  thinking?: boolean
}

export interface AIUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AIResponse {
  text: string
  model: string
  provider: ProviderId
  usage?: AIUsage
  /** true when web-search grounding was applied by the provider */
  grounded?: boolean
  raw?: unknown
}

export interface ProviderMeta {
  id: ProviderId
  label: string
  needsKey: boolean
  defaultBaseUrl: string
  keyHint: string
  docsUrl: string
  freeTier?: string
  openAICompatible?: boolean
}
