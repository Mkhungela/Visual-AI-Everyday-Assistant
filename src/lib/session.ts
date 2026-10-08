/**
 * Session orchestration.
 *
 * One place that decides: is this going to a real model, or to the offline engine?
 * Everything the UI needs goes through here, so the UI never has to know which.
 */

import { DEFAULT_SETTINGS, completeAI, completeJSON, type AISettings } from './ai/client'
import type { ChatMessage, EvidencePart, ImagePart, ProviderId } from './ai/types'
import { splitDataUrl } from './images'
import {
  CONVERSATION_SYSTEM,
  DEFAULT_PERSONA,
  ANALYST_SYSTEM,
  buildAnalyzeMessages,
  buildCompareMessages,
  buildExplainMessages,
  buildFollowUpMessages,
  buildIntentMessages,
  buildRecipeMessages,
  buildShoppingMessages,
  buildSummaryMessages,
  buildTroubleshootMessages,
  buildVoiceMessages,
  type Persona,
  type TaskContext,
} from './prompts'
import { normalizeAnalysis, type AnalysisResult, type Recipe, type SkillLevel, type Step } from './schema'
import { demoAnalyze, demoFollowUp, readImage, type VisualRead } from './demo/engine'
import { extractJson } from './ai/json'
import { planVideos, type VideoPlan } from './videos'
import type { Attachment } from './store'

export interface SessionMeta {
  demo: boolean
  provider: ProviderId
  model: string
  latencyMs: number
  healed: boolean
  /** the model grounded its answer in live web search */
  grounded?: boolean
  notice?: string
}

export interface AnalyzeArgs {
  request: string
  attachments: Attachment[]
  settings: AISettings
  persona?: Persona
  personalKnowledge?: string[]
  answers?: { question: string; answer: string }[]
  sessionSummary?: string
  taskTitle?: string
  currentStep?: number
  kitchen?: string[]
  equipment?: string[]
  youtubeKey?: string
  signal?: AbortSignal
  /** skip video planning for speed when it isn't needed yet */
  withVideos?: boolean
}

export interface AnalyzeOutcome {
  analysis: AnalysisResult
  meta: SessionMeta
  visualRead?: VisualRead
}

function needsDemo(settings: AISettings) {
  if (settings.provider === 'demo') return true
  if (settings.provider === 'ollama') return false
  if (settings.provider === 'custom') return !settings.baseUrl
  return !settings.apiKey
}

export function imageParts(attachments: Attachment[], roles?: string[]): ImagePart[] {
  return attachments.map((a, i) => {
    const { mimeType, data } = splitDataUrl(a.dataUrl)
    return { type: 'image' as const, mimeType, data, label: roles?.[i] ?? a.label }
  })
}

/* ------------------------------------------------------------------ analyze */

export async function analyze(args: AnalyzeArgs): Promise<AnalyzeOutcome> {
  const started = Date.now()
  const settings = args.settings
  const persona = args.persona ?? DEFAULT_PERSONA

  if (needsDemo(settings)) {
    const visualRead = args.attachments.length ? await readImage(args.attachments[0].dataUrl).catch(() => undefined) : undefined
    const analysis = await demoAnalyze({
      request: args.request,
      attachments: args.attachments,
      persona,
      kitchen: args.kitchen ?? [],
      equipment: args.equipment ?? [],
      answers: args.answers,
      sessionSummary: args.sessionSummary,
    })
    const plan = await planVideos({ analysis, youtubeKey: args.youtubeKey }).catch(() => null)
    if (plan) applyVideoPlan(analysis, plan, args.youtubeKey)
    return {
      analysis,
      visualRead,
      meta: {
        demo: true,
        provider: 'demo',
        model: 'offline engine',
        latencyMs: Date.now() - started,
        healed: false,
        notice:
          'Offline engine: answers come from built-in guides and real reasoning over your words — not from your photo. Add an AI key in Settings for genuine image understanding.',
      },
    }
  }

  const context: TaskContext = {
    request: args.request,
    persona,
    personalKnowledge: args.personalKnowledge,
    sessionSummary: args.sessionSummary,
    answers: args.answers,
    currentStep: args.currentStep,
    taskTitle: args.taskTitle,
  }

  const images = imageParts(args.attachments, args.attachments.map((a) => a.label))
  const messages = buildAnalyzeMessages({ context, images })

  const { data, response, healed } = await completeJSON<AnalysisResult>(
    {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      system: ANALYST_SYSTEM,
      messages,
      temperature: settings.temperature,
      maxTokens: 8192,
      webSearch: settings.webSearch,
      signal: args.signal,
      schema: undefined,
    },
    settings,
  )

  if (!data) {
    throw new Error(
      'The model replied but I could not read its answer as structured data. Try again, or switch model in Settings.',
    )
  }

  const analysis = normalizeAnalysis(data, Math.max(1, args.attachments.length))

  let plan: VideoPlan | null = null
  if (args.withVideos !== false) {
    plan = await planVideos({ analysis, youtubeKey: args.youtubeKey }).catch(() => null)
  }
  if (plan) applyVideoPlan(analysis, plan, args.youtubeKey)

  return {
    analysis,
    meta: {
      demo: false,
      provider: response.provider,
      model: response.model,
      latencyMs: Date.now() - started,
      healed,
      grounded: response.grounded,
      notice: plan?.notice,
    },
  }
}

function applyVideoPlan(analysis: AnalysisResult, plan: VideoPlan, youtubeKey?: string) {
  if (plan.videos.length) analysis.videos = plan.videos
  if (plan.notice) analysis.detailedExplanation += `\n\n${plan.notice}`
  if (!youtubeKey && plan.queries.length) {
    analysis.knowledge = [
      ...analysis.knowledge,
      {
        claim: `Best video search for this: “${plan.queries[0].query}”`,
        why: plan.queries[0].why,
        confidence: 'medium',
      },
    ]
  }
}

/* ------------------------------------------------------------------ chat */

export interface ChatTurnArgs {
  message: string
  analysis: AnalysisResult
  history: ChatMessage[]
  images?: Attachment[]
  settings: AISettings
  persona?: Persona
  scenarioId?: string
  stepIndex?: number
  /** the user's kitchen/appliance memory, so follow-ups stay personal */
  personalKnowledge?: string[]
}

export interface ChatTurnResult {
  reply: string
  meta: SessionMeta
  /** the model decided the plan changes materially — the UI can offer "update the guide" */
  revised?: AnalysisResult
}

export async function chatTurn(args: ChatTurnArgs): Promise<ChatTurnResult> {
  const started = Date.now()
  const settings = args.settings

  if (needsDemo(settings)) {
    return {
      reply: demoFollowUp({
        message: args.message,
        analysis: args.analysis,
        scenarioId: args.scenarioId,
        stepIndex: args.stepIndex,
      }),
      meta: { demo: true, provider: 'demo', model: 'offline engine', latencyMs: Date.now() - started, healed: false },
    }
  }

  const context: TaskContext = {
    request: args.message,
    persona: args.persona ?? DEFAULT_PERSONA,
    personalKnowledge: args.personalKnowledge,
    currentStep: args.stepIndex !== undefined ? args.stepIndex + 1 : undefined,
    taskTitle: args.analysis.title,
  }

  const history: ChatMessage[] = [
    ...args.history,
    { role: 'user', parts: [{ type: 'text', text: args.message }] },
  ]

  const messages = buildFollowUpMessages({
    context,
    analysis: args.analysis,
    history,
    images: args.images?.length ? imageParts(args.images) : undefined,
  })

  const response = await completeAI(
    {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      system: CONVERSATION_SYSTEM,
      messages,
      temperature: Math.min(0.7, settings.temperature + 0.1),
      maxTokens: 900,
      webSearch: settings.webSearch,
    },
    settings,
  )

  return {
    reply: response.text.trim(),
    meta: {
      demo: false,
      provider: response.provider,
      model: response.model,
      latencyMs: Date.now() - started,
      healed: false,
      grounded: response.grounded,
    },
  }
}

/* ------------------------------------------------------------------ explanation levels */

export async function explain(args: {
  analysis: AnalysisResult
  level: SkillLevel
  language: string
  settings: AISettings
}): Promise<string> {
  const { analysis, level, language, settings } = args
  if (needsDemo(settings)) return offlineExplanation(analysis, level, language)

  const res = await completeAI(
    {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      messages: buildExplainMessages({ analysis, level, language }),
      temperature: 0.35,
      maxTokens: 1600,
    },
    settings,
  )
  return res.text.trim()
}

function offlineExplanation(analysis: AnalysisResult, level: SkillLevel, language: string) {
  const steps = analysis.steps
  if (level === 'expert') {
    return [analysis.title, '', ...steps.map((s) => `${s.n}. ${s.title} — ${s.detail.split('. ').slice(0, 1).join('')}.`)].join('\n')
  }
  if (level === 'beginner' || level === 'normal') {
    return analysis.simpleExplanation || analysis.summary
  }
  return analysis.detailedExplanation || analysis.summary
}

/* ------------------------------------------------------------------ voice */

export async function voiceScript(args: {
  analysis: AnalysisResult
  language: string
  settings: AISettings
}): Promise<string> {
  const { analysis, language, settings } = args
  if (needsDemo(settings) || language === 'en-ZA' || language === 'en-GB' || language === 'en-US') {
    return analysis.voiceScript || analysis.summary
  }
  try {
    const res = await completeAI(
      {
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        messages: buildVoiceMessages({ analysis, language }),
        temperature: 0.4,
        maxTokens: 700,
      },
      settings,
    )
    return res.text.trim()
  } catch {
    return analysis.voiceScript || analysis.summary
  }
}

/* ------------------------------------------------------------------ recipes */

export async function deepenRecipe(args: {
  recipe: Recipe
  have: string[]
  missing: string[]
  constraints: string[]
  servings: number
  budget?: number
  settings: AISettings
}): Promise<Recipe> {
  const { settings } = args
  if (needsDemo(settings)) return args.recipe

  const res = await completeJSON<Recipe>(
    {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      messages: buildRecipeMessages({
        recipeName: args.recipe.name,
        have: args.have,
        missing: args.missing,
        constraints: args.constraints,
        servings: args.servings,
        currency: 'R',
        budget: args.budget,
      }),
      temperature: 0.5,
      maxTokens: 2600,
    },
    settings,
  )
  if (!res.data) return args.recipe
  const merged = normalizeAnalysis({ recipes: [res.data] }, 1)
  return merged.recipes[0] ?? args.recipe
}

/* ------------------------------------------------------------------ shopping */

export interface ShoppingItem {
  item: string
  why: string
  quantity: string
  estCost: number
  optional: boolean
  substitutes: string[]
}

export async function shoppingList(args: {
  taskTitle: string
  missing: string[]
  settings: AISettings
}): Promise<{ items: ShoppingItem[]; totalEstimate: number; note: string }> {
  const { settings } = args
  if (needsDemo(settings) || !args.missing.length) {
    return {
      items: args.missing.map((m) => ({
        item: m,
        why: `Needed for: ${args.taskTitle}`,
        quantity: '',
        estCost: 0,
        optional: false,
        substitutes: [],
      })),
      totalEstimate: 0,
      note: 'Prices vary by area and shop, so these are unestimated. Add an AI key for rough figures and cheaper alternatives.',
    }
  }

  const res = await completeJSON<{ items: ShoppingItem[]; totalEstimate: number; note: string }>(
    {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      messages: buildShoppingMessages({ taskTitle: args.taskTitle, missing: args.missing, currency: 'R' }),
      temperature: 0.3,
      maxTokens: 1200,
    },
    settings,
  )
  return (
    res.data ?? {
      items: args.missing.map((m) => ({ item: m, why: args.taskTitle, quantity: '', estCost: 0, optional: false, substitutes: [] })),
      totalEstimate: 0,
      note: 'Could not estimate prices right now.',
    }
  )
}

/* ------------------------------------------------------------------ compare */

export interface CompareResult {
  verdict: 'correct' | 'partially_correct' | 'not_correct' | 'cannot_tell'
  headline: string
  whatChanged: string[]
  stillToDo: string[]
  confidence: number
  caveat: string
  annotations: AnalysisResult['annotations']
  demo: boolean
}

export async function compareImages(args: {
  before: Attachment
  after: Attachment
  analysis?: AnalysisResult
  settings: AISettings
  persona?: Persona
}): Promise<CompareResult> {
  const { settings } = args
  if (needsDemo(settings)) {
    return {
      verdict: 'cannot_tell',
      headline: 'I cannot compare the two photos without an AI key.',
      whatChanged: [],
      stillToDo: [],
      confidence: 0,
      caveat:
        'Image comparison needs vision. The offline engine will not pretend to have looked at your photos — add a key in Settings and it will compare them properly.',
      annotations: [],
      demo: true,
    }
  }

  const [before, after] = imageParts([args.before, args.after], ['before', 'after'])
  const res = await completeJSON<CompareResult>(
    {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      messages: buildCompareMessages({
        context: {
          request: '',
          persona: args.persona ?? DEFAULT_PERSONA,
          taskTitle: args.analysis?.title,
          currentStep: undefined,
        },
        before,
        after,
      }),
      temperature: 0.2,
      maxTokens: 1400,
    },
    settings,
  )

  const raw = res.data ?? null
  if (!raw) {
    return {
      verdict: 'cannot_tell',
      headline: 'I could not read the comparison result.',
      whatChanged: [],
      stillToDo: [],
      confidence: 0,
      caveat: 'Try again with two clearer photos taken from the same angle.',
      annotations: [],
      demo: false,
    }
  }

  const normalized = normalizeAnalysis({ annotations: (raw as unknown as { annotations?: unknown }).annotations, objects: [] }, 2)
  return {
    verdict: ['correct', 'partially_correct', 'not_correct', 'cannot_tell'].includes(raw.verdict as string)
      ? (raw.verdict as CompareResult['verdict'])
      : 'cannot_tell',
    headline: String(raw.headline ?? ''),
    whatChanged: Array.isArray(raw.whatChanged) ? raw.whatChanged.map(String) : [],
    stillToDo: Array.isArray(raw.stillToDo) ? raw.stillToDo.map(String) : [],
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    caveat: String(raw.caveat ?? 'Photos cannot prove something is correctly installed or safe.'),
    annotations: normalized.annotations,
    demo: false,
  }
}

/* ------------------------------------------------------------------ troubleshooting tree */

export interface TroubleshootStepResult {
  diagnosis: string
  confidence: number
  resolved: boolean
  nextQuestion?: { id: string; question: string; kind: 'yes_no' | 'choice'; options: string[]; why: string }
  checks: { title: string; detail: string; risk: string }[]
  likelyCauses: { cause: string; likelihood: number; fix: string; diy: boolean }[]
  verdict: string
  escalate: boolean
  escalateReason: string
  demo: boolean
}

export async function troubleshootNext(args: {
  system: string
  request: string
  history: { question: string; answer: string }[]
  settings: AISettings
  persona?: Persona
}): Promise<TroubleshootStepResult> {
  const { settings } = args

  if (needsDemo(settings)) {
    return offlineTroubleshoot(args)
  }

  const res = await completeJSON<TroubleshootStepResult>(
    {
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      messages: buildTroubleshootMessages({
        context: { request: args.request, persona: args.persona ?? DEFAULT_PERSONA },
        history: args.history,
        system: args.system,
      }),
      temperature: 0.3,
      maxTokens: 1400,
    },
    settings,
  )

  const d = res.data
  if (!d) {
    return {
      diagnosis: 'I could not read the diagnosis result.',
      confidence: 0,
      resolved: false,
      checks: [],
      likelyCauses: [],
      verdict: '',
      escalate: false,
      escalateReason: '',
      demo: false,
    }
  }
  return { ...d, demo: false }
}

/** A scripted decision tree so offline troubleshooting still actually narrows things down. */
function offlineTroubleshoot(args: { system: string; history: { question: string; answer: string }[] }): TroubleshootStepResult {
  const q = (question: string, kind: 'yes_no' | 'choice', options: string[], why: string) => ({
    id: `q${args.history.length + 1}`,
    question,
    kind,
    options,
    why,
  })

  const used = (needle: string) => args.history.some((h) => h.question.toLowerCase().includes(needle.toLowerCase()))
  const answered = (needle: string) => args.history.find((h) => h.question.toLowerCase().includes(needle.toLowerCase()))?.answer.toLowerCase() ?? ''

  if (!used('switched on')) {
    return {
      diagnosis: 'Not enough information yet.',
      confidence: 0.1,
      resolved: false,
      nextQuestion: q('Is it switched on, and does it show any sign of power?', 'yes_no', ['Yes', 'No'], 'Power is the cheapest cause and it is worth eliminating first.'),
      checks: [{ title: 'Check the power', detail: 'Look for a light, a display, or listen for a fan. If nothing at all, try a different socket.', risk: 'none' }],
      likelyCauses: [],
      verdict: '',
      escalate: false,
      escalateReason: '',
      demo: true,
    }
  }
  if (!used('error')) {
    return {
      diagnosis: 'It has power but is not doing what you expect.',
      confidence: 0.3,
      resolved: false,
      nextQuestion: q('Does it display an error message or a flashing light?', 'yes_no', ['Yes', 'No'], 'A named error usually identifies the fault exactly.'),
      checks: [{ title: 'Read the exact wording', detail: 'Write down or photograph the exact error text or the light pattern.', risk: 'none' }],
      likelyCauses: [],
      verdict: '',
      escalate: false,
      escalateReason: '',
      demo: true,
    }
  }
  if (!used('tried')) {
    return {
      diagnosis: 'Most faults at this point are cleared by a full power cycle.',
      confidence: 0.4,
      resolved: false,
      nextQuestion: q('Have you turned it off at the wall for 30 seconds and back on?', 'yes_no', ['Yes', 'No'], 'A hard reset clears a surprising share of faults.'),
      checks: [
        { title: 'Switch off at the wall, wait 30 seconds, switch back on', detail: 'Not the standby button — the actual wall switch or plug. Give it a full minute to boot.', risk: 'none' },
        { title: 'Check consumables and connections', detail: 'Paper, toner, water, filters, or the cable. Reseat anything that can be reseated.', risk: 'none' },
      ],
      likelyCauses: [],
      verdict: '',
      escalate: false,
      escalateReason: '',
      demo: true,
    }
  }

  const errorAnswer = answered('error')
  const powerAnswer = answered('switched on')

  return {
    diagnosis:
      powerAnswer.startsWith('n')
        ? `${args.system} has no power at all — that points at the supply or the internal fuse, not the function itself.`
        : errorAnswer.startsWith('y')
          ? `${args.system} is reporting a specific fault. That narrows it to one subsystem rather than a general failure.`
          : `${args.system} has power and reports no error, which usually points at a mechanical or consumable issue rather than electronics.`,
    confidence: 0.6,
    resolved: true,
    checks: [],
    likelyCauses: [
      { cause: 'Power supply or internal fuse', likelihood: powerAnswer.startsWith('n') ? 0.5 : 0.1, fix: 'Test the socket with another appliance. If the socket is fine, the unit needs a technician.', diy: powerAnswer.startsWith('n') },
      { cause: 'A consumable or mechanical part that has worn', likelihood: 0.3, fix: 'Inspect the wear parts: rollers, belts, seals, filters, blades, or a blocked path.', diy: true },
      { cause: 'An electronic fault that reports no code', likelihood: 0.2, fix: 'This is the point where a qualified technician is cheaper than guessing.', diy: false },
    ],
    verdict: 'That is the honest extent of what I can narrow down offline. If you add an AI key I can ask follow-up questions based on a photo of the actual unit.',
    escalate: true,
    escalateReason: powerAnswer.startsWith('n')
      ? 'No power at all with a working socket usually means a failed internal supply — not a DIY repair.'
      : 'Anything with mains power inside that needs opening should go to a qualified technician.',
    demo: true,
  }
}

/* ------------------------------------------------------------------ intent options */

export interface IntentOption {
  mode: string
  label: string
  description: string
  confidence: number
}

export async function intentOptions(args: {
  request: string
  analysis: AnalysisResult
  settings: AISettings
  persona?: Persona
}): Promise<{ goal: string; options: IntentOption[]; clarify: string }> {
  const { settings, analysis } = args

  const fallback = {
    goal: analysis.situation || analysis.title,
    options: deriveIntentOptions(analysis),
    clarify: '',
  }
  if (needsDemo(settings)) return fallback

  try {
    const res = await completeJSON<{ goal: string; options: IntentOption[]; clarify: string }>(
      {
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        messages: buildIntentMessages({
          context: { request: args.request, persona: args.persona ?? DEFAULT_PERSONA },
          analysis,
        }),
        temperature: 0.3,
        maxTokens: 700,
      },
      settings,
    )
    if (!res.data?.options?.length) return fallback
    return {
      goal: res.data.goal || fallback.goal,
      options: res.data.options
        .filter((o) => o?.label)
        .slice(0, 5)
        .map((o) => ({
          mode: String(o.mode ?? 'other'),
          label: String(o.label),
          description: String(o.description ?? ''),
          confidence: typeof o.confidence === 'number' ? o.confidence : 0.5,
        })),
      clarify: res.data.clarify ?? '',
    }
  } catch {
    return fallback
  }
}

function deriveIntentOptions(analysis: AnalysisResult): IntentOption[] {
  const opts: IntentOption[] = []
  const push = (mode: string, label: string, description: string, confidence: number) =>
    opts.push({ mode, label, description, confidence })

  if (analysis.recipes.length) push('cook', 'Cook with this', `I found ${analysis.recipes.length} meals that fit.`, 0.9)
  if (analysis.intent === 'use') push('use', 'Use this machine', 'I will walk you through the controls in order.', 0.85)
  if (analysis.intent === 'fix' || analysis.intent === 'troubleshoot') push('fix', 'Fix it', 'I will run through the likely causes.', 0.85)
  if (analysis.intent === 'identify' || !analysis.objects.length) push('identify', 'What is this?', 'I will explain what it is and what it does.', 0.7)
  if (analysis.identify) push('identify', 'Understand it', 'What it is, what it does, and what goes wrong.', 0.8)
  push('learn', 'Teach me', 'Explain how this works and why.', 0.6)
  if (analysis.intent === 'assemble') push('assemble', 'Assemble it', 'I will work in the order the parts go together.', 0.85)
  if (analysis.intent === 'software') push('software', 'Show me where', 'I will name the exact menus and buttons.', 0.85)
  return opts.slice(0, 5)
}

/* ------------------------------------------------------------------ session memory */

export async function summariseSession(args: {
  history: ChatMessage[]
  previous?: string
  settings: AISettings
}): Promise<string> {
  const { settings } = args
  if (needsDemo(settings)) {
    // Offline: keep the last few lines verbatim rather than pretending to summarise.
    return args.history
      .slice(-6)
      .map((m) => `${m.role}: ${m.parts.map((p) => (p.type === 'text' ? p.text : '[photo]')).join(' ')}`)
      .join('\n')
      .slice(0, 600)
  }
  try {
    const res = await completeAI(
      {
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        messages: buildSummaryMessages(args.history, args.previous),
        temperature: 0.2,
        maxTokens: 400,
      },
      settings,
    )
    return res.text.trim().slice(0, 900)
  } catch {
    return args.previous ?? ''
  }
}

/* ------------------------------------------------------------------ helpers */

export function emptyAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return normalizeAnalysis({
    title: 'New task',
    summary: '',
    steps: [],
    ...overrides,
  })
}

export function stepVoiceLines(steps: Step[], language: string) {
  return steps.map((s) => ({ id: `step-${s.n}`, text: s.voice || `${s.title}. ${s.detail}`, lang: language }))
}

export function isDemoSettings(settings: AISettings) {
  return needsDemo(settings)
}

export { DEFAULT_SETTINGS }

/** Convenience re-export so UI code has one import for evidence handling. */
export type { EvidencePart, ChatMessage }
export { extractJson }
