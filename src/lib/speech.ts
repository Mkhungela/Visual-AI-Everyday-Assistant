/**
 * Voice in and voice out.
 *
 * Out: browser SpeechSynthesis first (instant, free, offline), with optional cloud
 *      voices — Gemini's multilingual TTS and OpenAI's — for languages the browser
 *      does not carry, which for South African users is most of them.
 * In:  the browser's SpeechRecognition where available.
 *
 * The controller is queue-based so "do it with me" can speak step 3 while the UI
 * highlights step 3, and so a long answer can be stopped mid-sentence.
 */

import { useEffect, useState } from 'react'
import { useStore } from './store'
import { speechChunks } from './utils'
import { splitDataUrl } from './images'

export interface SpeakItem {
  id: string
  text: string
  lang?: string
}

export interface SpeechState {
  speaking: boolean
  paused: boolean
  currentId: string | null
  /** 0..1 through the current item's chunks */
  progress: number
  supported: boolean
  error: string | null
}

const initialSpeechState: SpeechState = {
  speaking: false,
  paused: false,
  currentId: null,
  progress: 0,
  supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  error: null,
}

class SpeechController {
  private state: SpeechState = { ...initialSpeechState }
  private listeners = new Set<() => void>()
  private queue: SpeakItem[] = []
  private index = 0
  private audio: HTMLAudioElement | null = null
  private abort: AbortController | null = null
  private useCloud = false

  getState = () => this.state

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(patch: Partial<SpeechState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l()
  }

  /** Voices the operating system exposes. Empty on browsers without the API. */
  static voices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
    return window.speechSynthesis.getVoices()
  }

  /**
   * Speak a list of items in order. Items let the UI know which step is reading.
   * `cloud` opts into the provider's TTS when a key is present.
   */
  async play(items: SpeakItem[], opts: { rate?: number; pitch?: number; voiceURI?: string; cloud?: boolean; providerKey?: string; provider?: string } = {}) {
    this.stop()
    const usable = items.filter((i) => i.text?.trim())
    if (!usable.length) return
    this.queue = usable
    this.index = 0
    this.useCloud = Boolean(opts.cloud && opts.providerKey)
    this.set({ speaking: true, paused: false, error: null, progress: 0 })
    try {
      for (; this.index < this.queue.length; this.index++) {
        const item = this.queue[this.index]
        this.set({ currentId: item.id, progress: 0 })
        if (this.useCloud) await this.speakCloud(item, opts)
        else await this.speakBrowser(item, opts)
      }
    } catch (err) {
      this.set({ error: err instanceof Error ? err.message : 'Voice playback failed.' })
    } finally {
      this.set({ speaking: false, paused: false, currentId: null, progress: 0 })
      this.audio = null
    }
  }

  private async speakCloud(item: SpeakItem, opts: { rate?: number; providerKey?: string; provider?: string; voiceURI?: string }) {
    const chunks = speechChunks(item.text)
    for (let i = 0; i < chunks.length; i++) {
      const url = await cloudAudioUrl({
        text: chunks[i],
        provider: opts.provider ?? 'gemini',
        apiKey: opts.providerKey ?? '',
        voice: opts.voiceURI,
      })
      if (!url) return this.speakBrowser(item, opts)
      await this.playAudio(url)
      this.set({ progress: (i + 1) / chunks.length })
    }
  }

  private playAudio(url: string) {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(url)
      audio.playbackRate = 1
      this.audio = audio
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('Audio playback failed.'))
      audio.play().catch(reject)
    })
  }

  private speakBrowser(item: SpeakItem, opts: { rate?: number; pitch?: number; voiceURI?: string }) {
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve()
      const chunks = speechChunks(item.text)
      let i = 0
      const next = () => {
        if (i >= chunks.length) return resolve()
        const u = new SpeechSynthesisUtterance(chunks[i])
        u.rate = opts.rate ?? 1
        u.pitch = opts.pitch ?? 1
        const voices = SpeechController.voices()
        const match =
          voices.find((v) => v.voiceURI === opts.voiceURI) ??
          voices.find((v) => v.lang?.toLowerCase().startsWith((item.lang ?? 'en').slice(0, 2).toLowerCase()))
        if (match) {
          u.voice = match
          u.lang = match.lang
        } else if (item.lang) {
          u.lang = item.lang
        }
        u.onend = () => {
          i++
          this.set({ progress: i / chunks.length })
          next()
        }
        u.onerror = () => resolve()
        window.speechSynthesis.speak(u)
      }
      next()
    })
  }

  pause() {
    if (this.audio) this.audio.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.pause()
    this.set({ paused: true })
  }

  resume() {
    if (this.audio) void this.audio.play()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.resume()
    this.set({ paused: false })
  }

  stop() {
    this.abort?.abort()
    this.abort = null
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    this.queue = []
    this.index = 0
    this.set({ speaking: false, paused: false, currentId: null, progress: 0 })
  }
}

export const speech = new SpeechController()

export function useSpeech(): SpeechState {
  const [state, setState] = useState<SpeechState>(() => speech.getState())
  useEffect(() => speech.subscribe(() => setState(speech.getState())) as unknown as () => void, [])
  return state
}

/* -------------------------------------------------------------- cloud TTS */

async function cloudAudioUrl(args: {
  text: string
  provider: string
  apiKey: string
  /** voice name; provider-specific */
  voice?: string
}): Promise<string | null> {
  const { text, provider, apiKey, voice } = args
  if (!apiKey) return null
  try {
    if (provider === 'openai' || provider === 'openrouter' || provider === 'custom' || provider === 'groq') {
      const base =
        provider === 'openai'
          ? 'https://api.openai.com/v1'
          : provider === 'groq'
            ? 'https://api.groq.com/openai/v1'
            : provider === 'openrouter'
              ? 'https://openrouter.ai/api/v1'
              : ''
      if (!base) return null
      const res = await fetch(`${base}/audio/speech`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: voice || 'alloy',
          input: text,
          response_format: 'mp3',
        }),
      })
      if (!res.ok) return null
      return URL.createObjectURL(await res.blob())
    }

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } },
              },
            },
          }),
        },
      )
      if (!res.ok) return null
      const data = await res.json()
      const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data)
      const b64 = part?.inlineData?.data
      const mime: string = part?.inlineData?.mimeType ?? 'audio/L16;rate=24000'
      if (!b64) return null
      const rate = Number(mime.match(/rate=(\d+)/)?.[1] ?? 24000)
      return URL.createObjectURL(pcmBase64ToWavBlob(b64, rate))
    }
  } catch {
    return null
  }
  return null
}

/** Gemini returns raw 16-bit PCM; browsers want a container, so wrap it in a WAV. */
export function pcmBase64ToWavBlob(b64: string, sampleRate: number, channels = 1): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  const byteRate = sampleRate * channels * 2
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + bytes.length, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, bytes.length, true)

  return new Blob([header, bytes], { type: 'audio/wav' })
}

/* -------------------------------------------------------------- speech in */

export interface ListenHandle {
  stop: () => void
  abort: () => void
}

export function listeningSupported() {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/**
 * Start dictation. `onPartial` fires continuously so the UI can show live words.
 * Returns null when the browser has no speech recognition.
 */
export function startListening(opts: {
  lang: string
  onPartial?: (text: string) => void
  onFinal: (text: string) => void
  onError?: (message: string) => void
  onEnd?: () => void
}): ListenHandle | null {
  const w = window as unknown as Record<string, any>
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) {
    opts.onError?.('This browser cannot do speech-to-text. Type instead — or use Chrome.')
    return null
  }

  const rec = new Ctor()
  rec.lang = opts.lang
  rec.continuous = true
  rec.interimResults = true
  rec.maxAlternatives = 1

  let finalText = ''
  let stopped = false

  rec.onresult = (event: any) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i]
      if (res.isFinal) finalText += res[0].transcript
      else interim += res[0].transcript
    }
    if (interim) opts.onPartial?.(finalText + interim)
    else if (finalText) opts.onPartial?.(finalText)
  }
  rec.onerror = (e: any) => {
    const map: Record<string, string> = {
      'not-allowed': 'Microphone permission was blocked. Allow it in your browser settings.',
      'service-not-allowed': 'Speech recognition is unavailable on this connection.',
      'no-speech': 'I did not hear anything. Try again a bit closer to the mic.',
      network: 'Speech recognition needs a network connection.',
      aborted: '',
    }
    const msg = map[e?.error ?? ''] ?? `Speech recognition stopped (${e?.error ?? 'unknown'}).`
    if (msg) opts.onError?.(msg)
  }
  rec.onend = () => {
    if (!stopped) {
      // Chrome ends the session after a pause; restart so the user can keep talking.
      try {
        rec.start()
        return
      } catch {
        /* fall through */
      }
    }
    if (finalText.trim()) opts.onFinal(finalText.trim())
    opts.onEnd?.()
  }

  try {
    rec.start()
  } catch {
    opts.onError?.('Could not start listening.')
    return null
  }

  return {
    stop: () => {
      stopped = true
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
      if (finalText.trim()) opts.onFinal(finalText.trim())
    },
    abort: () => {
      stopped = true
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    },
  }
}

/* -------------------------------------------------------------- hook */

/** Speak any text with the user's saved preferences. */
export function useSpeaker() {
  const voice = useStore().voice
  const settings = useStore().settings
  return {
    speak: (items: SpeakItem[] | string, opts?: { rate?: number }) => {
      const list = typeof items === 'string' ? [{ id: 'text', text: items }] : items
      const needsCloud = list.some((i) => {
        const lang = i.lang ?? voice.language
        const meta = LANG_VOICE_SUPPORT[lang]
        return (voice.preferCloud || meta === false) && Boolean(settings.apiKey)
      })
      return speech.play(list, {
        rate: opts?.rate ?? voice.rate,
        pitch: voice.pitch,
        voiceURI: voice.voiceURI,
        cloud: needsCloud,
        providerKey: settings.apiKey,
        provider: settings.provider,
      })
    },
    stop: () => speech.stop(),
    pause: () => speech.pause(),
    resume: () => speech.resume(),
  }
}

/** Which languages the browser's own voices realistically handle. */
export const LANG_VOICE_SUPPORT: Record<string, boolean> = {
  'en-ZA': true,
  'en-GB': true,
  'en-US': true,
  'af-ZA': true,
  'zu-ZA': false,
  'xh-ZA': false,
  'st-ZA': false,
  'tn-ZA': false,
  'nso-ZA': false,
  'ts-ZA': false,
  'ss-ZA': false,
  've-ZA': false,
  'nr-ZA': false,
}
