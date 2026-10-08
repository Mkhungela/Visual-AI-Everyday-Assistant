/**
 * Session state.
 *
 * A single session is: photos in → analysis out → guided steps → conversation.
 * The whole lifecycle lives here so every view reads from the same source of truth
 * and nothing restarts from zero.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type { ChatMessage } from '../lib/ai/types'
import type { AnalysisResult } from '../lib/schema'
import type { Attachment } from '../lib/store'
import { analysisToChatHistory, buildKitchenContext, knowledgeForPrompt } from '../lib/knowledge'
import {
  analyze as runAnalyze,
  chatTurn,
  intentOptions as runIntentOptions,
  type IntentOption,
  type SessionMeta,
} from '../lib/session'
import { demoScenarioId, type VisualRead } from '../lib/demo/engine'
import { store, useStore } from '../lib/store'
import { uid } from '../lib/utils'
import { speech } from '../lib/speech'

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
  images?: Attachment[]
  pending?: boolean
  error?: boolean
}

export interface SessionState {
  status: 'idle' | 'analyzing' | 'ready' | 'error'
  request: string
  attachments: Attachment[]
  analysis: AnalysisResult | null
  meta: SessionMeta | null
  visualRead: VisualRead | null
  intent: { goal: string; options: IntentOption[]; clarify: string } | null
  error: string | null
  answers: { question: string; answer: string }[]
  chat: ChatEntry[]
  /** 0-based index of the step the user is on */
  stepIndex: number
  completed: Record<number, boolean>
  savedId: string | null
  scenarioId?: string
  chatOpen: boolean
}

const initialState: SessionState = {
  status: 'idle',
  request: '',
  attachments: [],
  analysis: null,
  meta: null,
  visualRead: null,
  intent: null,
  error: null,
  answers: [],
  chat: [],
  stepIndex: 0,
  completed: {},
  savedId: null,
  chatOpen: false,
}

type Action =
  | { type: 'reset' }
  | { type: 'setRequest'; request: string }
  | { type: 'addAttachments'; attachments: Attachment[] }
  | { type: 'removeAttachment'; id: string }
  | { type: 'clearAttachments' }
  | { type: 'labelAttachment'; id: string; label: string }
  | { type: 'start' }
  | {
      type: 'success'
      analysis: AnalysisResult
      meta: SessionMeta
      visualRead?: VisualRead
      intent?: SessionState['intent']
    }
  | { type: 'fail'; error: string }
  | { type: 'answer'; question: string; answer: string }
  | { type: 'setStep'; index: number }
  | { type: 'toggleComplete'; index: number }
  | { type: 'chatAdd'; entry: ChatEntry }
  | { type: 'chatUpdate'; id: string; patch: Partial<ChatEntry> }
  | { type: 'chatOpen'; open: boolean }
  | { type: 'saved'; id: string | null }
  | { type: 'hydrate'; analysis: AnalysisResult; request: string; savedId: string }

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'reset':
      return { ...initialState }
    case 'setRequest':
      return { ...state, request: action.request }
    case 'addAttachments': {
      const attachments = [...state.attachments, ...action.attachments].slice(0, 10)
      return { ...state, attachments }
    }
    case 'removeAttachment':
      return { ...state, attachments: state.attachments.filter((a) => a.id !== action.id) }
    case 'clearAttachments':
      return { ...state, attachments: [] }
    case 'labelAttachment':
      return {
        ...state,
        attachments: state.attachments.map((a) => (a.id === action.id ? { ...a, label: action.label } : a)),
      }
    case 'start':
      return { ...state, status: 'analyzing', error: null }
    case 'success': {
      const scenarioId = action.meta.demo
        ? demoScenarioId(
            [state.request, ...state.answers.map((a) => `${a.question} ${a.answer}`)].join('. '),
            action.visualRead?.category ?? 'unknown',
          )
        : undefined
      return {
        ...state,
        status: 'ready',
        analysis: action.analysis,
        meta: action.meta,
        visualRead: action.visualRead ?? null,
        intent: action.intent ?? null,
        scenarioId,
        error: null,
        stepIndex: 0,
        completed: {},
        savedId: null,
      }
    }
    case 'fail':
      return { ...state, status: 'error', error: action.error }
    case 'answer':
      return {
        ...state,
        answers: [...state.answers.filter((a) => a.question !== action.question), action],
      }
    case 'setStep':
      return { ...state, stepIndex: Math.max(0, action.index) }
    case 'toggleComplete':
      return { ...state, completed: { ...state.completed, [action.index]: !state.completed[action.index] } }
    case 'chatAdd':
      return { ...state, chat: [...state.chat, action.entry] }
    case 'chatUpdate':
      return { ...state, chat: state.chat.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }
    case 'chatOpen':
      return { ...state, chatOpen: action.open }
    case 'saved':
      return { ...state, savedId: action.id }
    case 'hydrate':
      return {
        ...initialState,
        status: 'ready',
        analysis: action.analysis,
        request: action.request,
        savedId: action.savedId,
        attachments: [],
        chat: [
          {
            id: uid('c'),
            role: 'assistant',
            text: `Restored from your saved tasks. ${action.analysis.summary}`,
            at: Date.now(),
          },
        ],
      }
    default:
      return state
  }
}

interface SessionContextValue extends SessionState {
  dispatch: React.Dispatch<Action>
  run: (overrideRequest?: string) => Promise<void>
  askAboutIntent: (option: IntentOption) => Promise<void>
  send: (message: string, images?: Attachment[]) => Promise<void>
  answer: (question: string, answer: string) => Promise<void>
  loadSaved: (id: string) => boolean
  reset: () => void
  abort: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const app = useStore()
  const abortRef = useRef<AbortController | null>(null)
  const historyRef = useRef<ChatMessage[]>([])

  /**
   * "Delete everything" wipes the store, but the live task — its photos, the
   * analysis and the chat — only exists here. Subscribe to the reset signal so a
   * wipe from anywhere (Settings today, anywhere tomorrow) really clears it.
   */
  useEffect(
    () =>
      store.onReset(() => {
        abortRef.current?.abort()
        abortRef.current = null
        historyRef.current = []
        speech.stop()
        dispatch({ type: 'reset' })
      }),
    [],
  )

  // Keep the conversation history the model sees in sync with what the user sees.
  useEffect(() => {
    if (!state.analysis) {
      historyRef.current = []
      return
    }
    const base = analysisToChatHistory(state.analysis)
    const turns: ChatMessage[] = state.chat
      .filter((c) => !c.pending && !c.error)
      .map((c) => ({
        role: c.role,
        parts: [
          ...(c.images?.length
            ? c.images.map((img) => ({ type: 'image' as const, mimeType: 'image/jpeg', data: img.dataUrl }))
            : []),
          { type: 'text' as const, text: c.text },
        ],
      }))
    historyRef.current = [...base, ...turns]
  }, [state.analysis, state.chat])

  const run = useCallback(
    async (overrideRequest?: string) => {
      const request = (overrideRequest ?? state.request).trim()
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      dispatch({ type: 'start' })

      try {
        const outcome = await runAnalyze({
          request,
          attachments: state.attachments,
          settings: app.settings,
          persona: app.persona,
          personalKnowledge: knowledgeForPrompt(app.knowledge),
          answers: state.answers,
          kitchen: buildKitchenContext(app.knowledge),
          equipment: [],
          youtubeKey: app.youtubeKey,
          signal: controller.signal,
        })

        // A quick "what would you like to do?" pass, only when the user did not say.
        let intent: SessionState['intent'] = null
        if (!request && outcome.analysis.objects.length) {
          intent = await runIntentOptions({
            request,
            analysis: outcome.analysis,
            settings: app.settings,
            persona: app.persona,
          }).catch(() => null)
        }

        dispatch({
          type: 'success',
          analysis: outcome.analysis,
          meta: outcome.meta,
          visualRead: outcome.visualRead,
          intent,
        })

        store.set((s) => ({ stats: { ...s.stats, analyses: s.stats.analyses + 1 } }))
        store.recordSession({
          id: uid('sess'),
          title: outcome.analysis.title,
          intent: outcome.analysis.intent,
          summary: outcome.analysis.summary.slice(0, 200),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          turns: 1,
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        dispatch({ type: 'fail', error: err instanceof Error ? err.message : 'Something went wrong.' })
      }
    },
    [state.request, state.attachments, state.answers, app.settings, app.persona, app.knowledge, app.youtubeKey],
  )

  /** The user tapped one of "Understand it / Use it / Fix it". */
  const askAboutIntent = useCallback(
    async (option: IntentOption) => {
      const question = `I want to ${option.label.toLowerCase()}. ${option.description}`
      dispatch({ type: 'setRequest', request: question })
      await run(question)
    },
    [run],
  )

  const send = useCallback(
    async (message: string, images?: Attachment[]) => {
      if (!state.analysis || !message.trim()) return
      const userEntry: ChatEntry = { id: uid('c'), role: 'user', text: message.trim(), at: Date.now(), images }
      const pendingId = uid('c')
      dispatch({ type: 'chatAdd', entry: userEntry })
      dispatch({ type: 'chatAdd', entry: { id: pendingId, role: 'assistant', text: '', at: Date.now(), pending: true } })

      try {
        const result = await chatTurn({
          message: message.trim(),
          analysis: state.analysis,
          history: historyRef.current,
          images,
          settings: app.settings,
          persona: app.persona,
          scenarioId: state.scenarioId,
          stepIndex: state.stepIndex,
          personalKnowledge: knowledgeForPrompt(app.knowledge),
        })
        dispatch({ type: 'chatUpdate', id: pendingId, patch: { text: result.reply, pending: false } })
      } catch (err) {
        dispatch({
          type: 'chatUpdate',
          id: pendingId,
          patch: {
            text: err instanceof Error ? err.message : 'I could not reach the assistant.',
            pending: false,
            error: true,
          },
        })
      }
    },
    [state.analysis, state.scenarioId, state.stepIndex, app.settings, app.persona, app.knowledge],
  )

  /** A follow-up answer changes the situation, so we re-run with it folded in. */
  const answer = useCallback(
    async (question: string, value: string) => {
      dispatch({ type: 'answer', question, answer: value })
      const nextAnswers = [...state.answers.filter((a) => a.question !== question), { question, answer: value }]
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      dispatch({ type: 'start' })
      try {
        const outcome = await runAnalyze({
          request: state.request,
          attachments: state.attachments,
          settings: app.settings,
          persona: app.persona,
          personalKnowledge: knowledgeForPrompt(app.knowledge),
          answers: nextAnswers,
          kitchen: buildKitchenContext(app.knowledge),
          youtubeKey: app.youtubeKey,
          signal: controller.signal,
        })
        dispatch({ type: 'success', analysis: outcome.analysis, meta: outcome.meta, visualRead: outcome.visualRead })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        dispatch({ type: 'fail', error: err instanceof Error ? err.message : 'Something went wrong.' })
      }
    },
    [state.answers, state.request, state.attachments, app.settings, app.persona, app.knowledge, app.youtubeKey],
  )

  const loadSaved = useCallback((id: string) => {
    const saved = store.getState().saves.find((s) => s.id === id)
    if (!saved) return false
    speech.stop()
    dispatch({ type: 'hydrate', analysis: saved.analysis, request: saved.title, savedId: saved.id })
    return true
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    speech.stop()
    dispatch({ type: 'reset' })
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, dispatch, run, askAboutIntent, send, answer, loadSaved, reset, abort }),
    [state, run, askAboutIntent, send, answer, loadSaved, reset, abort],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}

/* ------------------------------------------------------------------ derived helpers */

export function useStep() {
  const { analysis, stepIndex } = useSession()
  const steps = analysis?.steps ?? []
  return {
    steps,
    index: Math.min(stepIndex, Math.max(0, steps.length - 1)),
    current: steps[Math.min(stepIndex, Math.max(0, steps.length - 1))],
    isFirst: stepIndex === 0,
    isLast: stepIndex >= steps.length - 1,
    total: steps.length,
  }
}
