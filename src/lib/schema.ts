/**
 * The app's domain schema.
 *
 * Everything the assistant produces funnels into `AnalysisResult`. Models are
 * unreliable narrators, so `normalizeAnalysis()` coerces whatever comes back —
 * missing keys, stringified numbers, single objects where arrays were expected —
 * into a shape the UI can render without defensive checks everywhere.
 */

export type TaskMode =
  | 'cook'
  | 'use'
  | 'fix'
  | 'troubleshoot'
  | 'identify'
  | 'assemble'
  | 'clean'
  | 'install'
  | 'learn'
  | 'software'
  | 'safety'
  | 'other'

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type SkillLevel = 'beginner' | 'normal' | 'detailed' | 'expert'

export const RISK_ORDER: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical']

export interface DetectedObject {
  label: string
  confidence: number
  category: string
  img: number
  /** [x, y, w, h] normalised 0..1, top-left origin */
  box: [number, number, number, number] | null
  note?: string
}

export type AnnotationKind = 'circle' | 'arrow' | 'box' | 'label' | 'highlight' | 'line'

export interface Annotation {
  id: string
  kind: AnnotationKind
  /** anchor point, normalised 0..1 with a top-left origin */
  x: number
  y: number
  /** size for box/highlight/circle, normalised */
  w?: number
  h?: number
  /** degrees, 0 = pointing right, -90 = pointing up */
  angle?: number
  label: string
  detail?: string
  /** 1-based step this annotation belongs to */
  step?: number
  img: number
  /** visual emphasis — 'danger' turns it red */
  tone?: 'default' | 'danger' | 'success'
}

export interface SafetyFlag {
  id: string
  hazard:
    | 'electricity'
    | 'gas'
    | 'fire'
    | 'chemical'
    | 'vehicle'
    | 'machinery'
    | 'sharp'
    | 'structural'
    | 'medical'
    | 'food'
    | 'height'
    | 'water'
    | 'pressure'
    | 'child'
    | 'other'
  level: RiskLevel
  message: string
  precaution?: string
  /** hard stop — the assistant will not walk the user through this */
  stop: boolean
  /** hand this to a professional */
  escalate: boolean
}

export type DiagramPosition = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'
export type DiagramKind = 'button' | 'dial' | 'lever' | 'display' | 'label' | 'drawer' | 'door' | 'tool'

/**
 * A generic schematic cue: "the round POWER button, top-left of the panel".
 * Used when we know *what* a control is but cannot locate it in the user's photo —
 * it illustrates the description instead of pretending to read the image.
 */
export interface StepDiagram {
  label: string
  position: DiagramPosition
  kind: DiagramKind
}

export interface Step {
  n: number
  title: string
  detail: string
  why?: string
  tip?: string
  durationSec?: number
  tools?: string[]
  /** how the user knows it worked */
  check?: string
  annotationIds: string[]
  risk: RiskLevel
  /** short spoken form for hands-free mode */
  voice?: string
  diagram?: StepDiagram
}

export interface Recipe {
  name: string
  tagline?: string
  cuisine?: string
  minutes?: number
  difficulty?: Difficulty
  servings?: number
  ingredients: { item: string; quantity?: string; have?: boolean; optional?: boolean; substitute?: string }[]
  usesWhatYouHave: string[]
  /** required items the user does not have */
  missing: string[]
  /** optional extras they lack — the dish still works, but it is better with these */
  niceToHave: string[]
  equipment: string[]
  steps: Step[]
  notes?: string
  costZar?: number
}

export interface VideoRef {
  id: string
  title: string
  channel?: string
  url: string
  thumbnail?: string
  durationText?: string
  /** why this is relevant to *this* situation */
  why: string
  query: string
  matchScore?: number
  chapters?: { t: string; label: string }[]
}

export interface FollowUpQuestion {
  id: string
  question: string
  kind: 'yes_no' | 'choice' | 'multi_choice' | 'number' | 'text'
  options: string[]
  why?: string
  important: boolean
}

export interface MissingItem {
  item: string
  why?: string
  optional?: boolean
  estCostZar?: number
}

export interface IdentifyInfo {
  whatItIs: string
  whatItDoes: string
  howItWorks?: string
  commonMistakes: string[]
  specialTools: string[]
  safetyNotes: string[]
  alternatives: string[]
  actions: string[]
}

export interface TroubleshootInfo {
  system: string
  observations: string[]
  likelyCauses: { cause: string; likelihood: number; fix: string; diy: boolean }[]
}

export interface SoftwareInfo {
  app?: string
  path: string[]
  notes: string[]
}

export interface Substitution {
  missing: string
  use: string
  note?: string
}

export interface KnowledgeNote {
  claim: string
  why?: string
  confidence?: 'high' | 'medium' | 'low'
}

export interface AnalysisResult {
  situation: string
  intent: TaskMode
  confidence: number
  objects: DetectedObject[]
  sceneSummary?: string

  title: string
  summary: string
  difficulty: Difficulty
  timeEstimateMin?: number
  tools: string[]
  materials: string[]
  safety: SafetyFlag[]
  annotations: Annotation[]
  steps: Step[]
  followUpQuestions: FollowUpQuestion[]
  videos: VideoRef[]
  recipes: Recipe[]
  identify?: IdentifyInfo
  troubleshoot?: TroubleshootInfo
  software?: SoftwareInfo
  substitutions: Substitution[]
  missingItems: MissingItem[]
  progressLabels: string[]
  knowledge: KnowledgeNote[]
  askMeNext: string[]
  voiceScript: string
  simpleExplanation: string
  detailedExplanation: string
  /** true when this came from the offline demo engine, not a real model */
  demo: boolean
}

export const INTENT_LABELS: Record<TaskMode, string> = {
  cook: 'Cook it',
  use: 'Use it',
  fix: 'Fix it',
  troubleshoot: 'Fix it',
  identify: 'Understand it',
  assemble: 'Assemble it',
  clean: 'Clean it',
  install: 'Install it',
  learn: 'Learn it',
  software: 'Navigate it',
  safety: 'Stay safe',
  other: 'Help me',
}

export const INTENT_ICONS: Record<TaskMode, string> = {
  cook: '🍳',
  use: '🎛️',
  fix: '🔧',
  troubleshoot: '🩺',
  identify: '🔍',
  assemble: '📦',
  clean: '🧽',
  install: '🛠️',
  learn: '🎓',
  software: '💻',
  safety: '⚠️',
  other: '💬',
}

export const RISK_META: Record<RiskLevel, { label: string; colour: string; bg: string; border: string }> = {
  none: { label: 'Low risk', colour: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  low: { label: 'Low risk', colour: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  medium: { label: 'Take care', colour: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  high: { label: 'High risk', colour: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  critical: { label: 'Dangerous', colour: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
}

export function highestRisk(flags: SafetyFlag[]): RiskLevel {
  let worst: RiskLevel = 'none'
  for (const f of flags) if (RISK_ORDER.indexOf(f.level) > RISK_ORDER.indexOf(worst)) worst = f.level
  return worst
}

/* ------------------------------------------------------------------ coercion */

const RISKS: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical']
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']
const KINDS: AnnotationKind[] = ['circle', 'arrow', 'box', 'label', 'highlight', 'line']
const MODES: TaskMode[] = [
  'cook', 'use', 'fix', 'troubleshoot', 'identify', 'assemble',
  'clean', 'install', 'learn', 'software', 'safety', 'other',
]
const HAZARDS: SafetyFlag['hazard'][] = [
  'electricity', 'gas', 'fire', 'chemical', 'vehicle', 'machinery', 'sharp',
  'structural', 'medical', 'food', 'height', 'water', 'pressure', 'child', 'other',
]

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean).join(' ')
  return fallback
}
function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const m = v.replace(',', '.').match(/-?\d+(\.\d+)?/)
    if (m) return Number(m[0])
  }
  return fallback
}
function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
function bool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.toLowerCase()
    if (['true', 'yes', 'y', '1'].includes(s)) return true
    if (['false', 'no', 'n', '0'].includes(s)) return false
  }
  if (typeof v === 'number') return v !== 0
  return fallback
}
function arr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v === null || v === undefined || v === '') return []
  return [v]
}
function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, '_')
  const hit = allowed.find((a) => a === s)
  if (hit) return hit
  // tolerate near-misses like "very high" → high
  const partial = allowed.find((a) => s.includes(a))
  return partial ?? fallback
}
function strList(v: unknown, limit = 24): string[] {
  return arr(v)
    .map((x) => (typeof x === 'string' ? x : str(asRecord(x).name ?? asRecord(x).item ?? asRecord(x).label ?? x)))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit)
}

/* ------------------------------------------------------------------ normalisers */

export function normalizeAnnotation(raw: unknown, idx: number, imageCount = 1): Annotation | null {
  const r = asRecord(raw)
  const label = str(r.label ?? r.text ?? r.title)
  if (!label && r.x === undefined) return null
  const x = clamp01(num(r.x ?? r.cx, 0.5))
  const y = clamp01(num(r.y ?? r.cy, 0.5))
  return {
    id: str(r.id) || `a${idx + 1}`,
    kind: pick(r.kind ?? r.type, KINDS, 'circle'),
    x,
    y,
    w: r.w !== undefined || r.width !== undefined ? clamp01(num(r.w ?? r.width, 0.2)) : undefined,
    h: r.h !== undefined || r.height !== undefined ? clamp01(num(r.h ?? r.height, 0.2)) : undefined,
    angle: r.angle !== undefined ? num(r.angle, 0) : undefined,
    label: label || 'Look here',
    detail: str(r.detail ?? r.note) || undefined,
    step: r.step !== undefined ? Math.max(1, Math.round(num(r.step, 1))) : undefined,
    img: Math.max(0, Math.min(imageCount - 1, Math.round(num(r.img ?? r.image ?? r.imageIndex, 0)))),
    tone: /danger|warn/i.test(str(r.tone)) ? 'danger' : /success|ok/i.test(str(r.tone)) ? 'success' : 'default',
  }
}

export function normalizeStep(raw: unknown, idx: number): Step | null {
  const r = asRecord(raw)
  const title = str(r.title ?? r.name ?? r.action)
  const detail = str(r.detail ?? r.description ?? r.body ?? r.text)
  if (!title && !detail) return null
  return {
    n: Math.max(1, Math.round(num(r.n ?? r.step ?? r.number, idx + 1))),
    title: title || `Step ${idx + 1}`,
    detail,
    why: str(r.why) || undefined,
    tip: str(r.tip ?? r.hint) || undefined,
    durationSec: r.durationSec !== undefined || r.seconds !== undefined
      ? Math.max(0, Math.round(num(r.durationSec ?? r.seconds, 0)))
      : undefined,
    tools: strList(r.tools, 8),
    check: str(r.check ?? r.done ?? r.verify) || undefined,
    annotationIds: strList(r.annotationIds ?? r.annotations, 8),
    risk: pick(r.risk ?? r.level, RISKS, 'none'),
    voice: str(r.voice ?? r.spoken) || undefined,
    diagram: normalizeDiagram(r.diagram ?? (r.diagramPosition ? { position: r.diagramPosition, label: r.diagramLabel } : undefined)),
  }
}

const DIAGRAM_POSITIONS: DiagramPosition[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']
const DIAGRAM_KINDS: DiagramKind[] = ['button', 'dial', 'lever', 'display', 'label', 'drawer', 'door', 'tool']

function normalizeDiagram(raw: unknown): StepDiagram | undefined {
  const d = asRecord(raw)
  const label = str(d.label ?? d.name)
  if (!label) return undefined
  return {
    label,
    position: pick(d.position ?? d.at ?? d.where, DIAGRAM_POSITIONS, 'mc'),
    kind: pick(d.kind ?? d.type, DIAGRAM_KINDS, 'button'),
  }
}

export function normalizeSafety(raw: unknown, idx: number): SafetyFlag | null {
  const r = asRecord(raw)
  const message = str(r.message ?? r.note ?? r.description)
  if (!message) return null
  return {
    id: str(r.id) || `s${idx + 1}`,
    hazard: pick(r.hazard ?? r.type ?? r.category, HAZARDS, 'other'),
    level: pick(r.level ?? r.severity ?? r.risk, RISKS, 'medium'),
    message,
    precaution: str(r.precaution ?? r.action) || undefined,
    stop: bool(r.stop ?? r.hardStop, false),
    escalate: bool(r.escalate ?? r.professional, false),
  }
}

export function normalizeObject(raw: unknown, idx: number, imageCount = 1): DetectedObject | null {
  const r = asRecord(raw)
  const label = str(r.label ?? r.name ?? r.object)
  if (!label) return null
  let box: DetectedObject['box'] = null
  const b = arr(r.box).map((v) => num(v, NaN))
  // accept [x, y, w, h] (ours) or [ymin, xmin, ymax, xmax] (Gemini's box_2d, 0-1000)
  if (b.length === 4 && b.every((v) => Number.isFinite(v))) {
    const big = b.some((v) => v > 1.0001)
    const norm = big ? b.map((v) => v / 1000) : b
    const looksLikeYxyx = big || (norm[0] <= 1 && norm[1] <= 1 && norm[3] > norm[1] && norm[2] > norm[0])
    box = looksLikeYxyx && !r.boxW
      ? [clamp01(norm[1]), clamp01(norm[0]), clamp01(norm[3] - norm[1]), clamp01(norm[2] - norm[0])]
      : [clamp01(norm[0]), clamp01(norm[1]), clamp01(norm[2]), clamp01(norm[3])]
  }
  return {
    label,
    confidence: clamp01(num(r.confidence ?? r.score, 0.7)),
    category: str(r.category ?? r.type, 'object'),
    img: Math.max(0, Math.min(imageCount - 1, Math.round(num(r.img ?? r.image, 0)))),
    box,
    note: str(r.note) || undefined,
  }
}

function normalizeRecipe(raw: unknown, idx: number): Recipe | null {
  const r = asRecord(raw)
  const name = str(r.name ?? r.title)
  if (!name) return null
  return {
    name,
    tagline: str(r.tagline ?? r.description) || undefined,
    cuisine: str(r.cuisine) || undefined,
    minutes: r.minutes !== undefined ? Math.round(num(r.minutes, 0)) : undefined,
    difficulty: pick(r.difficulty, DIFFS, 'easy'),
    servings: r.servings !== undefined ? Math.round(num(r.servings, 2)) : 2,
    ingredients: arr(r.ingredients)
      .map((i): Recipe['ingredients'][number] | null => {
        const o = asRecord(i)
        const item = typeof i === 'string' ? i : str(o.item ?? o.name ?? o.ingredient)
        if (!item) return null
        return {
          item,
          quantity: str(o.quantity ?? o.amount) || undefined,
          have: o.have === undefined ? undefined : bool(o.have),
          optional: bool(o.optional, false),
          substitute: str(o.substitute ?? o.alternative) || undefined,
        }
      })
      .filter((x): x is Recipe['ingredients'][number] => x !== null),
    usesWhatYouHave: strList(r.usesWhatYouHave ?? r.uses, 20),
    missing: strList(r.missing ?? r.missingItems, 20),
    niceToHave: strList(r.niceToHave ?? r.recommended, 20),
    equipment: strList(r.equipment ?? r.tools, 12),
    steps: arr(r.steps).map((s, i) => normalizeStep(s, i)).filter(Boolean) as Step[],
    notes: str(r.notes ?? r.tip) || undefined,
    costZar: r.costZar !== undefined ? Math.round(num(r.costZar, 0)) : undefined,
  }
}

function normalizeVideo(raw: unknown, idx: number): VideoRef | null {
  const r = asRecord(raw)
  const url = str(r.url ?? r.link)
  const title = str(r.title ?? r.name)
  if (!title && !url) return null
  return {
    id: str(r.id) || `v${idx + 1}`,
    title: title || 'Watch a demonstration',
    channel: str(r.channel ?? r.author) || undefined,
    url: url || `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`,
    thumbnail: str(r.thumbnail ?? r.thumb) || undefined,
    durationText: str(r.durationText ?? r.duration) || undefined,
    why: str(r.why ?? r.reason) || 'Demonstrates the same kind of task.',
    query: str(r.query) || title,
    matchScore: r.matchScore !== undefined ? clamp01(num(r.matchScore, 0.6)) : undefined,
    chapters: arr(r.chapters)
      .map((c) => {
        const o = asRecord(c)
        const label = str(o.label ?? o.title)
        const t = str(o.t ?? o.time ?? o.at)
        return label || t ? { t: t || '', label: label || '' } : null
      })
      .filter(Boolean) as { t: string; label: string }[],
  }
}

function normalizeFollowUp(raw: unknown, idx: number): FollowUpQuestion | null {
  const r = asRecord(raw)
  const question = str(r.question ?? r.q ?? r.text)
  if (!question) return null
  const options = strList(r.options ?? r.choices, 8)
  const kindRaw = str(r.kind ?? r.type).toLowerCase()
  let kind: FollowUpQuestion['kind'] = 'text'
  if (kindRaw.includes('yes') || /^(is|do|does|are|can|have|was|will|should|did)\b/i.test(question)) kind = 'yes_no'
  if (kindRaw.includes('multi')) kind = 'multi_choice'
  else if (kindRaw.includes('choice') || options.length > 2) kind = 'choice'
  if (kind === 'text' && options.length === 2) kind = 'choice'
  return {
    id: str(r.id) || `q${idx + 1}`,
    question,
    kind,
    options: kind === 'yes_no' ? ['Yes', 'No'] : options,
    why: str(r.why) || undefined,
    important: bool(r.important, idx < 2),
  }
}

/* ------------------------------------------------------------------ main */

export function normalizeAnalysis(raw: unknown, imageCount = 1): AnalysisResult {
  const r = asRecord(raw)
  const recipes = arr(r.recipes).map((x, i) => normalizeRecipe(x, i)).filter(Boolean) as Recipe[]
  const steps = arr(r.steps).map((x, i) => normalizeStep(x, i)).filter(Boolean) as Step[]
  const annotations = arr(r.annotations)
    .map((x, i) => normalizeAnnotation(x, i, imageCount))
    .filter(Boolean) as Annotation[]

  const ident = asRecord(r.identify)
  const ts = asRecord(r.troubleshoot)
  const sw = asRecord(r.software)

  const intent = pick(r.intent ?? r.mode ?? r.category, MODES, recipes.length ? 'cook' : 'other')
  const allSteps = steps.length ? steps : (recipes[0]?.steps ?? [])

  const out: AnalysisResult = {
    situation: str(r.situation ?? r.understood) || str(r.summary).slice(0, 160),
    intent,
    confidence: clamp01(num(r.confidence, 0.75)),
    objects: arr(r.objects ?? r.detected).map((x, i) => normalizeObject(x, i, imageCount)).filter(Boolean) as DetectedObject[],
    sceneSummary: str(r.sceneSummary ?? r.scene) || undefined,

    title: str(r.title ?? r.name) || 'Here is what I found',
    summary: str(r.summary ?? r.explanation ?? r.description),
    difficulty: pick(r.difficulty, DIFFS, 'easy'),
    timeEstimateMin: r.timeEstimateMin !== undefined || r.timeMinutes !== undefined
      ? Math.max(0, Math.round(num(r.timeEstimateMin ?? r.timeMinutes, 0)))
      : undefined,
    tools: strList(r.tools, 24),
    materials: strList(r.materials, 24),
    safety: arr(r.safety ?? r.warnings).map((x, i) => normalizeSafety(x, i)).filter(Boolean) as SafetyFlag[],
    annotations,
    steps: allSteps,
    followUpQuestions: arr(r.followUpQuestions ?? r.questions).map((x, i) => normalizeFollowUp(x, i)).filter(Boolean) as FollowUpQuestion[],
    videos: arr(r.videos).map((x, i) => normalizeVideo(x, i)).filter(Boolean) as VideoRef[],
    recipes,
    identify: Object.keys(ident).length
      ? {
          whatItIs: str(ident.whatItIs ?? ident.what ?? ident.identification),
          whatItDoes: str(ident.whatItDoes ?? ident.purpose ?? ident.use),
          howItWorks: str(ident.howItWorks ?? ident.how) || undefined,
          commonMistakes: strList(ident.commonMistakes ?? ident.mistakes, 12),
          specialTools: strList(ident.specialTools ?? ident.tools, 12),
          safetyNotes: strList(ident.safetyNotes ?? ident.safety, 12),
          alternatives: strList(ident.alternatives, 12),
          actions: strList(ident.actions, 10),
        }
      : undefined,
    troubleshoot: Object.keys(ts).length
      ? {
          system: str(ts.system ?? ts.item ?? r.title),
          observations: strList(ts.observations ?? ts.visible, 12),
          likelyCauses: arr(ts.likelyCauses ?? ts.causes)
            .map((c) => {
              const o = asRecord(c)
              const cause = str(o.cause ?? o.name)
              if (!cause) return null
              return { cause, likelihood: clamp01(num(o.likelihood ?? o.probability, 0.4)), fix: str(o.fix ?? o.solution), diy: bool(o.diy, true) }
            })
            .filter(Boolean) as TroubleshootInfo['likelyCauses'],
        }
      : undefined,
    software: Object.keys(sw).length
      ? {
          app: str(sw.app ?? sw.application) || undefined,
          path: strList(sw.path ?? sw.sequence, 12),
          notes: strList(sw.notes, 10),
        }
      : undefined,
    substitutions: arr(r.substitutions).map((s) => {
      const o = asRecord(s)
      const missing = str(o.missing ?? o.item ?? (typeof s === 'string' ? s : ''))
      return missing ? { missing, use: str(o.use ?? o.substitute ?? o.alternative), note: str(o.note) || undefined } : null
    }).filter(Boolean) as Substitution[],
    missingItems: arr(r.missingItems ?? r.missing).map((m) => {
      const o = asRecord(m)
      const item = typeof m === 'string' ? m : str(o.item ?? o.name)
      if (!item) return null
      return { item, why: str(o.why) || undefined, optional: bool(o.optional, false), estCostZar: o.estCostZar !== undefined ? Math.round(num(o.estCostZar, 0)) : undefined }
    }).filter(Boolean) as MissingItem[],
    progressLabels: strList(r.progressLabels ?? r.progress, 16),
    knowledge: arr(r.knowledge ?? r.facts).map((k) => {
      const o = asRecord(k)
      const claim = typeof k === 'string' ? k : str(o.claim ?? o.fact ?? o.title)
      if (!claim) return null
      return { claim, why: str(o.why ?? o.detail) || undefined, confidence: pick(o.confidence, ['high', 'medium', 'low'] as const, 'medium') as KnowledgeNote['confidence'] }
    }).filter(Boolean) as KnowledgeNote[],
    askMeNext: strList(r.askMeNext ?? r.suggestions, 8),
    voiceScript: str(r.voiceScript ?? r.spoken) || '',
    simpleExplanation: str(r.simpleExplanation ?? r.simple) || '',
    detailedExplanation: str(r.detailedExplanation ?? r.detailed) || '',
    demo: bool(r.demo, false),
  }

  // Backfill: never let the UI stare at nothing.
  if (!out.simpleExplanation) {
    out.simpleExplanation = out.summary
  }
  if (!out.detailedExplanation) {
    out.detailedExplanation = [out.summary, ...out.steps.map((s, i) => `${i + 1}. ${s.title}. ${s.detail}`)]
      .filter(Boolean)
      .join('\n')
  }
  if (!out.voiceScript) {
    out.voiceScript = [out.situation || out.summary, ...out.steps.slice(0, 12).map((s, i) => `Step ${i + 1}. ${s.voice || s.title}.`)]
      .filter(Boolean)
      .join(' ')
  }
  if (!out.progressLabels.length && out.steps.length) {
    out.progressLabels = out.steps.map((s) => s.title)
  }
  // Keep step numbering sane even if the model numbered things oddly.
  out.steps = out.steps.map((s, i) => ({ ...s, n: i + 1 }))
  if (!out.askMeNext.length) {
    out.askMeNext = defaultNextQuestions(out)
  }
  return out
}

function defaultNextQuestions(a: AnalysisResult): string[] {
  switch (a.intent) {
    case 'cook':
      return ['What do I do next?', "I don't have one of the ingredients", 'How long does it take?']
    case 'use':
      return ['What do I do next?', 'Which button do I press first?', 'Explain it more simply']
    case 'troubleshoot':
    case 'fix':
      return ['It still is not working', 'What should I check first?', 'Is this safe to do myself?']
    case 'identify':
      return ['How do I use it?', 'Is it safe?', 'What is it used for?']
    case 'software':
      return ['What do I click next?', 'I cannot find that option', 'Explain it more simply']
    default:
      return ['What do I do next?', 'Explain it more simply', 'Is this safe to do myself?']
  }
}
