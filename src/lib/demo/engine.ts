/**
 * The offline engine.
 *
 * Runs when no AI key is configured. It is honest about what it can and cannot do:
 * it never claims to have seen the photo, and it never invents a control position.
 * What it *does* do is genuinely useful work — it reads the request text properly,
 * reasons over a real ingredient and equipment vocabulary, honours budget and
 * appliance constraints, and returns a full, actionable answer.
 */

import { imageStats } from '../images'
import {
  EQUIPMENT,
  PANTRY,
  estimateCost,
  findSubstitutes,
  matchRecipes,
  materialiseRecipe,
  parseBudget,
  parseEquipment,
  parseIngredients,
  parseNegations,
  SEASONAL_HINTS,
  type MealMatch,
} from './food'
import { SCENARIOS, pickScenario, toSteps, safety, type Scenario } from './scenarios'
import {
  normalizeAnalysis,
  type AnalysisResult,
  type FollowUpQuestion,
  type Recipe,
  type SafetyFlag,
} from '../schema'
import { sameIngredient } from '../utils'
import type { Attachment } from '../store'
import type { Persona } from '../prompts'

export type VisualCategory =
  | 'food'
  | 'appliance'
  | 'vehicle'
  | 'tool'
  | 'screen'
  | 'document'
  | 'plant'
  | 'clothing'
  | 'room'
  | 'unknown'

export interface VisualRead {
  category: VisualCategory
  /** plain-English description of the on-device read, shown to the user */
  note: string
  bright: boolean
  dark: boolean
  lowContrast: boolean
  portrait: boolean
}

/**
 * A deliberately simple, entirely on-device read of the image.
 * It is a colour and shape heuristic, not object recognition — and it says so.
 */
export async function readImage(dataUrl: string): Promise<VisualRead> {
  const stats = await imageStats(dataUrl)
  const { r, g, b, luminance, contrast, aspect } = stats
  const greenDominant = g > r * 1.12 && g > b * 1.12
  const warmDominant = r > b * 1.25 && r > 100
  const veryLight = luminance > 176
  const symmetrical = contrast < 34

  let category: VisualCategory = 'unknown'
  let note = 'I looked at the shape, brightness and colour balance of the photo.'

  if (veryLight && aspect < 1.6 && contrast > 40) {
    category = 'document'
    note = 'This looks like a mostly light, high-contrast, page-shaped image — a document or a form.'
  } else if (veryLight && aspect >= 1.4) {
    category = 'screen'
    note = 'This looks like a bright, wide, high-contrast image — likely a screenshot or a screen.'
  } else if (greenDominant) {
    category = 'plant'
    note = 'Green dominates this image, which usually means foliage or plants.'
  } else if (warmDominant && contrast > 28) {
    category = 'food'
    note = 'Warm reds and browns dominate, which usually means food or a cooked dish.'
  } else if (stats.dark && symmetrical) {
    category = 'appliance'
    note = 'This is dark and fairly uniform — typical of an appliance panel or a device.'
  } else if (contrast > 55) {
    category = 'tool'
    note = 'High contrast with definite edges — often a tool, a part or hardware.'
  } else if (aspect > 1.3 && contrast > 36) {
    category = 'vehicle'
    note = 'A wide, detailed image — that is often a dashboard or the outside of a vehicle.'
  }

  return {
    category,
    note: `${note} That is a rough on-device guess, not recognition.`,
    bright: stats.bright,
    dark: stats.dark,
    lowContrast: contrast < 30,
    portrait: aspect < 1,
  }
}

const FOOD_WORDS = /\b(cook|make|meal|eat|hungry|dinner|supper|lunch|breakfast|recipe|food|ingredient|kitchen|bake|fry|braai)\b/i

export interface DemoInput {
  request: string
  attachments: Attachment[]
  persona: Persona
  /** the user's saved kitchen list and appliance notes */
  kitchen: string[]
  equipment: string[]
  sessionSummary?: string
  answers?: { question: string; answer: string }[]
}

/** Turn yes/no answers into something the parser can understand. */
export function answersToText(answers: { question: string; answer: string }[]) {
  const bits: string[] = []
  for (const { question, answer } of answers) {
    const q = question.toLowerCase()
    const a = answer.toLowerCase().trim()
    const entity = findEntity(q)
    if (!entity) {
      bits.push(`${question} ${answer}`)
      continue
    }
    if (/^(no|nope|none|not really)$/.test(a)) bits.push(`I don't have ${entity}`)
    else if (/^(yes|yep|yeah|y)$/.test(a)) bits.push(`I have ${entity}`)
    else bits.push(`${question} ${answer}`)
  }
  return bits.join('. ')
}

function findEntity(text: string): string | null {
  for (const item of PANTRY) {
    if (text.includes(item.name)) return item.name
    for (const a of item.aliases) if (text.includes(a)) return item.name
  }
  for (const eq of EQUIPMENT) {
    if (text.includes(eq.name)) return eq.name
    for (const a of eq.aliases) if (text.includes(a)) return eq.name
  }
  return null
}

const GENERIC_FOOD_SAFETY: SafetyFlag[] = [
  safety(
    'food',
    'medium',
    'You cannot tell whether meat, chicken, fish or eggs are safely cooked by looking at them.',
    'Use a temperature or a time test: chicken 74 °C in the thickest part, mince and sausages 71 °C, fish until it flakes and is opaque. Reheated rice should be steaming hot all the way through and eaten within an hour.',
  ),
  safety(
    'food',
    'low',
    'Leftovers should cool quickly and be refrigerated within two hours.',
    'Split big pots into shallow containers so they cool fast — a deep pot of stew stays warm in the middle for hours.',
  ),
]

const KNIFE_SAFETY = safety(
  'sharp',
  'low',
  'Most kitchen injuries happen with a blunt knife, because it slips.',
  'Keep the blade sharp, cut on a stable board, and curl your fingertips back so the blade rests against your knuckles.',
)

/* ------------------------------------------------------------------ main */

export async function demoAnalyze(input: DemoInput): Promise<AnalysisResult> {
  const { request, attachments, kitchen, equipment: savedEquipment } = input

  const fullText = [request, answersToText(input.answers ?? [])].filter(Boolean).join('. ')

  let read: VisualRead | null = null
  if (attachments.length) {
    try {
      read = await readImage(attachments[0].dataUrl)
    } catch {
      read = null
    }
  }

  const mentioned = parseIngredients(fullText)
  const negated = parseNegations(fullText)
  const budget = parseBudget(fullText)
  const mentionedEquipment = parseEquipment(fullText)
  const have = dedupe([...mentioned, ...kitchen.filter((k) => !negated.some((n) => sameIngredient(n, k)))])
  const missingIngredients = negated.filter((n) => PANTRY.some((p) => sameIngredient(p.name, n)))
  const missingEquipment = negated.filter((n) => EQUIPMENT.some((e) => sameIngredient(e.name, n) || e.aliases.some((a) => sameIngredient(a, n))))

  const equipment = dedupe([...mentionedEquipment, ...savedEquipment, ...input.equipment ?? []])
  const noCook = missingEquipment.some((e) => /wood|stove|hotplate/i.test(e)) || equipment.includes('no cooking')

  const foodish =
    mentioned.length >= 1 ||
    FOOD_WORDS.test(request) ||
    read?.category === 'food' ||
    input.kitchen.length > 0 && FOOD_WORDS.test(request)

  if (foodish && (mentioned.length || read?.category === 'food' || FOOD_WORDS.test(request))) {
    return foodAnalysis({
      input,
      read,
      have,
      missing: negated,
      missingIngredients,
      missingEquipment,
      equipment,
      budget,
      noCook,
      mentionedLength: mentioned.length,
    })
  }

  const scenario = pickScenario(fullText, read?.category ?? 'unknown')
  if (scenario) return scenarioAnalysis(scenario, input, read, missingEquipment)

  return genericAnalysis(input, read)
}

function dedupe(list: string[]) {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))]
}

/* ------------------------------------------------------------------ food */

function foodAnalysis(args: {
  input: DemoInput
  read: VisualRead | null
  have: string[]
  missing: string[]
  missingIngredients: string[]
  missingEquipment: string[]
  equipment: string[]
  budget?: number
  noCook: boolean
  mentionedLength: number
}): AnalysisResult {
  const { input, read, have, missingIngredients, missingEquipment, equipment, budget, noCook, mentionedLength } = args

  const matches = matchRecipes({ have, missing: missingIngredients, equipment, budget, noCook })
  const usable = matches.filter((m) => m.score > 0.12)
  const top = usable.slice(0, 5)
  const recipes: Recipe[] = (top.length ? top : matches.slice(0, 3)).map((m) =>
    materialiseRecipe(m, { have, missing: missingIngredients, equipment }),
  )

  const missingList = dedupe([...missingIngredients, ...missingEquipment.map((e) => `${e} (appliance)`)])
  const substitutions = findSubstitutes(missingIngredients, have)

  const visualNote = read?.category === 'food'
    ? `On-device read: ${read.note}`
    : 'I am running without an AI key, so I have not analysed your photo — this answer is built from what you typed and from your saved kitchen list.'

  const noKeySummary =
    have.length > 0
      ? `Working from ${have.length} ingredient${have.length === 1 ? '' : 's'} I know you have (${have.slice(0, 8).join(', ')}${have.length > 8 ? '…' : ''}), I can put together ${recipes.length} meal${recipes.length === 1 ? '' : 's'} without you needing to shop.`
      : 'Tell me what is in the kitchen — type it, or build your kitchen list once and I will remember it.'

  const cost = estimateCost(recipes[0]?.missing ?? [])

  const questions: FollowUpQuestion[] = []
  if (mentionedLength < 3) {
    questions.push({
      id: 'q_more',
      question: 'What else do you have in the kitchen?',
      kind: 'text',
      options: [],
      why: 'Two or three more ingredients usually unlocks much better meals.',
      important: true,
    })
  }
  if (!equipment.length) {
    questions.push({
      id: 'q_equipment',
      question: 'What can you cook with right now?',
      kind: 'multi_choice',
      options: ['Stovetop', 'Oven', 'Microwave', 'Air fryer', 'Braai', 'Kettle only', 'Nothing — no power'],
      why: 'It changes the method, not the meal.',
      important: true,
    })
  }
  questions.push({
    id: 'q_people',
    question: 'How many people are you cooking for?',
    kind: 'choice',
    options: ['1', '2', '3–4', '5 or more'],
    why: 'Quantities only.',
    important: false,
  })

  const title = recipes.length
    ? `${recipes.length} meal${recipes.length === 1 ? '' : 's'} you can make right now`
    : 'What you can make with what you have'

  const summary = recipes.length
    ? `${noKeySummary} Ranked by how little extra shopping they need. ${missingList.length ? `You are short on: ${missingList.join(', ')} — I have suggested swaps for each.` : 'You have everything for the top one.'}`
    : `${noKeySummary} Tell me a few more ingredients and I will find meals that fit.`

  const followUpSteps = toSteps([
    {
      title: 'Pick a meal',
      detail: 'Tap any of the options above. I will then walk you through it step by step, with timings and doneness checks.',
    },
    {
      title: 'Check what you are missing',
      detail: missingList.length
        ? `You are short on ${missingList.join(', ')}. The substitutions below cover all of them without a trip to the shop.`
        : 'You have everything needed for the top meal.',
    },
    {
      title: 'Adjust for anything else',
      detail: 'Tell me "I do not have an oven" or "I only have R100" and I will rework the plan around it rather than starting again.',
    },
  ])

  const safetyFlags = [GENERIC_FOOD_SAFETY[0], GENERIC_FOOD_SAFETY[1], ...(recipes.some((r) => r.steps.length > 6) ? [KNIFE_SAFETY] : [])]

  return normalizeAnalysis(
    {
      situation: `You want to cook with ${have.length ? have.slice(0, 6).join(', ') : 'what is available'}${budget ? `, on a budget of about R${budget}` : ''}.`,
      intent: 'cook',
      confidence: have.length ? 0.7 : 0.4,
      sceneSummary: visualNote,
      objects: have.map((h) => ({
        label: h,
        confidence: mentionedLength ? 0.8 : 0.5,
        category: PANTRY.find((p) => sameIngredient(p.name, h))?.cat ?? 'ingredient',
        img: 0,
      })),
      title,
      summary,
      difficulty: recipes[0]?.difficulty ?? 'easy',
      timeEstimateMin: recipes[0]?.minutes ?? 25,
      tools: dedupe(recipes.flatMap((r) => r.equipment)).slice(0, 8),
      materials: have.slice(0, 16),
      safety: safetyFlags,
      annotations: [],
      steps: followUpSteps,
      followUpQuestions: questions,
      videos: [],
      recipes,
      substitutions,
      missingItems: [
        ...(recipes[0]?.missing ?? []).map((m) => ({ item: m, why: 'Needed for the top recipe', optional: false })),
        ...estimateCost(recipes[0]?.missing ?? []).lines.map((l) => ({ item: l.item, estCostZar: l.cost, why: 'Rough estimate' })),
      ].filter((v, i, arr) => arr.findIndex((x) => x.item === v.item) === i),
      progressLabels: ['Choose a meal', 'Check ingredients', 'Cook it'],
      knowledge: SEASONAL_HINTS.map((s) => ({ claim: s, confidence: 'medium' as const })),
      askMeNext: [
        'What do I do next?',
        'I do not have an oven',
        'Something cheaper please',
        'How long will that take?',
      ],
      voiceScript: recipes.length
        ? `I found ${recipes.length} meals you can make. The best fit is ${recipes[0].name} — about ${recipes[0].minutes} minutes. ${
            recipes[0].missing.length ? `You will need ${recipes[0].missing.join(' and ')}.` : 'You already have everything for it.'
          } Say which one you want and I will talk you through it.`
        : 'Tell me a few ingredients you have and I will suggest meals.',
      simpleExplanation: summary,
      detailedExplanation: [
        summary,
        '',
        ...recipes.map((r) => `${r.name} — ${r.minutes} min, ${r.difficulty}. ${r.tagline ?? ''}`),
        '',
        ...(missingList.length ? [`Missing: ${missingList.join(', ')}`] : []),
        ...substitutions.map((s) => `${s.missing}: use ${s.use}. ${s.note}`),
      ].join('\n'),
      demo: true,
    },
    1,
  )
}

/* ------------------------------------------------------------------ scenario */

function scenarioAnalysis(
  scenario: Scenario,
  input: DemoInput,
  read: VisualRead | null,
  missingEquipment: string[],
): AnalysisResult {
  const steps = toSteps(scenario.steps)
  const visualNote = read ? `On-device read: ${read.note}` : ''

  const extraSafety: SafetyFlag[] = []
  if (missingEquipment.length) {
    extraSafety.push(
      safety(
        'other',
        'low',
        `You told me you do not have: ${missingEquipment.join(', ')}.`,
        'Tell me which of these you can borrow or substitute, and I will rework the steps rather than have you improvise.',
      ),
    )
  }

  return normalizeAnalysis(
    {
      situation: scenario.situation,
      intent: scenario.intent,
      confidence: read ? 0.55 : 0.45,
      sceneSummary: [scenario.sceneSummary, visualNote].filter(Boolean).join(' '),
      objects: scenario.objects.map((o) => ({ label: o, confidence: 0.6, category: scenario.categories[0] ?? 'object', img: 0 })),
      title: scenario.title,
      summary: scenario.summary,
      difficulty: steps.length > 7 ? 'medium' : 'easy',
      timeEstimateMin: estimateMinutes(steps),
      tools: scenario.tools,
      materials: scenario.materials,
      safety: [...scenario.safety, ...extraSafety],
      annotations: [],
      steps,
      followUpQuestions: scenario.followUps ?? [],
      videos: (scenario.videos ?? []).map((v, i) => ({
        id: `v${i + 1}`,
        title: v.title,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}`,
        why: v.why,
        query: v.query,
        matchScore: 0.5,
      })),
      identify: scenario.identify,
      troubleshoot: scenario.troubleshoot,
      software: scenario.software,
      knowledge: scenario.knowledge,
      progressLabels: steps.map((s) => s.title),
      askMeNext: scenario.askMeNext,
      voiceScript: `${scenario.summary} There are ${steps.length} steps. ${steps[0] ? `First: ${steps[0].title}. ${steps[0].detail.split('. ')[0]}.` : ''}`,
      simpleExplanation: `${scenario.summary}\n\n${steps.map((s, i) => `${i + 1}. ${s.title} — ${s.detail.split('. ')[0]}.`).join('\n')}`,
      detailedExplanation: [scenario.summary, '', ...steps.map((s, i) => `${i + 1}. ${s.title}\n   ${s.detail}${s.why ? `\n   Why: ${s.why}` : ''}${s.check ? `\n   Check: ${s.check}` : ''}`)].join('\n'),
      demo: true,
    },
    1,
  )
}

function estimateMinutes(steps: { durationSec?: number }[]) {
  const total = steps.reduce((sum, s) => sum + (s.durationSec ?? 90), 0)
  return Math.max(5, Math.round(total / 60))
}

/* ------------------------------------------------------------------ generic */

function genericAnalysis(input: DemoInput, read: VisualRead | null): AnalysisResult {
  const request = input.request.trim()

  const steps = toSteps([
    {
      title: 'Tell me a bit more about it',
      detail:
        'I am running without an AI key, so I cannot see what is in your photo. Tell me in your own words what it is — a make and model if you can see one, or what it is doing that you did not expect.',
      tip: 'Even two or three words helps: "washing machine", "printer not printing", "unknown tool with a spring".',
    },
    {
      title: 'Or add an AI key and I will look properly',
      detail:
        'Open Settings, choose Google Gemini and paste a free AI Studio key. Then I can read the photo, name the object, point at the actual controls on your image, and ask you much better follow-up questions.',
      why: 'The free Gemini tier needs no credit card and takes about a minute to set up.',
    },
    {
      title: 'Meanwhile, here is what I can do offline',
      detail:
        'Household appliances, vehicle dashboard warnings and tyre changes, printer faults, flat-pack assembly, tap and toilet leaks, electrical safety, laundry and care labels, plant problems and reading documents. Say any of those and I will walk you through it properly.',
    },
  ])

  return normalizeAnalysis(
    {
      situation: request ? `You said: “${request}”` : 'You showed me something and I do not yet know what you need.',
      intent: 'other',
      confidence: 0.3,
      sceneSummary: read ? `On-device read: ${read.note}` : 'No image analysis is available without an AI key.',
      objects: [],
      title: 'I need a bit more to go on',
      summary:
        'I am running in offline mode, so I can only work from what you type or say. Give me one or two words about what you are looking at and I will match it to one of the guides I hold offline — or add an AI key in Settings and I will analyse the photo properly.',
      difficulty: 'easy',
      tools: [],
      materials: [],
      safety: [],
      annotations: [],
      steps,
      followUpQuestions: [
        { id: 'q1', question: 'What is the object or the situation?', kind: 'text', options: [], why: 'It is the only way I can help without vision.', important: true },
        { id: 'q2', question: 'What do you want to do with it?', kind: 'choice', options: ['Understand it', 'Use it', 'Fix it', 'Cook or clean with it', 'Install it'], why: 'It decides which guide I use.', important: true },
      ],
      progressLabels: ['Describe it', 'Get a guide', 'Follow the steps'],
      askMeNext: ['What can you help with offline?', 'How do I add an AI key?', 'It is a washing machine'],
      demo: true,
    },
    1,
  )
}

/* ------------------------------------------------------------------ follow-up */

export interface DemoFollowUpInput {
  message: string
  analysis: AnalysisResult
  /** the scenario id currently in play, if any */
  scenarioId?: string
  stepIndex?: number
}

/** Keyword-matched conversational reply for the offline engine. */
export function demoFollowUp(input: DemoFollowUpInput): string {
  const { message, analysis } = input
  const m = message.toLowerCase().trim()

  const scenario = input.scenarioId ? findScenario(input.scenarioId) : null

  if (scenario?.answers) {
    const hit = scenario.answers.find((a) => a.match.some((k) => m.includes(k.toLowerCase())))
    if (hit) return hit.reply
  }

  if (/\b(next|what now|what do i do)\b/.test(m)) {
    if (analysis.steps.length) {
      const next = analysis.steps[Math.min((input.stepIndex ?? 0) + 1, analysis.steps.length - 1)]
      return `Next: ${next.title}. ${next.detail}${next.check ? ` You will know it worked when: ${next.check}` : ''}`
    }
    if (analysis.recipes.length) {
      const r = analysis.recipes[0]
      return `Next: ${r.steps[0]?.title ?? 'start cooking'}. ${r.steps[0]?.detail ?? ''}`
    }
    return 'Tell me which step you have reached and I will give you the next one.'
  }

  if (/\b(simpler|simple|plain|easier|explain differently|explain like)\b/.test(m)) {
    if (analysis.steps.length) {
      return analysis.steps
        .slice(0, 5)
        .map((s, i) => `${i + 1}. ${s.title}. ${s.detail.split('. ')[0]}.`)
        .join(' ')
    }
    return analysis.simpleExplanation || analysis.summary
  }

  if (/\b(no|don'?t have|dont have|lack|out of|without|missing)\b/.test(m)) {
    const negated = parseNegations(message)
    if (negated.length) {
      const subs = findSubstitutes(negated, [])
      return (
        `That is fine — I have adjusted the plan. ${subs
          .map((s) => `${s.missing}: ${s.use}. ${s.note}`)
          .join(' ')} Tell me when you have picked one and I will continue from where we were.`
      )
    }
    return 'Good to know — I have dropped that from the plan. Tell me which replacement you have and I will adjust the steps from here rather than starting again.'
  }

  if (/\b(safe|danger|dangerous|hurt|risky|risk)\b/.test(m)) {
    if (analysis.safety.length) {
      return [
        'The things to be careful about here:',
        ...analysis.safety.map((s) => `${s.level} — ${hazardLabel(s.hazard)}: ${s.message}${s.precaution ? ` ${s.precaution}` : ''}`),
        analysis.safety.some((s) => s.escalate)
          ? 'Anything involving electricity, gas, or lifting a vehicle is a job where a qualified person is worth the money.'
          : 'None of this needs a professional, but take it slowly.',
      ].join(' ')
    }
    return 'Nothing about this task is inherently dangerous, but keep the usual care with hot surfaces and sharp edges. If the object involves mains electricity, gas, lifting a vehicle or anything structural, stop and get qualified help — those are where DIY goes badly wrong.'
  }

  if (/\b(cost|price|how much|cheap|budget|r\d)\b/.test(m)) {
    const budget = parseBudget(message)
    return budget
      ? `With about R${budget} to work with, stay with the cheapest staples — dried beans, lentils, samp, rice, maize meal, eggs and seasonal vegetables. That is where the value is per meal. I can rework the plan strictly within that budget if you tell me which meal you want to aim for.`
      : 'Prices vary a lot by area and shop, and I will not guess at figures I cannot check. Tell me your budget in rand and I will rework the plan around it using cheap staples.'
  }

  if (/\b(key|api|setting|gemini|openai|connect)\b/.test(m)) {
    return 'Open Settings from the bottom bar, pick Gemini, and paste a key from aistudio.google.com — the free tier needs no credit card. Once it is saved, everything you upload is analysed properly, and the overlay arrows point at the real controls in your photo. You can also just tell me the details in words; I will keep going either way.'
  }

  if (/\b(thank|thanks|great|perfect|done|works|worked|sorted)\b/.test(m)) {
    return 'Glad that worked. If you want, save this task so you do not have to work it out again — the bookmark button is at the top. Anything else you want to tackle?'
  }

  const fallback = analysis.askMeNext?.length
    ? `I can keep helping, but I am running without an AI key so I only understand a set of things offline. You can ask me things like: ${analysis.askMeNext.slice(0, 3).join(', ')} — or add a key in Settings for a proper conversation.`
    : 'Tell me a bit more and I will help. Adding an AI key in Settings will let me hold a real conversation about this.'

  return fallback
}

function findScenario(id: string): Scenario | null {
  return SCENARIOS.find((s) => s.id === id) ?? null
}

/** Plain-language names for hazard categories, used when speaking about safety. */
export function hazardLabel(hazard: string): string {
  const map: Record<string, string> = {
    electricity: 'electricity',
    gas: 'gas',
    fire: 'fire risk',
    chemical: 'chemicals',
    vehicle: 'vehicle safety',
    machinery: 'moving machinery',
    sharp: 'sharp edges and tools',
    structural: 'structural work',
    medical: 'medical',
    food: 'food safety',
    height: 'working at height',
    water: 'water and flooding',
    pressure: 'stored pressure',
    child: 'child safety',
    other: 'general safety',
  }
  return map[hazard] ?? 'safety'
}

/** Exposed so the UI can show which offline guide matched. */
export function demoScenarioId(request: string, category: string): string | undefined {
  return pickScenario(request, category)?.id
}
