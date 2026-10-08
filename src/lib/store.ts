/**
 * App state.
 *
 * A tiny observable store + `useSyncExternalStore`. No state library, because the
 * whole app is one screen deep and everything persists to localStorage anyway.
 *
 * Privacy note: API keys live in localStorage on this device only. They are never
 * sent anywhere except (optionally) this app's own relay endpoint, and never logged.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { AnalysisResult, TaskMode } from './schema'
import { DEFAULT_SETTINGS, type AISettings } from './ai/client'
import { DEFAULT_PERSONA, type Persona } from './prompts'

export interface Attachment {
  id: string
  dataUrl: string
  thumb: string
  label: string
  kind: 'photo' | 'screenshot' | 'before' | 'after' | 'frame' | 'ingredient'
  bytes: number
}

export interface SavedTask {
  id: string
  title: string
  summary: string
  intent: TaskMode
  createdAt: number
  updatedAt: number
  thumb: string
  analysis: AnalysisResult
  pinned: boolean
  tags: string[]
  /** user's own notes, e.g. "our machine is the Bosch one under the stairs" */
  notes: string
  /** how far they got last time */
  stepReached: number
}

export interface KnowledgeEntry {
  id: string
  kind: 'appliance' | 'vehicle' | 'tool' | 'kitchen' | 'home' | 'other'
  name: string
  detail: string
  thumb?: string
  createdAt: number
}

export interface SessionRecord {
  id: string
  title: string
  intent: TaskMode
  summary: string
  createdAt: number
  updatedAt: number
  turns: number
}

export interface VoicePrefs {
  enabled: boolean
  language: string
  voiceURI: string
  rate: number
  pitch: number
  /** speak each step automatically in guided mode */
  autoSpeak: boolean
  /** prefer the model's cloud TTS over the browser's built-in voice */
  preferCloud: boolean
}

export interface AppState {
  version: number
  onboarded: boolean
  settings: AISettings
  youtubeKey: string
  persona: Persona
  voice: VoicePrefs
  saves: SavedTask[]
  knowledge: KnowledgeEntry[]
  history: SessionRecord[]
  stats: { analyses: number; stepsCompleted: number }
}

/**
 * Languages offered in Settings.
 *
 * All twelve of South Africa's official languages are listed. `tts`/`stt` describe what
 * the *browser's own* engines realistically handle; the rest route to cloud speech when
 * the user has a key, and the app says plainly when it cannot speak a language rather
 * than pretending. Listing a language with `false` is deliberate: the user can still ask
 * and read in it, and a language that is absent from this list cannot be selected at all.
 */
export const LANGUAGES = [
  { code: 'en-ZA', label: 'English (South Africa)', tts: true, stt: true },
  { code: 'af-ZA', label: 'Afrikaans', tts: true, stt: true },
  { code: 'zu-ZA', label: 'isiZulu', tts: false, stt: false },
  { code: 'xh-ZA', label: 'isiXhosa', tts: false, stt: false },
  { code: 'st-ZA', label: 'Sesotho', tts: false, stt: false },
  { code: 'tn-ZA', label: 'Setswana', tts: false, stt: false },
  { code: 'nso-ZA', label: 'Sepedi (Sesotho sa Leboa)', tts: false, stt: false },
  { code: 'ts-ZA', label: 'Xitsonga', tts: false, stt: false },
  { code: 'ss-ZA', label: 'siSwati', tts: false, stt: false },
  { code: 've-ZA', label: 'Tshivenda', tts: false, stt: false },
  { code: 'nr-ZA', label: 'isiNdebele', tts: false, stt: false },
  { code: 'en-GB', label: 'English (UK)', tts: true, stt: true },
  { code: 'en-US', label: 'English (US)', tts: true, stt: true },
]

export const LANGUAGE_NAMES: Record<string, string> = {
  'en-ZA': 'South African English',
  'af-ZA': 'Afrikaans',
  'zu-ZA': 'isiZulu',
  'xh-ZA': 'isiXhosa',
  'st-ZA': 'Sesotho',
  'tn-ZA': 'Setswana',
  'nso-ZA': 'Sepedi',
  'ts-ZA': 'Xitsonga',
  'ss-ZA': 'siSwati',
  've-ZA': 'Tshivenda',
  'nr-ZA': 'isiNdebele',
  'en-GB': 'British English',
  'en-US': 'American English',
}

const STORAGE_KEY = 'vaea.state.v3'

/**
 * Older payloads we still hydrate from. They have to be erased by a reset too —
 * forgetting one means a stale API key or photo can come back on the next load.
 */
const LEGACY_KEYS = ['vaea.state.v2']

const initialState: AppState = {
  version: 3,
  onboarded: false,
  settings: DEFAULT_SETTINGS,
  youtubeKey: '',
  persona: DEFAULT_PERSONA,
  voice: {
    enabled: true,
    language: 'en-ZA',
    voiceURI: '',
    rate: 1,
    pitch: 1,
    autoSpeak: false,
    preferCloud: false,
  },
  saves: [],
  knowledge: [],
  history: [],
  stats: { analyses: 0, stepsCompleted: 0 },
}

/* ------------------------------------------------------------------ store */

type Listener = () => void

class Store {
  private state: AppState = initialState
  private listeners = new Set<Listener>()
  private resetListeners = new Set<Listener>()
  private saveTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.hydrate()
  }

  getState = () => this.state

  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /**
   * Fires after the user wipes everything. The live task, its photos and the chat
   * live in React state, not in this store, so anything holding them has to clear
   * itself — otherwise "delete everything" leaves the previous photo on screen.
   */
  onReset = (fn: Listener): (() => void) => {
    this.resetListeners.add(fn)
    return () => {
      this.resetListeners.delete(fn)
    }
  }

  set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    const next = typeof patch === 'function' ? patch(this.state) : patch
    this.state = { ...this.state, ...next }
    this.emit()
  }

  /** Immutably update one array field. */
  update = <K extends keyof AppState>(key: K, fn: (value: AppState[K]) => AppState[K]) => {
    this.state = { ...this.state, [key]: fn(this.state[key]) }
    this.emit()
  }

  private emit() {
    for (const l of this.listeners) l()
    this.scheduleSave()
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.persist(), 400)
  }

  private persist() {
    try {
      const state = { ...this.state }
      // Keep the stored payload small — trims history, never lets saves blow the quota.
      state.history = state.history.slice(0, 60)
      state.saves = state.saves.slice(0, 80)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      // Quota exceeded: drop the heaviest, least important things first.
      try {
        const state = { ...this.state, history: [], saves: this.state.saves.slice(0, 12) }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* give up silently — the session still works in memory */
      }
    }
  }

  private hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? (LEGACY_KEYS[0] ? localStorage.getItem(LEGACY_KEYS[0]) : null)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<AppState>
      this.state = {
        ...initialState,
        ...parsed,
        version: 3,
        settings: { ...initialState.settings, ...(parsed.settings ?? {}) },
        persona: { ...initialState.persona, ...(parsed.persona ?? {}) },
        voice: { ...initialState.voice, ...(parsed.voice ?? {}) },
        stats: { ...initialState.stats, ...(parsed.stats ?? {}) },
        saves: Array.isArray(parsed.saves) ? parsed.saves : [],
        knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
      }
    } catch {
      this.state = initialState
    }
  }

  /* --------------------------------------------------------- convenience */

  saveTask(task: SavedTask) {
    this.update('saves', (saves) => {
      const existing = saves.findIndex((s) => s.id === task.id)
      if (existing >= 0) {
        const next = [...saves]
        next[existing] = { ...task, updatedAt: Date.now() }
        return next
      }
      return [task, ...saves]
    })
  }

  removeSave(id: string) {
    this.update('saves', (saves) => saves.filter((s) => s.id !== id))
  }

  togglePin(id: string) {
    this.update('saves', (saves) => saves.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)))
  }

  addKnowledge(entry: KnowledgeEntry) {
    this.update('knowledge', (k) => [entry, ...k])
  }

  removeKnowledge(id: string) {
    this.update('knowledge', (k) => k.filter((e) => e.id !== id))
  }

  recordSession(rec: SessionRecord) {
    this.update('history', (h) => {
      const idx = h.findIndex((x) => x.id === rec.id)
      if (idx >= 0) {
        const next = [...h]
        next[idx] = { ...next[idx], ...rec }
        return next
      }
      return [rec, ...h].slice(0, 60)
    })
  }

  clearHistory() {
    this.set({ history: [] })
  }

  resetEverything() {
    // Tidy the pending debounce. It is not a correctness fix — persist() reads
    // this.state when it fires, so a stale timer writes the clean state anyway.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = undefined
    }

    // Keeping `onboarded` means a wipe does not force the intro screens again.
    this.state = { ...initialState, onboarded: true }

    // Every key this app has ever written, current and legacy.
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore — private mode or a hostile storage shim */
      }
    }

    // Write the clean state back deliberately. Removing without rewriting leaves
    // a window where a legacy key can be rehydrated on the next load.
    this.persist()

    // Tell screens holding session data (photos, analysis, chat) to drop it.
    for (const fn of this.resetListeners) fn()

    this.emit()
  }

  exportState() {
    return JSON.stringify({ ...this.state, settings: { ...this.state.settings, apiKey: '' } }, null, 2)
  }
}

export const store = new Store()

/* ------------------------------------------------------------------ hooks */

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

/**
 * Subscribe with a selector. The selected value must be referentially stable when
 * unchanged (select primitives, or memoise) or this will loop.
 */
export function useSelector<T>(selector: (s: AppState) => T, isEqual?: (a: T, b: T) => boolean): T {
  const cache = useRef<{ value: T; has: boolean }>({ value: undefined as unknown as T, has: false })
  const getSnapshot = useCallback(() => {
    const next = selector(store.getState())
    if (!cache.current.has) {
      cache.current = { value: next, has: true }
      return next
    }
    const same = isEqual ? isEqual(cache.current.value, next) : Object.is(cache.current.value, next)
    if (!same) cache.current = { value: next, has: true }
    return cache.current.value
  }, [selector, isEqual])
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
