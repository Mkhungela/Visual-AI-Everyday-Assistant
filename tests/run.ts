/**
 * Test suite.
 *
 * No test framework — a tiny runner and node:assert, because the app itself has no
 * build-time dependencies and this keeps it that way. Run with `npm test`.
 *
 * Focused on the logic that can silently produce wrong advice: JSON salvage, the
 * schema normaliser, the food engine's matching, video chapter parsing, and the
 * server's request handling.
 */

import assert from 'node:assert/strict'

let passed = 0
let failed = 0
const failures: { name: string; err: unknown }[] = []

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    passed++
    process.stdout.write(`  \u001b[32m✓\u001b[0m ${name}\n`)
  } catch (err) {
    failed++
    failures.push({ name, err })
    process.stdout.write(`  \u001b[31m✗\u001b[0m ${name}\n`)
  }
}

function group(name: string) {
  process.stdout.write(`\n\u001b[1m${name}\u001b[0m\n`)
}

/* ------------------------------------------------------------------ imports */

const { extractJson, extractJsonOr } = await import('../src/lib/ai/json.js')
const { normalizeAnalysis, highestRisk, RISK_ORDER } = await import('../src/lib/schema.js')
const {
  parseIngredients,
  parseNegations,
  parseBudget,
  parseEquipment,
  matchRecipes,
  materialiseRecipe,
  findSubstitutes,
  estimateCost,
} = await import('../src/lib/demo/food.js')
const { demoAnalyze, demoFollowUp, answersToText, demoScenarioId } = await import('../src/lib/demo/engine.js')
const { pickScenario, SCENARIOS } = await import('../src/lib/demo/scenarios.js')
const { parseChapters, buildQueries, scoreVideo } = await import('../src/lib/videos.js')
const { speechChunks, sameIngredient, stripMarkdown, formatMinutes, uid } = await import('../src/lib/utils.js')
const { analysisToChatHistory, buildKitchenContext, knowledgeForPrompt } = await import('../src/lib/knowledge.js')
const { DEFAULT_PERSONA } = await import('../src/lib/prompts.js')

const noAttachments: never[] = []

/* ------------------------------------------------------------------ json salvage */

group('JSON salvage')

await test('parses clean JSON', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 })
})

await test('strips markdown fences', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 })
})

await test('ignores prose around the object', () => {
  assert.deepEqual(extractJson('Sure! Here you go:\n{"title":"Wash"}\nHope that helps.'), { title: 'Wash' })
})

await test('repairs trailing commas', () => {
  assert.deepEqual(extractJson('{"a":1,"b":[1,2,],}'), { a: 1, b: [1, 2] })
})

await test('repairs python literals and unquoted keys', () => {
  const out = extractJson<{ a: boolean; b: null }>('{a: True, b: None}')
  assert.deepEqual(out, { a: true, b: null })
})

await test('repairs smart quotes', () => {
  assert.deepEqual(extractJson('{\u201Ca\u201D: \u201Chello\u201D}'), { a: 'hello' })
})

await test('salvages a truncated response', () => {
  const out = extractJson<{ title: string; steps: unknown[] }>('{"title":"Change a tyre","steps":[{"n":1,"title":"Loosen')
  assert.equal(out?.title, 'Change a tyre')
  assert.ok(Array.isArray(out?.steps))
})

await test('returns null for hopeless input', () => {
  assert.equal(extractJson('I cannot help with that.'), null)
})

await test('falls back cleanly', () => {
  assert.deepEqual(extractJsonOr('nope', { fallback: true }), { fallback: true })
})

/* ------------------------------------------------------------------ normaliser */

group('Schema normaliser')

await test('survives a completely empty object', () => {
  const a = normalizeAnalysis({})
  assert.equal(a.intent, 'other')
  assert.equal(a.difficulty, 'easy')
  assert.deepEqual(a.steps, [])
  assert.ok(a.title.length > 0)
  assert.ok(Array.isArray(a.askMeNext))
})

await test('survives a non-object', () => {
  const a = normalizeAnalysis('utter nonsense')
  assert.equal(typeof a.title, 'string')
  assert.deepEqual(a.safety, [])
})

await test('coerces stringified numbers and risk levels', () => {
  const a = normalizeAnalysis({
    confidence: '0.8',
    timeEstimateMin: '45',
    safety: [{ message: 'Gas leak risk', level: 'very high', hazard: 'gas' }],
  })
  assert.equal(a.confidence, 0.8)
  assert.equal(a.timeEstimateMin, 45)
  assert.equal(a.safety[0].level, 'high')
  assert.equal(a.safety[0].hazard, 'gas')
})

await test('wraps a single step object into an array and renumbers', () => {
  const a = normalizeAnalysis({ steps: { title: 'Only step', detail: 'do it' } })
  assert.equal(a.steps.length, 1)
  assert.equal(a.steps[0].n, 1)
})

await test('parses Gemini box_2d coordinates (0-1000 yxyx)', () => {
  const a = normalizeAnalysis({
    objects: [{ label: 'dial', box: [100, 200, 400, 600] }],
  })
  // ymin=100 ymax=400 → y 0.1 h 0.3 ; xmin=200 xmax=600 → x 0.2 w 0.4
  const [x, y, w, h] = a.objects[0].box!
  assert.equal(x, 0.2)
  assert.equal(y, 0.1)
  assert.equal(Math.round(w * 10) / 10, 0.4)
  assert.equal(Math.round(h * 10) / 10, 0.3)
})

await test('clamps annotation coordinates into range', () => {
  const a = normalizeAnalysis({ annotations: [{ label: 'x', x: 4, y: -2 }] })
  assert.equal(a.annotations[0].x, 1)
  assert.equal(a.annotations[0].y, 0)
})

await test('keeps food safety text and never invents a pass', () => {
  const a = normalizeAnalysis({
    intent: 'cook',
    steps: [{ title: 'Cook the chicken', detail: 'Until done', check: '74 °C in the thickest part' }],
  })
  assert.equal(a.intent, 'cook')
  assert.match(a.steps[0].check!, /74/)
})

await test('backfills explanation and voice fields', () => {
  const a = normalizeAnalysis({ summary: 'Do the thing', steps: [{ title: 'A', detail: 'B' }] })
  assert.ok(a.simpleExplanation.length > 0)
  assert.ok(a.detailedExplanation.includes('A'))
  assert.ok(a.voiceScript.length > 0)
  assert.ok(a.progressLabels.length >= 1)
})

await test('computes the worst safety level', () => {
  const flags = [
    { id: 'a', hazard: 'sharp' as const, level: 'low' as const, message: 'x', stop: false, escalate: false },
    { id: 'b', hazard: 'gas' as const, level: 'critical' as const, message: 'y', stop: true, escalate: true },
  ]
  assert.equal(highestRisk(flags), 'critical')
  assert.equal(highestRisk([]), 'none')
  assert.equal(RISK_ORDER.indexOf('high') > RISK_ORDER.indexOf('medium'), true)
})

await test('normalises a recipe with string ingredients', () => {
  const a = normalizeAnalysis({
    intent: 'cook',
    recipes: [{ name: 'Omelette', ingredients: ['eggs', 'salt'], steps: [{ title: 'Beat', detail: 'Beat them' }] }],
  })
  assert.equal(a.recipes[0].ingredients.length, 2)
  assert.equal(a.recipes[0].ingredients[0].item, 'eggs')
  assert.equal(a.steps.length, 1, 'top-level steps fall back to the recipe steps')
})

/* ------------------------------------------------------------------ food engine */

group('Food engine')

await test('finds ingredients in free text', () => {
  const found = parseIngredients('I have eggs, tomatoes, onions and some bread')
  for (const want of ['eggs', 'tomatoes', 'onion', 'bread']) {
    assert.ok(found.includes(want), `expected ${want} in ${JSON.stringify(found)}`)
  }
})

await test('does not match inside other words', () => {
  // "oil" must not fire on "boiled"
  assert.equal(parseIngredients('I boiled the kettle').includes('cooking oil'), false)
})

await test('understands South African vocabulary', () => {
  const found = parseIngredients('mielie meal, wors and aartappels')
  assert.ok(found.includes('maize meal'))
  assert.ok(found.includes('boerewors'))
  assert.ok(found.includes('potatoes'))
})

await test('parses a budget in rand', () => {
  assert.equal(parseBudget('I only have R100'), 100)
  assert.equal(parseBudget('budget of 250 rand'), 250)
  assert.equal(parseBudget('no money mentioned'), undefined)
})

await test('detects what the user does not have', () => {
  const missing = parseNegations("I don't have cheese and I'm out of milk")
  assert.ok(missing.includes('cheese'))
  assert.ok(missing.includes('milk'))
})

await test('detects equipment and the no-power case', () => {
  assert.ok(parseEquipment('I have a microwave and a frying pan').includes('microwave'))
  assert.ok(parseEquipment('there is no electricity because of load shedding').includes('no cooking'))
})

await test('ranks recipes the user can actually cook first', () => {
  const have = ['eggs', 'tomatoes', 'onion', 'bread', 'cheese']
  const matches = matchRecipes({ have, equipment: ['stovetop', 'frying pan'] })
  assert.ok(matches.length > 0)
  const top = matches[0]
  assert.equal(top.missingCore.length, 0, `top match "${top.template.name}" should need nothing extra`)
  assert.ok(top.score > 0.5)
  // The single most fitting dish for these ingredients is an egg-and-tomato dish.
  assert.match(top.template.name, /Shakshuka|Omelette/i)
})

await test('respects an appliance constraint', () => {
  const matches = matchRecipes({ have: ['bread', 'cheese'], equipment: ['stovetop'] })
  const toastie = matches.find((m) => m.template.name === 'Cheese toastie')
  assert.ok(toastie, 'the toastie should still be offered')
  assert.equal(toastie!.template.need.includes('oven'), false)
})

await test('honours a no-cook constraint', () => {
  const matches = matchRecipes({ have: ['bread', 'cheese', 'tomatoes'], equipment: ['no cooking'], noCook: true })
  assert.ok(matches.length > 0)
  for (const m of matches) assert.ok(m.template.need.includes('no cooking'), `${m.template.name} needs cooking`)
})

await test('ranks cheaper options first under a tight budget', () => {
  const have = ['maize meal', 'tomatoes', 'onion', 'flour', 'eggs', 'chicken']
  const rich = matchRecipes({ have, equipment: ['stovetop', 'pot'] })[0]
  const poor = matchRecipes({ have, equipment: ['stovetop', 'pot'], budget: 25 })[0]
  assert.ok((poor.template.costZar ?? 0) <= (rich.template.costZar ?? 999))
})

await test('materialises a recipe and separates blockers from nice-to-haves', () => {
  const matches = matchRecipes({ have: ['eggs'], equipment: ['stovetop', 'frying pan'] })
  const recipe = materialiseRecipe(matches[0], { have: ['eggs'], missing: [], equipment: ['stovetop', 'frying pan'] })
  assert.ok(recipe.name)
  assert.ok(recipe.steps.length > 0)
  assert.ok(recipe.steps.every((s) => s.detail.length > 20), 'steps must be actionable, not stubs')
  // An omelette genuinely needs only eggs, so nothing is a blocker...
  assert.equal(recipe.missing.length, 0)
  // ...but an empty omelette is a thin meal, so the extras are surfaced separately.
  assert.ok(recipe.niceToHave.length > 0, 'should suggest the extras that make the dish work')
  assert.ok(recipe.niceToHave.every((i) => !recipe.missing.includes(i)))
})

await test('reports a blocker when a core ingredient is genuinely absent', () => {
  const matches = matchRecipes({ have: ['eggs'], equipment: ['stovetop', 'frying pan'] })
  const shakshuka = matches.find((m) => m.template.name === 'Shakshuka')!
  const recipe = materialiseRecipe(shakshuka, { have: ['eggs'], missing: [], equipment: ['stovetop', 'frying pan'] })
  assert.ok(recipe.missing.some((m) => /tomato/i.test(m)), 'Shakshuka needs tomatoes and must say so')
})

await test('gives real substitutions for things the user lacks', () => {
  const subs = findSubstitutes(['butter', 'milk', 'cheese'], ['cooking oil'])
  assert.equal(subs.length, 3)
  assert.match(subs[0].use.toLowerCase(), /oil|margarine/)
})

await test('estimates cost without pretending to be a quote', () => {
  const est = estimateCost(['chicken', 'rice', 'broccoli'])
  assert.ok(est.total > 0)
  assert.equal(est.lines.length, 3)
})

/* ------------------------------------------------------------------ scenario matching */

group('Scenario matching')

await test('every scenario compiles into usable steps', () => {
  assert.ok(SCENARIOS.length >= 12, 'expected a decent library of offline guides')
  for (const s of SCENARIOS) {
    assert.ok(s.steps.length >= 3, `${s.id} has too few steps`)
    assert.ok(s.summary.length > 40, `${s.id} needs a real summary`)
    for (const step of s.steps) {
      assert.ok(step.title.length > 2, `${s.id} step needs a title`)
      assert.ok(step.detail.length > 30, `${s.id} step "${step.title}" needs real detail`)
    }
  }
})

await test('routes wording to the right guide', () => {
  assert.equal(pickScenario('my washing machine, how do I wash blankets', 'appliance')?.id, 'washing-machine')
  assert.equal(pickScenario('the printer is not printing', 'appliance')?.id, 'printer')
  assert.equal(pickScenario('what is this tool', 'tool')?.id, 'unidentified')
  assert.equal(pickScenario('i need to assemble flat pack furniture', 'tool')?.id, 'assembly')
})

await test('electricity questions hit the safety guide, with a hard stop', () => {
  const s = pickScenario('the plug is burning and it shocked me', 'appliance')
  assert.equal(s?.id, 'electricity-safety')
  assert.ok(s!.safety.some((f) => f.stop), 'electricity must hard-stop')
  assert.ok(s!.safety.some((f) => f.escalate))
})

await test('vehicle safety never tells someone to get under a jacked car', () => {
  const tyre = SCENARIOS.find((s) => s.id === 'tyre-change')!
  const text = JSON.stringify(tyre).toLowerCase()
  assert.ok(text.includes('never put your hands'))
  assert.ok(tyre.safety.some((f) => f.level === 'critical'))
})

await test('food safety language avoids claiming looks prove safety', async () => {
  const a = await demoAnalyze({
    request: 'I have chicken and rice, what can I cook',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: ['stovetop', 'pot'],
  })
  const safety = a.safety.map((s) => `${s.message} ${s.precaution ?? ''}`).join(' ').toLowerCase()
  assert.match(safety, /cannot tell whether|temperature or a time test|74/)
  assert.equal(/looks done|looks cooked|should be fine if it looks/i.test(safety), false)
})

/* ------------------------------------------------------------------ demo engine */

group('Demo engine (offline)')

await test('produces a real food answer from typed ingredients', async () => {
  const a = await demoAnalyze({
    request: 'what can I make with eggs, tomatoes, onion and bread',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: [],
  })
  assert.equal(a.intent, 'cook')
  assert.ok(a.recipes.length >= 2, 'should offer several meals')
  assert.ok(a.recipes[0].steps.length >= 3, 'the top meal needs real steps')
  assert.ok(a.demo)
  assert.ok(a.safety.some((s) => s.hazard === 'food'), 'food safety notes are mandatory')
  assert.ok(a.summary.toLowerCase().includes('ingredient'))
})

await test('asks for more rather than guessing when it knows little', async () => {
  const a = await demoAnalyze({
    request: 'make me something good',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: [],
  })
  assert.ok(a.followUpQuestions.some((q) => /what else|have in the kitchen/i.test(q.question)))
  assert.ok(a.followUpQuestions.some((q) => q.kind === 'multi_choice' || /cook with/i.test(q.question)))
})

await test('adapts when the user says they have no oven', async () => {
  const withOven = await demoAnalyze({
    request: 'I have chicken, potatoes and rice',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: ['stovetop', 'oven', 'pot', 'frying pan'],
  })
  const without = await demoAnalyze({
    request: 'I have chicken, potatoes and rice but no oven',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: ['stovetop', 'pot'],
  })
  const ovenOnly = without.recipes.filter((r) => r.equipment.includes('oven'))
  assert.equal(ovenOnly.length, 0, 'no recipe needing an oven should survive the constraint')
  assert.ok(withOven.recipes.length > 0)
})

await test('folds follow-up answers back into the reasoning', () => {
  const text = answersToText([{ question: 'Do you have an oven?', answer: 'No' }])
  assert.match(text, /don't have oven|do not have oven/i)
  const yes = answersToText([{ question: 'Do you have cheese?', answer: 'Yes' }])
  assert.match(yes.toLowerCase(), /i have cheese/)
})

await test('routes a washing machine question to the laundry guide', async () => {
  const a = await demoAnalyze({
    request: 'how do I use this washing machine',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: [],
  })
  assert.equal(a.intent, 'use')
  assert.ok(a.steps.length >= 6)
  assert.ok(a.steps.some((s) => s.diagram), 'should include a control diagram')
  assert.ok(a.knowledge !== undefined)
})

await test('never fabricates annotations offline', async () => {
  for (const request of ['washing machine', 'flat pack assembly', 'what is this']) {
    const a = await demoAnalyze({
      request,
      attachments: noAttachments,
      persona: DEFAULT_PERSONA,
      kitchen: [],
      equipment: [],
    })
    assert.deepEqual(a.annotations, [], `offline mode must not invent marks for "${request}"`)
  }
})

await test('falls back to an honest generic answer', async () => {
  const a = await demoAnalyze({
    request: 'something completely unrecognisable xyzzy',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: [],
  })
  assert.ok(a.demo)
  assert.ok(a.confidence < 0.5, 'it should admit low confidence')
  assert.ok(a.summary.toLowerCase().includes('offline') || a.summary.toLowerCase().includes('without an ai key'))
})

await test('chat follow-up answers "what next" from the step list', async () => {
  const analysis = await demoAnalyze({
    request: 'how do I change a tyre',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: [],
  })
  const reply = demoFollowUp({ message: 'what do I do next?', analysis, stepIndex: 0 })
  assert.ok(reply.toLowerCase().includes('next'))
  assert.ok(reply.length > 40)
})

await test('chat follow-up handles a missing ingredient by substituting', async () => {
  const analysis = await demoAnalyze({
    request: 'I have eggs and tomatoes',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: [],
  })
  const reply = demoFollowUp({ message: "I don't have cheese", analysis })
  assert.ok(/substitut|without|swap|leave/i.test(reply))
})

await test('chat follow-up refuses to bluff about safety', async () => {
  const analysis = await demoAnalyze({
    request: 'washing machine',
    attachments: noAttachments,
    persona: DEFAULT_PERSONA,
    kitchen: [],
    equipment: [],
  })
  const reply = demoFollowUp({ message: 'is this safe?', analysis })
  assert.ok(reply.length > 30)
  assert.ok(/electricity|gas|lifting|qualified|risk|care/i.test(reply))
})

await test('scenario id is exposed for follow-up routing', () => {
  assert.equal(demoScenarioId('the printer will not print', 'appliance'), 'printer')
})

/* ------------------------------------------------------------------ videos */

group('Video intelligence')

await test('no API key never yields a fabricated watch link', async () => {
  const analysis = normalizeAnalysis({ title: 'Replace a tap washer', objects: [{ label: 'tap' }] })
  const { planVideos } = await import('../src/lib/videos.js')
  const plan = await planVideos({ analysis })
  assert.ok(plan.videos.length > 0)
  for (const v of plan.videos) {
    assert.match(v.url, /youtube\.com\/results\?search_query=/)
    assert.ok(plan.notice, 'it should explain that these are searches')
  }
})

await test('builds task-specific queries, not category queries', () => {
  const analysis = normalizeAnalysis({
    title: 'Change a wheel safely',
    objects: [{ label: 'space saver spare wheel' }],
    intent: 'fix',
  })
  const queries = buildQueries(analysis)
  assert.ok(queries.length >= 2)
  assert.match(queries[0].query.toLowerCase(), /wheel|space saver/)
  assert.ok(queries[0].why.length > 10, 'every query explains why')
})

await test('parses real chapter timestamps out of a description', () => {
  const desc = `In this video we change a tyre.
0:00 Intro
0:35 Preparing the tools
1:20 Removing the component
2:45 Installing the replacement
https://example.com
Thanks for watching`
  const chapters = parseChapters(desc)
  assert.equal(chapters.length, 4)
  assert.equal(chapters[1].t, '0:35')
  assert.equal(chapters[1].label, 'Preparing the tools')
  assert.equal(chapters[3].t, '2:45')
})

await test('ignores a lone timestamp that is really a link', () => {
  assert.deepEqual(parseChapters('Watch more: 3:14 https://x.com/y'), [])
})

await test('scores a close instructional video above an unrelated one', () => {
  const analysis = normalizeAnalysis({ title: 'Change a tyre', objects: [{ label: 'spare wheel' }] })
  const good = scoreVideo(
    { id: 'a', title: 'How to change a spare wheel step by step', channel: 'x', description: 'wheel tyre jack', thumbnail: '', url: '' },
    analysis,
  )
  const bad = scoreVideo(
    { id: 'b', title: 'Best camping recipes for the weekend', channel: 'y', description: 'food cooking', thumbnail: '', url: '' },
    analysis,
  )
  assert.ok(good > bad, `expected ${good} > ${bad}`)
  assert.ok(good <= 1 && good >= 0)
})

/* ------------------------------------------------------------------ misc utilities */

group('Utilities')

await test('sameIngredient matches plurals and compounds', () => {
  assert.ok(sameIngredient('tomato', 'tomatoes'))
  assert.ok(sameIngredient('tinned tomatoes', 'tomatoes'))
  assert.ok(sameIngredient('chicken breast', 'chicken'))
  assert.equal(sameIngredient('eggs', 'cheese'), false)
  // Related but genuinely different products must NOT be treated as interchangeable.
  assert.equal(sameIngredient('tomato puree', 'kidney beans'), false)
})

await test('splits long text into speakable chunks', () => {
  const chunks = speechChunks('A. '.repeat(400), 500)
  assert.ok(chunks.length > 1)
  for (const c of chunks) assert.ok(c.length <= 520)
})

await test('strips markdown for plain-text output', () => {
  assert.equal(stripMarkdown('**Bold** and `code`'), 'Bold and code')
})

await test('formats durations politely', () => {
  assert.equal(formatMinutes(45), '45 min')
  assert.equal(formatMinutes(90), '1 hr 30 min')
  assert.equal(formatMinutes(undefined), '')
})

await test('ids are unique', () => {
  const ids = new Set(Array.from({ length: 500 }, () => uid('x')))
  assert.equal(ids.size, 500)
})

/* ------------------------------------------------------------------ knowledge */

group('Personal knowledge')

await test('builds kitchen context from saved entries', () => {
  const entries = [
    { id: '1', kind: 'kitchen' as const, name: 'My kitchen', detail: 'eggs, rice, tomatoes', createdAt: 0 },
    { id: '2', kind: 'appliance' as const, name: 'Bosch washing machine', detail: 'Serie 6', createdAt: 0 },
  ]
  const kitchen = buildKitchenContext(entries)
  assert.deepEqual(kitchen, ['eggs', 'rice', 'tomatoes'])
  const prompt = knowledgeForPrompt(entries)
  assert.equal(prompt.length, 2)
  assert.match(prompt[1], /Appliance: Bosch/)
})

await test('seeds chat history with the live task', () => {
  const analysis = normalizeAnalysis({
    title: 'Wash a mixed load',
    summary: 'Sort, load, set the dial',
    steps: [{ title: 'Sort the load', detail: 'Whites apart' }],
  })
  const history = analysisToChatHistory(analysis)
  assert.equal(history.length, 2)
  const text = (history[0].parts[0] as { text: string }).text
  assert.match(text, /TASK: Wash a mixed load/)
  assert.match(text, /Sort the load/)
})

group('Languages')

await test('offers all twelve official South African languages', async () => {
  const { LANGUAGES, LANGUAGE_NAMES } = await import('../src/lib/store.js')
  const { LANG_VOICE_SUPPORT } = await import('../src/lib/speech.js')

  // Eleven spoken official languages plus South African Sign Language, which this app
  // does not attempt to speak. Anything absent here cannot be selected at all, which is
  // a worse outcome than being listed with the honest "no voice yet" marking.
  const official = [
    ['en-ZA', 'English'],
    ['af-ZA', 'Afrikaans'],
    ['zu-ZA', 'isiZulu'],
    ['xh-ZA', 'isiXhosa'],
    ['st-ZA', 'Sesotho'],
    ['tn-ZA', 'Setswana'],
    ['nso-ZA', 'Sepedi'],
    ['ts-ZA', 'Xitsonga'],
    ['ss-ZA', 'siSwati'],
    ['ve-ZA', 'Tshivenda'],
    ['nr-ZA', 'isiNdebele'],
  ] as const

  const codes = LANGUAGES.map((l) => l.code)
  for (const [code, name] of official) {
    assert.ok(codes.includes(code), `${name} (${code}) is not offered at all`)
    assert.match(LANGUAGE_NAMES[code] ?? '', new RegExp(name.split(' ')[0], 'i'), `${code} has no display name`)
  }

  // Every offered language must have a voice-support answer, so the UI never has to
  // guess whether it can actually speak to the user.
  for (const l of LANGUAGES) {
    assert.equal(
      typeof LANG_VOICE_SUPPORT[l.code],
      'boolean',
      `${l.code} is offered but has no voice-support entry`,
    )
  }

  // The flag on the language and the support map must agree, or the UI will claim it
  // can speak a language it cannot.
  for (const l of LANGUAGES) {
    assert.equal(l.tts, LANG_VOICE_SUPPORT[l.code], `${l.code}: tts flag disagrees with LANG_VOICE_SUPPORT`)
  }
})

/* ------------------------------------------------------------------ server */

group('Server')

/**
 * HTTP tests run against the live server rather than starting one in-process —
 * importing the server module must not hijack a port, and testing the real running
 * server is more honest anyway. Skipped with a warning when nothing is listening.
 */
const BASE = 'http://127.0.0.1:' + (process.env.PORT || '8787')
const serverUp = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2500) })
  .then((r) => r.ok)
  .catch(() => false)

if (serverUp) {
  const base = BASE

  await test('health endpoint responds', async () => {
    const res = await fetch(`${base}/api/health`)
    assert.equal(res.status, 200)
    const j = await res.json()
    assert.equal(j.ok, true)
    assert.equal(j.capabilities.aiRelay, true)
  })

  await test('AI relay rejects a malformed request', async () => {
    const res = await fetch(`${base}/api/ai/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini' }),
    })
    assert.equal(res.status, 400)
  })

  await test('AI relay refuses to work without a key', async () => {
    const res = await fetch(`${base}/api/ai/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4o', messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }] }),
    })
    assert.equal(res.status, 400)
    const j = await res.json()
    assert.match(j.error.hint, /Settings/i)
  })

  await test('web fetch blocks private and local addresses', async () => {
    for (const url of ['http://localhost:22/x', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'file:///etc/passwd']) {
      const res = await fetch(`${base}/api/fetch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      assert.equal(res.status, 400, `expected ${url} to be blocked`)
    }
  })

  await test('youtube search says so plainly when unconfigured', async () => {
    const res = await fetch(`${base}/api/youtube`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'how to change a tyre' }),
    })
    assert.ok([501, 200].includes(res.status))
    if (res.status === 501) {
      const j = await res.json()
      assert.match(j.error.hint, /search link/i)
    }
  })
} else {
  process.stdout.write('  \u001b[33m•\u001b[0m no server listening on ' + BASE + ' — skipping HTTP tests (run `npm run dev` first)\n')
}

/* ------------------------------------------------------------------ report */

process.stdout.write(`\n\u001b[1m${passed} passed, ${failed} failed\u001b[0m\n`)
if (failures.length) {
  process.stdout.write('\nFailures:\n')
  for (const f of failures) {
    process.stdout.write(`\n\u001b[31m✗ ${f.name}\u001b[0m\n${f.err instanceof Error ? f.err.stack : String(f.err)}\n`)
  }
  process.exit(1)
}
process.exit(0)
