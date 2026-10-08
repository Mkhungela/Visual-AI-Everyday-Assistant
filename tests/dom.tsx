/**
 * Render tests.
 *
 * The pure-logic suite cannot catch a React crash, and the task view is a large
 * component tree rendering real model output. This mounts the actual app in jsdom,
 * seeds a real demo analysis into the session, and drives the mode switcher — the
 * closest thing to a browser smoke test that runs in CI.
 */

import { JSDOM } from 'jsdom'

/* ------------------------------------------------------------------ environment */

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:8787/',
  pretendToBeVisual: true,
})

const w = dom.window as unknown as Record<string, unknown>

for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'Element',
  'Node',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
  'sessionStorage',
  'Blob',
  'File',
  'FileReader',
  'FormData',
  'Image',
  'ResizeObserver',
]) {
  if (key in w) {
    Object.defineProperty(globalThis, key, { value: w[key], configurable: true, writable: true })
  }
}

// Node >= 21 defines `navigator` as a read-only getter; redefine it so jsdom wins.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true })

// jsdom has no layout engine; silence the noise it makes about it.
const origError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  const first = String(args[0] ?? '')
  if (/not implemented|Error: Uncaught|Could not parse CSS/i.test(first)) return
  origError(...args)
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createElement: h, useEffect, useRef } = await import('react')

const { SessionProvider, useSession } = await import('../src/state/session.js')
const { SessionView } = await import('../src/components/Session.js')
const { App } = await import('../src/App.js')
const { store } = await import('../src/lib/store.js')
const { demoAnalyze } = await import('../src/lib/demo/engine.js')
const { DEFAULT_PERSONA } = await import('../src/lib/prompts.js')

/* ------------------------------------------------------------------ runner */

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

process.stdout.write('\n\u001b[1mRender tests (jsdom)\u001b[0m\n')

/* ------------------------------------------------------------------ helpers */

async function mount(node: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(node)
  })
  return {
    container,
    text: () => container.textContent ?? '',
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

/** Find the first clickable element whose text matches, and click it. */
async function click(container: HTMLElement, match: string | RegExp) {
  const els = Array.from(container.querySelectorAll<HTMLElement>('button, a'))
  const found = els.find((el) => {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    return typeof match === 'string' ? t.includes(match) : match.test(t)
  })
  if (!found) {
    throw new Error(`No button matching ${String(match)}. Buttons: ${els.slice(0, 40).map((e) => (e.textContent ?? '').trim().slice(0, 26)).join(' | ')}`)
  }
  await act(async () => {
    found.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

/* ------------------------------------------------------------------ fixtures */

const scenarioAnalysis = await demoAnalyze({
  request: 'how do I use this washing machine',
  attachments: [],
  persona: DEFAULT_PERSONA,
  kitchen: [],
  equipment: [],
})

const foodAnalysis = await demoAnalyze({
  request: 'what can I make with eggs, tomatoes, onion and bread',
  attachments: [],
  persona: DEFAULT_PERSONA,
  kitchen: [],
  equipment: [],
})

/* ------------------------------------------------------------------ app shell */

await test('the app mounts and shows the camera-first home screen', async () => {
  const app = await mount(h(App))
  const text = app.text()
  if (!text.includes('dealing with')) throw new Error(`hero missing. Got: ${text.slice(0, 200)}`)
  if (!text.includes('SHOW ME')) throw new Error('SHOW ME action missing')
  if (!text.includes('ASK ME')) throw new Error('ASK ME action missing')
  await app.unmount()
})

await test('settings screen renders every provider and the key field', async () => {
  const app = await mount(h(App))
  await click(app.container, 'Settings')
  const text = app.text()
  for (const provider of ['Google Gemini', 'OpenAI', 'Anthropic', 'OpenRouter', 'Groq', 'Ollama']) {
    if (!text.includes(provider)) throw new Error(`provider ${provider} missing from Settings`)
  }
  if (!text.includes('API key')) throw new Error('API key field missing')
  if (!text.includes('Detect')) throw new Error('model detection button missing')
  await app.unmount()
})

await test('library renders with seeded saves and knowledge', async () => {
  store.saveTask({
    id: 'test-save',
    title: 'Wash a mixed load',
    summary: 'Sort, load, dial, start.',
    intent: 'use',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    thumb: '',
    analysis: scenarioAnalysis,
    pinned: true,
    tags: ['laundry'],
    notes: '',
    stepReached: 2,
  })
  store.addKnowledge({ id: 'k1', kind: 'kitchen', name: 'My kitchen', detail: 'eggs, rice', createdAt: Date.now() })

  const app = await mount(h(App))
  await click(app.container, 'Library')
  const text = app.text()
  if (!text.includes('Wash a mixed load')) throw new Error('saved task missing')
  if (!text.includes('step 3')) throw new Error('saved progress not shown')
  await app.unmount()
})

/* ------------------------------------------------------------------ session view */

function Seeded({ analysis }: { analysis: typeof scenarioAnalysis }) {
  const session = useSession()
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    session.dispatch({
      type: 'success',
      analysis,
      meta: { demo: true, provider: 'demo', model: 'offline engine', latencyMs: 0, healed: false, notice: 'Demo engine.' },
    })
  }, [analysis, session])
  if (!session.analysis) return h('div', null, 'loading')
  return h(SessionView, { onOpenSettings: () => {} })
}

async function mountSession(analysis: typeof scenarioAnalysis) {
  return mount(h(SessionProvider, null, h(Seeded, { analysis })))
}

await test('the task view renders an offline guide with steps and safety', async () => {
  const view = await mountSession(scenarioAnalysis)
  const text = view.text()
  if (!text.includes('Wash a mixed load')) throw new Error(`title missing: ${text.slice(0, 160)}`)
  if (!text.includes('Demo engine running')) throw new Error('demo notice missing — users must know it cannot see photos')
  if (!text.includes('Step 1 of')) throw new Error('guided step header missing')
  if (!text.includes('Safety') && !text.includes('Take care') && !text.includes('Low risk')) {
    throw new Error('safety banner missing')
  }
  await view.unmount()
})

await test('“I have done it” advances the step and the progress tracker', async () => {
  const view = await mountSession(scenarioAnalysis)
  const before = view.text()
  if (!before.includes('Step 1 of')) throw new Error('not on step 1')
  await click(view.container, 'I have done it')
  const after = view.text()
  if (!after.includes('Step 2 of')) throw new Error(`did not advance. Got: ${after.slice(0, 200)}`)
  if (!after.includes('1 of')) throw new Error('progress count did not update')
  await view.unmount()
})

await test('SHOW ME mode is honest when there is no photo', async () => {
  const view = await mountSession(scenarioAnalysis)
  await click(view.container, 'Show me')
  const text = view.text()
  if (!text.includes('No photo to draw on')) throw new Error(`expected an honest empty state, got: ${text.slice(0, 220)}`)
  await view.unmount()
})

await test('SHOW ME never claims to have marked a photo it cannot see', async () => {
  const view = await mountSession(scenarioAnalysis)
  await click(view.container, 'Show me')
  const text = view.text()
  if (/I have highlighted|I marked the|I have drawn/.test(text)) {
    throw new Error('it must not claim to have annotated anything offline')
  }
  if (!text.includes('Schematics for the controls')) throw new Error('expected the generic diagram fallback')
  await view.unmount()
})

await test('READ mode renders both detail levels and the step list', async () => {
  const view = await mountSession(scenarioAnalysis)
  await click(view.container, 'Read')
  let text = view.text()
  if (!text.includes('Written instructions')) throw new Error('read mode missing')
  if (!text.includes('Sort the load')) throw new Error('steps missing from read mode')
  await click(view.container, 'Detailed')
  text = view.text()
  if (!text.includes('Detailed')) throw new Error('detail toggle did not render')
  await view.unmount()
})

await test('TELL ME mode renders the spoken script and controls', async () => {
  const view = await mountSession(scenarioAnalysis)
  await click(view.container, 'Tell me')
  const text = view.text()
  if (!text.includes('Hands-free instructions')) throw new Error('tell mode missing')
  if (!text.includes('Read it to me')) throw new Error('play control missing')
  if (!text.includes('Afrikaans')) throw new Error('language selector missing South African languages')
  await view.unmount()
})

await test('WATCH mode explains how videos are chosen and does not fake them', async () => {
  const view = await mountSession(scenarioAnalysis)
  await click(view.container, 'Watch')
  const text = view.text()
  if (!text.includes('Demonstrations matched')) throw new Error('watch mode missing')
  if (!text.includes('How I chose these')) throw new Error('ranking explanation missing')
  if (/watch\?v=/.test(text)) throw new Error('it must not invent a video ID offline')
  await view.unmount()
})

await test('food mode renders recipes, ingredients and the fuller-recipe action', async () => {
  const view = await mountSession(foodAnalysis)
  const text = view.text()
  if (!text.includes('meal')) throw new Error(`meal count missing: ${text.slice(0, 200)}`)
  if (!text.includes('Ingredients')) throw new Error('ingredient list missing')
  if (!text.includes('Cooking steps')) throw new Error('cooking steps missing')
  await view.unmount()
})

await test('following the step rail moves the guide', async () => {
  const view = await mountSession(scenarioAnalysis)
  await click(view.container, 'Sort the load')
  const text = view.text()
  if (!text.includes('Step 1 of')) throw new Error('clicking a tracker entry should focus it')
  await view.unmount()
})

/* ------------------------------------------------------------------ full journey */

/** Set a controlled input's value the way React expects to see it. */
async function typeInto(container: HTMLElement, value: string, selector = 'textarea') {
  const el = container.querySelector(selector) as HTMLTextAreaElement | null
  if (!el) throw new Error(`No element matching ${selector}`)
  const proto = Object.getPrototypeOf(el) as object
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (!setter) throw new Error('could not resolve the value setter')
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  return el
}

/** A bottom-nav tab. It is disabled when that tab has nothing to show. */
function navButton(container: HTMLElement, label: string) {
  const btn = Array.from(container.querySelectorAll<HTMLButtonElement>('nav button')).find((b) =>
    (b.textContent ?? '').trim().startsWith(label),
  )
  if (!btn) throw new Error(`no nav button for ${label}`)
  return btn
}

/** Click by test id — for icon-only controls that have no visible label. */
async function clickById(container: HTMLElement, id: string) {
  const el = container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  if (!el) throw new Error(`no element with data-testid="${id}"`)
  await act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

async function send(container: HTMLElement) {
  await clickById(container, 'composer-send')
}

/** Drive the real app, with no API key, all the way to a finished analysis. */
async function runJourney(request: string) {
  const app = await mount(h(App))
  await typeInto(app.container, request)
  await send(app.container)
  return app
}

await test('the whole journey works from the home screen with no API key', async () => {
  const app = await runJourney('how do I use this washing machine')
  const text = app.text()
  if (!text.includes('Wash a mixed load')) throw new Error(`analysis never arrived. Got: ${text.slice(0, 300)}`)
  if (!text.includes('Demo engine running')) throw new Error('offline mode must announce itself')
  await app.unmount()
})

await test('a loaded task does not trap you on the task tab', async () => {
  const app = await runJourney('how do I use this washing machine')
  if (!app.text().includes('Wash a mixed load')) throw new Error('precondition: no task loaded')

  await click(app.container, 'Home')
  const text = app.text()
  if (!text.includes('dealing with')) {
    throw new Error(`navigating Home did not stay on Home — the task tab keeps pulling the user back. Got: ${text.slice(0, 200)}`)
  }
  await app.unmount()
})

await test('an open task can be closed, and closing it clears the screen', async () => {
  const app = await runJourney('how do I use this washing machine')
  await click(app.container, 'Home')
  await click(app.container, 'Home') // stay put if the first click was overridden

  // Returning to the task and closing it must land back on the home screen, empty.
  await click(app.container, 'Task')
  await clickById(app.container, 'task-close')
  const closed = app.text()
  if (!closed.includes('dealing with')) throw new Error('closing the task did not return to the home screen')
  if (closed.includes('Step 1 of')) throw new Error('the guided task is still on screen after closing it')
  if (!closed.includes('Tell me what you want to do')) throw new Error('the composer did not come back empty')

  // The task is genuinely gone: with nothing open the Task tab has nothing to show.
  if (!navButton(app.container, 'Task').disabled) {
    throw new Error('the Task tab is still live after closing the task')
  }
  await app.unmount()
})

/* ------------------------------------------------------------------ clearing data */

const FAKE_PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' + 'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' + 'AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

await test('“Delete everything” also clears the live task, its photos and the chat', async () => {
  const app = await runJourney('how do I use this washing machine')
  await click(app.container, 'Settings')
  const previous = globalThis.confirm
  Object.defineProperty(globalThis, 'confirm', { value: () => true, configurable: true, writable: true })
  try {
    await click(app.container, 'Delete everything')
  } finally {
    Object.defineProperty(globalThis, 'confirm', { value: previous, configurable: true, writable: true })
  }

  const raw = localStorage.getItem('vaea.state.v3') ?? ''
  if (raw.includes(FAKE_PHOTO)) throw new Error('a photo survived the delete')

  const state = store.getState()
  if (state.saves.length || state.knowledge.length || state.history.length) {
    throw new Error('saves, knowledge or history survived the delete')
  }
  if (state.settings.apiKey) throw new Error('the API key survived the delete')

  // The in-memory session is what the user actually sees: it has to go too.
  // (The photos it holds are covered directly by the MemoryProbe test below.)
  if (!navButton(app.container, 'Task').disabled) {
    throw new Error('the previous task is still in memory after “Delete everything”')
  }
  await app.unmount()
})

/**
 * The privacy claim is "the photo leaves nothing behind". The session keeps photos
 * as data URLs in React state, so a store-only wipe would leave them in memory.
 */
function MemoryProbe() {
  const session = useSession()
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    session.dispatch({
      type: 'addAttachments',
      attachments: [
        { id: 'photo-1', dataUrl: FAKE_PHOTO, thumb: FAKE_PHOTO, label: 'my machine', kind: 'photo', bytes: 1024 },
      ],
    })
    session.dispatch({
      type: 'success',
      analysis: scenarioAnalysis,
      meta: { demo: true, provider: 'demo', model: 'offline engine', latencyMs: 0, healed: false, notice: 'Demo engine.' },
    })
  }, [session])
  return h(
    'div',
    null,
    h('span', null, `attachments:${session.attachments.length}`),
    h('span', null, `task:${session.analysis ? 'open' : 'closed'}`),
    h('span', null, `chat:${session.chat.length}`),
  )
}

await test('a wipe drops the photos the live session is holding in memory', async () => {
  const view = await mount(h(SessionProvider, null, h(MemoryProbe)))
  if (!view.text().includes('attachments:1')) throw new Error('precondition: the session holds no photo')
  if (!view.text().includes('task:open')) throw new Error('precondition: no task is open')

  await act(async () => {
    store.resetEverything()
  })

  const after = view.text()
  if (!after.includes('attachments:0')) throw new Error(`the photo is still in memory after a wipe — got: ${after}`)
  if (after.includes('task:open')) throw new Error('the open task survived a wipe')
  if (!after.includes('chat:0')) throw new Error('the chat survived a wipe')
  await view.unmount()
})

await test('clearing storage also removes keys from older versions', async () => {
  localStorage.setItem('vaea.state.v2', JSON.stringify({ settings: { apiKey: 'sk-old-key-must-not-survive' } }))
  store.resetEverything()
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600)) // let any debounced write settle
  })
  const v2 = localStorage.getItem('vaea.state.v2')
  const v3 = localStorage.getItem('vaea.state.v3') ?? ''
  if (v2 !== null) throw new Error(`the v2 key survived a full reset: ${v2.slice(0, 80)}`)
  if (v3.includes('sk-old-key-must-not-survive')) throw new Error('an old key came back through the v3 payload')
})

await test('storage holds no key after a reset', async () => {
  store.set({ settings: { ...store.getState().settings, apiKey: 'sk-live-key-123' } })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600))
  })
  store.resetEverything()
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600))
  })
  if ((localStorage.getItem('vaea.state.v3') ?? '').includes('sk-live-key-123')) {
    throw new Error('the live API key is still in localStorage after a reset')
  }
})

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
