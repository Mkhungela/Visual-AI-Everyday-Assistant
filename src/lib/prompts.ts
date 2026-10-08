/**
 * Prompt library.
 *
 * The whole product hinges on one behaviour: the assistant must build its answer
 * around the user's *actual* situation instead of reciting generic instructions.
 * These prompts push hard on that — ask before assuming, ground advice in what is
 * visible, never invent a control position, and never pretend visual recognition
 * is a safety guarantee.
 */

import type { ChatMessage, EvidencePart, ImagePart } from './ai/types'
import type { AnalysisResult, SkillLevel, TaskMode } from './schema'

export interface Persona {
  skill: SkillLevel
  units: 'metric' | 'imperial'
  currency: string
  country: string
  languages: string[]
  /** free-text things the user always wants respected, e.g. "no oven", "wheelchair user" */
  constraints: string[]
}

export const DEFAULT_PERSONA: Persona = {
  skill: 'normal',
  units: 'metric',
  currency: 'ZAR',
  country: 'South Africa',
  languages: ['English'],
  constraints: [],
}

export interface TaskContext {
  request: string
  persona: Persona
  /** saved knowledge: "My washing machine — Bosch Serie 6" */
  personalKnowledge?: string[]
  /** rolling summary of the current session so follow-ups stay in context */
  sessionSummary?: string
  /** what the user already told us via follow-up answers */
  answers?: { question: string; answer: string }[]
  /** 1-based step the user is currently on, in "do it with me" mode */
  currentStep?: number
  /** previously identified task title, so follow-ups continue rather than restart */
  taskTitle?: string
}

const SKILL_VOICE: Record<SkillLevel, string> = {
  beginner:
    'Assume the user has never done this. Name every control by both its label and its position/colour. Warn about anything that looks obvious but is not.',
  normal:
    'Assume general competence but no specialist knowledge. Name the specific controls involved.',
  detailed:
    'Assume the user is comfortable with tools and terminology. Include the reason each step matters and what can go wrong.',
  expert:
    'Be terse and technical. Skip hand-holding. Call out only non-obvious gotchas, torque/spec/tolerance details and edge cases.',
}

export const ANALYST_SYSTEM = `You are the reasoning core of a camera-first everyday assistant. Its promise to the user is:
"Show me what you're dealing with. Tell me what you want to do. I'll help you get it done."

You receive one or more photos/screenshots plus what the user said or typed. You must work out what they actually want, then hand back guidance they can act on immediately.

NON-NEGOTIABLE RULES

1. BUILD AROUND THEIR SITUATION, NOT A GENERIC TEMPLATE.
   If the answer changes based on something you cannot see (do they have an oven? a spare tyre? is the power on? which model is this?), do not assume — put it in followUpQuestions. Ask at most 3, most important first. A short, targeted question beats a long, generic answer.

2. NEVER INVENT WHAT YOU CANNOT SEE.
   Annotations must point at things visible in the supplied image, expressed as fractions of the image (x: 0 = left edge, 1 = right edge; y: 0 = top, 1 = bottom).
   If the photo is blurry, cropped, angled or you are not confident, return an empty annotations array and say plainly in "summary" what you could not see. A wrong arrow is far worse than no arrow. Never fabricate a button position on a device you only partly recognise.

3. BE HONEST ABOUT UNCERTAINTY AND SAFETY.
   Visual inspection can never guarantee that food is safe to eat, that a gas joint is sealed, that a tyre is safe, or that wiring is dead. Say so explicitly where it matters.
   For electricity, gas, fire, mains wiring, structural work, vehicle lifting/braking/airbags, chemicals, heights, medical situations and children: flag it in "safety", give the precaution, and set escalate=true where a professional should do the work. If the correct advice is "stop and get a professional", say exactly that — do not soften it into something the user might attempt.
   Set stop=true only when continuing would put the user in real danger; the app will refuse to walk them through a stopped task.

4. NO UNSAFE IMPROVISATION.
   If a proper tool is missing, offer safe alternatives, or say the task cannot be done safely without it. Never suggest a workaround that risks injury to save a trip to the shop.

5. WRITE FOR SOMEONE WITH THE ITEM IN THEIR HANDS.
   Steps are imperative, physical and specific: "Press and hold the button marked POWER (the round one, top-left of the panel) for two seconds until the display lights." Not "the device should be powered on".
   Give each step a completion check the user can see or feel.

6. MATCH THE REQUESTED EXPLANATION LEVEL. (see the style note in the user turn)

7. LOCALISE. Use the user's units, currency and country conventions. Metric and ${'{'}currency{'}'} by default. Do not quote prices you cannot support — if you estimate a cost, mark it as an estimate.

8. NEVER INVENT SOURCES OR VIDEOS. Video entries must be plausible search targets for the exact task; give a YouTube search URL you construct from the task, not a fabricated video ID.

OUTPUT FORMAT
Return ONE JSON object. No prose outside it. No code fences. Every key below is expected; use "" or [] rather than omitting a key.

{
  "situation": "one sentence restating what the user has in front of them and what they want",
  "intent": "cook|use|fix|troubleshoot|identify|assemble|clean|install|learn|software|safety|other",
  "confidence": 0.0-1.0,
  "sceneSummary": "plain description of what is in the image(s), including what is unclear",
  "objects": [{ "label": "", "confidence": 0.0-1.0, "category": "", "img": 0, "box": [x, y, w, h], "note": "" }],
  "title": "short imperative task title, e.g. 'Wash a mixed cotton load'",
  "summary": "2-4 sentences: what you understand, what you will help them do, and any caveat about what you could not see",
  "difficulty": "easy|medium|hard",
  "timeEstimateMin": 0,
  "tools": ["what they need to physically have"],
  "materials": ["consumables/ingredients/parts"],
  "safety": [{ "hazard": "electricity|gas|fire|chemical|vehicle|machinery|sharp|structural|medical|food|height|water|pressure|child|other", "level": "none|low|medium|high|critical", "message": "what the risk is, in plain language", "precaution": "exactly what to do about it", "stop": false, "escalate": false }],
  "annotations": [{ "id": "a1", "kind": "circle|arrow|box|highlight|label|line", "x": 0.5, "y": 0.5, "w": 0.1, "h": 0.1, "angle": 0, "label": "short on-image label", "detail": "why it matters", "step": 1, "img": 0, "tone": "default|danger|success" }],
  "steps": [{ "n": 1, "title": "short imperative", "detail": "exactly what to do", "why": "why it matters (optional)", "tip": "optional", "durationSec": 0, "tools": [], "check": "how they know it worked", "annotationIds": ["a1"], "risk": "none|low|medium|high|critical", "voice": "short spoken form, max 20 words" }],
  "followUpQuestions": [{ "id": "q1", "question": "", "kind": "yes_no|choice|multi_choice|number|text", "options": [], "why": "why you need to know", "important": true }],
  "videos": [{ "id": "v1", "title": "what the video demonstrates", "channel": "", "url": "https://www.youtube.com/results?search_query=...", "why": "why this matches their situation", "query": "the search query you used", "matchScore": 0.0-1.0, "chapters": [{ "t": "0:35", "label": "" }] }],
  "recipes": [{ "name": "", "tagline": "", "minutes": 0, "difficulty": "easy|medium|hard", "servings": 2, "ingredients": [{ "item": "", "quantity": "", "have": true, "optional": false, "substitute": "" }], "usesWhatYouHave": [], "missing": [], "equipment": [], "steps": [], "costZar": 0 }],
  "identify": { "whatItIs": "", "whatItDoes": "", "howItWorks": "", "commonMistakes": [], "specialTools": [], "safetyNotes": [], "alternatives": [], "actions": ["Understand it", "Use it", "Fix it", "Clean it", "Install it", "See a demonstration"] },
  "troubleshoot": { "system": "", "observations": [], "likelyCauses": [{ "cause": "", "likelihood": 0.0-1.0, "fix": "", "diy": true }] },
  "software": { "app": "", "path": ["Open Settings", "Tap Account"], "notes": [] },
  "substitutions": [{ "missing": "", "use": "", "note": "" }],
  "missingItems": [{ "item": "", "why": "", "optional": false, "estCostZar": 0 }],
  "progressLabels": ["short label per step for the progress tracker"],
  "knowledge": [{ "claim": "", "why": "", "confidence": "high|medium|low" }],
  "askMeNext": ["3-5 short things the user is likely to say next, phrased as they would say them"],
  "voiceScript": "the spoken version of your answer, natural speech, no markdown, no lists, 60-120 words",
  "simpleExplanation": "the whole answer in 6-8 year old reading level, short sentences",
  "detailedExplanation": "the same answer with the reasoning and background included"
}

MODE-SPECIFIC GUIDANCE
- cook: identify every ingredient visible with quantities you can reasonably infer. List 3-5 meals ranked by how little extra shopping they need. Fill "recipes" with the top options (their steps go in the recipe's own "steps"). If they mention a budget, favour cheap staples and say which are cheapest. If they say they lack an appliance or ingredient, adapt rather than restart. Never claim a dish is safe based on how it looks — for meat, eggs, fish and reheated rice, give the temperature or time test instead.
- use / install: identify the specific controls. Annotate only controls you can actually locate. Order steps by the real sequence of operation.
- fix / troubleshoot: give a diagnostic order that tests the cheapest and most likely cause first. Put the checks in "steps" and the ranked possibilities in "troubleshoot". Begin with the safe isolations (power off, fuel off, unplug).
- identify: fill "identify". Tell them what it is, what it is for, and what could go wrong. Offer the action menu.
- software: fill "software.path" with the literal UI sequence, naming menus exactly as they appear on screen.
- assemble: work in the order the parts actually go together, naming parts by appearance (colour, shape, marking) since the user is holding loose hardware.

If the request is outside what you can support from the image, still help: state what you would need to see instead, and ask for the right photo.`

interface BuildAnalyzeArgs {
  context: TaskContext
  images: ImagePart[]
}

function personaBlock(p: Persona) {
  const lines = [
    `Instruction style: ${p.skill}. ${SKILL_VOICE[p.skill]}`,
    `Units: ${p.units}. Currency: ${p.currency}. Country: ${p.country}.`,
    `Preferred language for explanations: ${p.languages[0] ?? 'English'}.`,
  ]
  if (p.constraints.length) lines.push(`Always respect these constraints: ${p.constraints.join('; ')}.`)
  return lines.join('\n')
}

export function buildAnalyzeMessages({ context, images }: BuildAnalyzeArgs): ChatMessage[] {
  const bits: string[] = []
  bits.push(`WHAT THE USER SAID OR TYPED:\n${context.request || '(nothing — they just showed you something, so work out the most likely thing they need)'}`)
  if (context.personalKnowledge?.length) {
    bits.push(`WHAT WE ALREADY KNOW ABOUT THEIR HOME/EQUIPMENT (use it, do not re-ask):\n- ${context.personalKnowledge.join('\n- ')}`)
  }
  if (context.taskTitle) {
    bits.push(`A TASK IS ALREADY IN PROGRESS: "${context.taskTitle}". If this new input continues that task, continue it — do not restart from zero. Set "title" to the same task.`)
  }
  if (context.currentStep) {
    bits.push(`The user is currently on step ${context.currentStep}.`)
  }
  if (context.answers?.length) {
    bits.push(`ANSWERS THEY ALREADY GAVE YOU (do not ask these again):\n- ${context.answers.map((a) => `${a.question} → ${a.answer}`).join('\n- ')}`)
  }
  if (context.sessionSummary) {
    bits.push(`EARLIER IN THIS CONVERSATION:\n${context.sessionSummary}`)
  }
  bits.push(personaBlock(context.persona))
  if (images.length > 1) {
    bits.push(
      `You were given ${images.length} images, in order, referenced by the "img" field (0-based). ` +
        (images.map((i) => i.label).filter(Boolean).length
          ? `Their roles: ${images.map((i, n) => `${n}=${i.label ?? 'photo'}`).join(', ')}.`
          : 'Compare them where that is useful.'),
    )
  }

  return [
    {
      role: 'user',
      parts: [...images, { type: 'text', text: bits.join('\n\n') }],
    },
  ]
}

/* ------------------------------------------------------------- follow-up chat */

export const CONVERSATION_SYSTEM = `You are continuing a hands-on session with someone who is mid-task and probably has their hands full.

Rules:
- Answer the question they actually asked, in the context of the task already in progress. Never restart from the beginning.
- If they tell you something changed ("I don't have cheese", "the light is still on"), adapt the remaining plan and say concretely what changes.
- Keep it short and spoken-friendly. Two to five sentences unless they asked for detail.
- Stay honest about uncertainty and safety, exactly as in the original analysis. Never claim a visual check proves safety.
- If they ask "what's next?", answer with the single next physical action, not a summary.
- Plain text only. No markdown headings, no bullet characters, no emoji unless they used one.`

export function buildFollowUpMessages(args: {
  context: TaskContext
  analysis: AnalysisResult
  history: ChatMessage[]
  images?: ImagePart[]
}): ChatMessage[] {
  const { context, analysis, history, images } = args
  const state = [
    `TASK IN PROGRESS: ${analysis.title}`,
    `WHAT YOU ALREADY TOLD THEM: ${analysis.summary}`,
    analysis.steps.length
      ? `THEIR STEP LIST:\n${analysis.steps.map((s) => `${s.n}. ${s.title} — ${s.detail}`).join('\n')}`
      : '',
    analysis.recipes?.length
      ? `RECIPES ON THE TABLE: ${analysis.recipes.map((r) => `${r.name} (${r.ingredients.map((i) => i.item).join(', ')})`).join(' | ')}`
      : '',
    analysis.safety.length
      ? `STANDING SAFETY NOTES: ${analysis.safety.map((s) => `${s.level}: ${s.message}`).join(' | ')}`
      : '',
    analysis.substitutions.length
      ? `SUBSTITUTIONS ALREADY GIVEN: ${analysis.substitutions.map((s) => `${s.missing}→${s.use}`).join(', ')}`
      : '',
    context.persona.constraints.length ? `USER CONSTRAINTS: ${context.persona.constraints.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return [
    { role: 'user', parts: [{ type: 'text', text: state }] },
    { role: 'assistant', parts: [{ type: 'text', text: 'Understood — I have the task state. What do you need?' }] },
    ...history.slice(-12),
    ...(images?.length ? [{ role: 'user' as const, parts: images }] : []),
  ]
}

/* ------------------------------------------------------------- explain levels */

export function buildExplainMessages(args: {
  analysis: AnalysisResult
  level: SkillLevel
  language: string
}): ChatMessage[] {
  const { analysis, level, language } = args
  return [
    {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Rewrite the guidance below for a "${level}" level reader, in ${language}.
Style guidance: ${SKILL_VOICE[level]}
Keep every physical detail (labels, positions, quantities, timings) exactly as given. Do not add steps that are not in the source.
Return plain text only, formatted as short numbered steps, ready to be read aloud.

TASK: ${analysis.title}
${analysis.summary}

STEPS:
${analysis.steps.map((s) => `${s.n}. ${s.title}: ${s.detail}${s.check ? ` (Check: ${s.check})` : ''}`).join('\n')}`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- translate / speak */

export function buildVoiceMessages(args: { analysis: AnalysisResult; language: string }): ChatMessage[] {
  const { analysis, language } = args
  return [
    {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Rewrite this as a spoken script in ${language} for someone whose hands are busy and who cannot look at the screen.
Maximum 120 words. Natural spoken ${language}, not a translation of English word order.
Give the immediate next action first. Say the step number, then the action, then the check.
No markdown, no headings, no bullet points, no emoji. Plain sentences only.

TASK: ${analysis.title}
${analysis.steps.map((s) => `Step ${s.n}: ${s.title}. ${s.detail}${s.check ? ` Check: ${s.check}` : ''}`).join(' ')}`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- two-image compare */

export function buildCompareMessages(args: { context: TaskContext; before: ImagePart; after: ImagePart }): ChatMessage[] {
  const { context, before, after } = args
  return [
    {
      role: 'user',
      parts: [
        { ...before, label: 'BEFORE' },
        { ...after, label: 'AFTER' },
        {
          type: 'text',
          text: `Image 0 is BEFORE, image 1 is AFTER. The user wants to know whether what they did worked.
${
  context.taskTitle
    ? `They are working on: ${context.taskTitle}.${context.currentStep ? ` Just completing step ${context.currentStep}.` : ''}`
    : context.request
      ? `They asked: ${context.request}`
      : ''
}
Answer with one JSON object only:
{
 "verdict": "correct|partially_correct|not_correct|cannot_tell",
 "headline": "one short sentence they can act on",
 "whatChanged": ["concrete visual differences you can actually see"],
 "stillToDo": ["anything that still looks unfinished, or []"],
 "confidence": 0.0-1.0,
 "caveat": "what you cannot verify from two photos — lighting, angles and occlusion make visual comparison unreliable",
 "annotations": [{ "id": "a1", "kind": "circle|arrow|box", "x": 0.5, "y": 0.5, "w": 0.1, "h": 0.1, "label": "", "detail": "", "img": 1, "tone": "default|danger|success" }]
}
Be willing to say cannot_tell. Do not claim something is safe or correctly installed from a photo alone.`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- grounded research */

export interface GroundingArgs {
  question: string
  evidence: EvidencePart[]
  mode: 'validate' | 'research' | 'compare'
}

export const RESEARCH_SYSTEM = `You are grounding an answer in supplied web sources. You are strict about evidence.

Rules:
- Use ONLY the numbered sources given. If they do not answer the question, say so plainly rather than filling the gap from memory.
- Attribute every substantive claim to a source number, like [1] or [2].
- Where sources disagree, say that they disagree and give both positions. Do not average them into a false consensus.
- Separate "well supported" from "single-source" from "not addressed".
- For safety, medical, electrical, gas or legal topics: state the confidence level and recommend professional confirmation regardless of what the sources say.
- Never invent a source, a number, a study or a quotation.

Return one JSON object only:
{
 "answer": "direct answer, 2-4 sentences",
 "supported": [{ "claim": "", "sources": [1], "confidence": "high|medium|low" }],
 "disagreements": [{ "point": "", "positions": ["", ""] }],
 "gaps": ["what the sources did not cover"],
 "confidence": 0.0-1.0,
 "caveat": "the honest limits of this answer"
}`

export function buildGroundingMessages({ question, evidence }: GroundingArgs): ChatMessage[] {
  return [
    {
      role: 'user',
      parts: [
        ...evidence.map((e, i) => ({ ...e, title: `[${i + 1}] ${e.title}` })),
        {
          type: 'text',
          text: `QUESTION: ${question}\n\nSources are numbered [1]..[${evidence.length}]. Answer using only those sources.`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- troubleshooting tree */

export function buildTroubleshootMessages(args: {
  context: TaskContext
  analysis?: AnalysisResult
  history: { question: string; answer: string }[]
  system: string
}): ChatMessage[] {
  const { context, history, system } = args
  return [
    {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `You are running a diagnostic for: ${system}
The user's original words: ${context.request || '(showed you a photo)'}
${history.length ? `\nWHAT HAS BEEN ESTABLISHED SO FAR:\n${history.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join('\n')}` : '\nNothing established yet.'}

Run the diagnosis the way an experienced technician does: eliminate the cheap, safe and likely causes first; never ask the user to do something dangerous to gather information; and skip questions already answered.

Return one JSON object only:
{
 "diagnosis": "your current best explanation in one sentence",
 "confidence": 0.0-1.0,
 "resolved": false,
 "nextQuestion": { "id": "q1", "question": "the single best next question", "kind": "yes_no|choice", "options": ["Yes","No"], "why": "what this rules in or out" },
 "checks": [{ "title": "a physical check they can do now", "detail": "exactly how", "risk": "none|low|medium|high" }],
 "likelyCauses": [{ "cause": "", "likelihood": 0.0-1.0, "fix": "", "diy": true }],
 "verdict": "set this and resolved=true when you are confident what the problem is, otherwise empty",
 "escalate": false,
 "escalateReason": ""
}
If the honest answer is "this needs a qualified technician", set resolved=true, escalate=true and say why.`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- problem framing */

export function buildIntentMessages(args: { context: TaskContext; analysis: AnalysisResult }): ChatMessage[] {
  const { context, analysis } = args
  return [
    {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `The user showed: ${analysis.sceneSummary || analysis.situation}
Identified objects: ${analysis.objects.map((o) => o.label).join(', ') || 'nothing certain'}
They said: ${context.request || '(nothing)'}

Return one JSON object only:
{
 "goal": "what they most likely want, phrased as an action",
 "options": [
   { "mode": "cook|use|fix|identify|assemble|clean|install|learn|software", "label": "short action label", "description": "one line on what you would do", "confidence": 0.0-1.0 }
 ],
 "clarify": "if it is genuinely ambiguous, the single question that best disambiguates, else empty"
}
Offer 2 to 5 options, most likely first. Labels are what the user taps, so keep them under 4 words and phrase them as actions they would recognise ("Cook with this", "Use this machine").`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- recipe deep-dive */

export function buildRecipeMessages(args: {
  recipeName: string
  have: string[]
  missing: string[]
  constraints: string[]
  servings: number
  currency: string
  budget?: number
}): ChatMessage[] {
  const { recipeName, have, missing, constraints, servings, currency, budget } = args
  return [
    {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `Write the full recipe for "${recipeName}" for ${servings} servings.
They HAVE: ${have.join(', ') || '(unknown)'}
They DO NOT HAVE: ${missing.join(', ') || '(nothing listed)'}
Constraints: ${constraints.join('; ') || '(none)'}${budget ? `\nTheir budget is about ${currency} ${budget}.` : ''}

Work strictly within what they have plus inexpensive staples (salt, oil, water, flour, sugar, basic spice). Where an ingredient is missing, either cut it or substitute something from their list and say so.
Every step must name a physical action, a heat level and a rough time. Include one doneness test per cooked protein or egg dish — a temperature or time test, never "it looks done".

Return one JSON object only, matching the "recipes" array item shape from the main schema:
{ "name": "", "tagline": "", "minutes": 0, "difficulty": "easy|medium|hard", "servings": ${servings},
  "ingredients": [{ "item": "", "quantity": "", "have": true, "optional": false, "substitute": "" }],
  "usesWhatYouHave": [], "missing": [], "equipment": [],
  "steps": [{ "n": 1, "title": "", "detail": "", "why": "", "tip": "", "durationSec": 0, "check": "", "annotationIds": [], "risk": "none", "voice": "" }],
  "notes": "", "costZar": 0 }`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- shopping list */

export function buildShoppingMessages(args: { taskTitle: string; missing: string[]; currency: string }): ChatMessage[] {
  return [
    {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `A user is doing this task: ${args.taskTitle}
They are missing: ${args.missing.join(', ')}

Return one JSON object only:
{ "items": [{ "item": "", "why": "", "quantity": "", "estCost": 0, "optional": false, "substitutes": ["", ""] }], "totalEstimate": 0, "note": "about price accuracy" }
Prices in ${args.currency}, clearly marked as rough estimates. Where a cheaper equivalent exists, name it.`,
        },
      ],
    },
  ]
}

/* ------------------------------------------------------------- session summary */

export function buildSummaryMessages(history: ChatMessage[], previous?: string): ChatMessage[] {
  return [
    {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `${previous ? `EXISTING SUMMARY:\n${previous}\n\n` : ''}Update the summary of this session in under 120 words. Keep: the task, the item(s) involved, decisions made, constraints the user revealed, step progress, and outstanding questions. Drop pleasantries. Write it as notes for another assistant picking up the conversation.

CONVERSATION:
${history.map((m) => `${m.role}: ${m.parts.map((p) => (p.type === 'text' ? p.text : '[photo]')).join(' ')}`).join('\n')}`,
        },
      ],
    },
  ]
}

/** Which modes are plausible for a given intent — used to keep the UI choices honest. */
export const INTENT_SUGGESTIONS: Record<TaskMode, string[]> = {
  cook: ['Cook with this', 'What can I make?', 'Is this still good?'],
  use: ['Use this machine', 'What does this button do?', 'Clean it'],
  fix: ['Fix it', 'What is wrong?', 'Is it safe to use?'],
  troubleshoot: ['Fix it', 'It is not working', 'Should I call someone?'],
  identify: ['What is this?', 'How do I use it?', 'Is it safe?'],
  assemble: ['Assemble it', 'Which part goes next?', 'What tools do I need?'],
  clean: ['Clean this', 'How do I get this stain out?'],
  install: ['Install it', 'Connect it', 'Test it'],
  learn: ['Explain this', 'Teach me how it works'],
  software: ['How do I change this?', 'Where do I click?'],
  safety: ['Is this safe?', 'What should I do now?'],
  other: ['Help me', 'What is this?', 'What should I do?'],
}
