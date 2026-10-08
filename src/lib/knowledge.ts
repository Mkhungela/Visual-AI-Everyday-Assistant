/**
 * Personal knowledge.
 *
 * "My washing machine", "my car", "my kitchen". The point is that the user should
 * never have to explain their own house twice — so anything they save here is fed
 * into every prompt as context the model must use rather than re-ask about.
 */

import type { ChatMessage } from './ai/types'
import type { AnalysisResult } from './schema'
import type { KnowledgeEntry } from './store'

/** Short, prompt-ready lines. Capped so a big library never crowds out the question. */
export function knowledgeForPrompt(entries: KnowledgeEntry[], limit = 14): string[] {
  return entries
    .slice(0, limit)
    .map((e) => `${labelFor(e.kind)}: ${e.name}${e.detail ? ` — ${e.detail}` : ''}`)
    .filter(Boolean)
}

export function labelFor(kind: KnowledgeEntry['kind']): string {
  switch (kind) {
    case 'appliance':
      return 'Appliance'
    case 'vehicle':
      return 'Vehicle'
    case 'tool':
      return 'Tool'
    case 'kitchen':
      return 'Kitchen'
    case 'home':
      return 'Home'
    default:
      return 'Note'
  }
}

export const KNOWLEDGE_ICON: Record<KnowledgeEntry['kind'], string> = {
  appliance: '🔌',
  vehicle: '🚗',
  tool: '🔧',
  kitchen: '🍳',
  home: '🏠',
  other: '📝',
}

/** Just the kitchen entries, expanded into a flat ingredient list. */
export function buildKitchenContext(entries: KnowledgeEntry[]): string[] {
  const out: string[] = []
  for (const e of entries) {
    if (e.kind !== 'kitchen') continue
    out.push(
      ...e.detail
        .split(/[,\n;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 40),
    )
  }
  return [...new Set(out)]
}

/** Appliance and vehicle detail collapsed into equipment names we can reason about. */
export function buildEquipmentContext(entries: KnowledgeEntry[]): string[] {
  const out: string[] = []
  for (const e of entries) {
    if (e.kind === 'appliance' || e.kind === 'tool') out.push(e.name)
  }
  return [...new Set(out)]
}

/**
 * Seed the model's conversation history with the analysis, so a follow-up like
 * "I don't have cheese" is understood as being about the recipe already in play.
 */
export function analysisToChatHistory(analysis: AnalysisResult): ChatMessage[] {
  const lines = [
    `You showed me: ${analysis.sceneSummary || analysis.situation}`,
    analysis.objects.length ? `What I could identify: ${analysis.objects.map((o) => o.label).join(', ')}` : '',
    '',
    `TASK: ${analysis.title}`,
    analysis.summary,
  ].filter(Boolean)

  if (analysis.steps.length) {
    lines.push('', 'STEPS:', ...analysis.steps.map((s) => `${s.n}. ${s.title} — ${s.detail}`))
  }
  if (analysis.recipes.length) {
    lines.push(
      '',
      'MEALS I SUGGESTED:',
      ...analysis.recipes.map(
        (r) => `${r.name} (${r.minutes ?? '?'} min) — uses ${r.usesWhatYouHave.join(', ') || 'what you have'}${r.missing.length ? `; missing ${r.missing.join(', ')}` : ''}`,
      ),
    )
  }
  if (analysis.safety.length) {
    lines.push('', 'SAFETY:', ...analysis.safety.map((s) => `${s.level}: ${s.message}`))
  }

  return [
    { role: 'user', parts: [{ type: 'text', text: lines.join('\n') }] },
    {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `Understood — this is the task in progress: “${analysis.title}”. I will keep every answer in this context rather than starting over.`,
        },
      ],
    },
  ]
}

/** A one-line summary of a saved task for lists. */
export function summariseSave(analysis: AnalysisResult) {
  const bits: string[] = []
  if (analysis.steps.length) bits.push(`${analysis.steps.length} steps`)
  if (analysis.recipes.length) bits.push(`${analysis.recipes.length} meals`)
  if (analysis.timeEstimateMin) bits.push(`${analysis.timeEstimateMin} min`)
  if (analysis.difficulty) bits.push(analysis.difficulty)
  return bits.join(' · ')
}
