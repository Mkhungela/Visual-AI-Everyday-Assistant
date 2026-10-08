/**
 * Capture.
 *
 * The front door of the whole product has to be one tap. Camera where the browser
 * allows it, the device's own camera app where it does not, file upload, screen
 * capture on desktop, and voice — all reachable without deciding what category your
 * problem belongs to.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  attachmentFromDataUrl,
  attachmentsFromFiles,
  captureScreen,
  grabFrame,
  startCamera,
  type CameraHandle,
} from '../lib/capture'
import { listeningSupported, startListening } from '../lib/speech'
import { LANGUAGES, useStore, type Attachment } from '../lib/store'
import { cx } from '../lib/utils'
import { Button, Icon, Sheet, Spinner, useToast } from './ui'

/* ------------------------------------------------------------------ helpers */

export function useAttachmentPicker() {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const handleFiles = useCallback(
    async (files: FileList | null, onDone: (list: Attachment[], note?: string) => void) => {
      if (!files?.length) return
      setBusy(true)
      try {
        const result = await attachmentsFromFiles(Array.from(files), { multiple: files.length > 1 })
        if (result.attachments.length) onDone(result.attachments, result.note)
        else if (result.note) toast.show(result.note)
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'That file could not be read.')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  const inputs = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files, () => {})
          e.target.value = ''
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files, () => {})
          e.target.value = ''
        }}
      />
    </>
  )

  return { fileRef, cameraRef, busy, handleFiles, inputs, toast }
}

/* ------------------------------------------------------------------ camera sheet */

export function CameraSheet({
  open,
  onClose,
  onCapture,
}: {
  open: boolean
  onClose: () => void
  onCapture: (list: Attachment[], note?: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleRef = useRef<CameraHandle | null>(null)
  const [state, setState] = useState<'starting' | 'live' | 'blocked'>('starting')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [message, setMessage] = useState('')
  const [shot, setShot] = useState<Attachment | null>(null)
  const [flash, setFlash] = useState(false)
  const fallbackRef = useRef<HTMLInputElement>(null)

  const stop = useCallback(() => {
    handleRef.current?.stop()
    handleRef.current = null
  }, [])

  const begin = useCallback(
    async (mode: 'environment' | 'user') => {
      stop()
      setState('starting')
      setMessage('')
      try {
        const handle = await startCamera(mode)
        handleRef.current = handle
        if (videoRef.current) {
          videoRef.current.srcObject = handle.stream
          await videoRef.current.play().catch(() => {})
        }
        setState('live')
      } catch (err) {
        setState('blocked')
        setMessage(err instanceof Error ? err.message : 'The camera could not be started.')
      }
    },
    [stop],
  )

  useEffect(() => {
    if (!open) {
      stop()
      setShot(null)
      return
    }
    void begin(facing)
    return stop
  }, [open, facing, begin, stop])

  const take = async () => {
    if (!videoRef.current) return
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
    try {
      const attachment = await grabFrame(videoRef.current)
      setShot(attachment)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not take the photo.')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Show me" full>
      <div className="flex h-full flex-col">
        <div className="relative flex-1 overflow-hidden bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />

          {state === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-300">
              <Spinner className="h-6 w-6" />
              <p className="text-xs">Starting the camera…</p>
            </div>
          )}

          {state === 'blocked' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-ink-400">
                <Icon.Camera size={40} />
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-ink-200">{message}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    onClose()
                    fallbackRef.current?.click()
                  }}
                >
                  <Icon.Camera size={16} /> Use my camera app
                </Button>
                <Button onClick={() => void begin(facing)}>
                  <Icon.Refresh size={15} /> Try again
                </Button>
              </div>
              <input
                ref={fallbackRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={async (e) => {
                  const files = e.target.files
                  if (files?.length) {
                    const r = await attachmentsFromFiles(Array.from(files))
                    onCapture(r.attachments, r.note)
                  }
                  e.target.value = ''
                  onClose()
                }}
              />
            </div>
          )}

          {state === 'live' && (
            <>
              <div className="pointer-events-none absolute inset-6 rounded-3xl border border-white/15" />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center p-4">
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
                  Point at whatever you need help with
                </span>
              </div>
            </>
          )}

          {flash && <div className="absolute inset-0 bg-white/70" />}

          {shot && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 p-6">
              <img src={shot.dataUrl} alt="" className="max-h-[52vh] w-auto rounded-xl object-contain" />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShot(null)}>
                  <Icon.Refresh size={15} /> Retake
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onCapture([shot])
                    onClose()
                  }}
                >
                  <Icon.Check size={16} /> Use this
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/8 bg-ink-900 px-5 py-4 safe-bottom">
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-ink-200 transition hover:bg-white/8"
            title="Switch camera"
          >
            <Icon.Refresh size={18} />
          </button>

          <button
            type="button"
            onClick={take}
            disabled={state !== 'live' || !!shot}
            className="anim-ring flex h-[68px] w-[68px] items-center justify-center rounded-full border-[3px] border-white/85 bg-white/15 transition active:scale-95 disabled:opacity-30"
            title="Take a photo"
          >
            <span className="h-[52px] w-[52px] rounded-full bg-white/90" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose()
              fallbackRef.current?.click()
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-ink-200 transition hover:bg-white/8"
            title="Choose a photo instead"
          >
            <Icon.Upload size={18} />
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ voice sheet */

export function VoiceSheet({
  open,
  onClose,
  onResult,
}: {
  open: boolean
  onClose: () => void
  onResult: (text: string) => void
}) {
  const voice = useStore().voice
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const handleRef = useRef<ReturnType<typeof startListening> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    handleRef.current?.stop()
    handleRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    setError('')
    setText('')
    setElapsed(0)
    if (!listeningSupported()) {
      setError('This browser cannot do speech-to-text. Chrome or Edge work best — or just type below.')
      return
    }
    setListening(true)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    handleRef.current = startListening({
      lang: voice.language,
      onPartial: (t) => setText(t),
      onFinal: (t) => setText(t),
      onError: (m) => {
        setError(m)
        setListening(false)
      },
      onEnd: () => {
        setListening(false)
        if (timerRef.current) clearInterval(timerRef.current)
      },
    })
  }, [voice.language])

  useEffect(() => {
    if (!open) {
      stop()
      setText('')
      setError('')
      return
    }
    start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} title="Ask me">
      <div className="flex flex-col items-center gap-5 p-6">
        <button
          type="button"
          onClick={() => (listening ? stop() : start())}
          className={cx(
            'flex h-24 w-24 items-center justify-center rounded-full transition active:scale-95',
            listening
              ? 'anim-ring bg-gradient-to-br from-rose-brand to-brand-500 text-white'
              : 'border border-white/12 bg-white/6 text-ink-200 hover:bg-white/10',
          )}
        >
          {listening ? <Icon.Stop size={30} /> : <Icon.Mic size={30} />}
        </button>

        <p className="text-center text-sm text-ink-300">
          {listening ? (
            <>
              Listening… speak naturally.
              <span className="ml-1.5 font-mono text-xs text-ink-400">
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            </>
          ) : text ? (
            'Check the words below, then carry on.'
          ) : (
            'Tap the microphone and just say what you need.'
          )}
        </p>

        <div className="w-full">
          <textarea
            className="field min-h-[92px] resize-none leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. How do I use this washing machine?"
            rows={3}
          />
          <p className="mt-1.5 text-[11px] text-ink-400">
            Language: {LANGUAGES.find((l) => l.code === voice.language)?.label ?? voice.language}
            {!LANGUAGES.find((l) => l.code === voice.language)?.stt ? (
              <span className="text-amber-300"> — speech recognition is usually English-only in browsers; type here for other languages.</span>
            ) : null}
          </p>
        </div>

        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

        <div className="flex w-full gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!text.trim()}
            onClick={() => {
              onResult(text.trim())
              onClose()
            }}
          >
            <Icon.ArrowRight size={16} /> Continue
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ composer */

export function Composer({
  value,
  onChange,
  onSubmit,
  attachments,
  onRemoveAttachment,
  onAttach,
  onVoice,
  onCamera,
  busy,
  placeholder,
  compact,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  attachments: Attachment[]
  onRemoveAttachment: (id: string) => void
  onAttach: () => void
  onVoice: () => void
  onCamera: () => void
  busy?: boolean
  placeholder?: string
  compact?: boolean
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className={cx('surface', compact ? 'p-2.5' : 'p-3')}>
      {attachments.length > 0 && (
        <div className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto pb-1">
          {attachments.map((a) => (
            <div key={a.id} className="relative shrink-0">
              <img src={a.thumb} alt={a.label} className="h-16 w-16 rounded-xl border border-white/10 object-cover" />
              <button
                type="button"
                onClick={() => onRemoveAttachment(a.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-ink-900 text-ink-200 shadow hover:text-white"
                title="Remove"
              >
                <Icon.X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          rows={compact ? 1 : 2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onSubmit()
            }
          }}
          placeholder={placeholder ?? 'Tell me what you want to do…'}
          className="field min-h-[44px] flex-1 resize-none border-transparent bg-transparent leading-relaxed focus:border-transparent"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onCamera}
            title="Camera"
            aria-label="Take a photo"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-ink-200 transition hover:bg-white/8"
          >
            <Icon.Camera size={17} />
          </button>
          <button
            type="button"
            onClick={onVoice}
            title="Speak"
            aria-label="Speak instead of typing"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-ink-200 transition hover:bg-white/8"
          >
            <Icon.Mic size={17} />
          </button>
          <button
            type="button"
            onClick={onAttach}
            title="Upload"
            aria-label="Upload a file"
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-ink-200 transition hover:bg-white/8 sm:flex"
          >
            <Icon.Upload size={17} />
          </button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={busy}
            className="h-10 px-3.5"
            aria-label={busy ? 'Working…' : 'Ask'}
            title={busy ? 'Working…' : 'Ask'}
            data-testid="composer-send"
          >
            {busy ? <Spinner /> : <Icon.ArrowRight size={17} />}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ screen capture */

export function useScreenCapture(onCapture: (list: Attachment[], note?: string) => void) {
  const [available, setAvailable] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown }
    setAvailable(Boolean(md?.getDisplayMedia))
  }, [])

  const grab = useCallback(async () => {
    try {
      const attachment = await captureScreen()
      onCapture([attachment])
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Screen capture failed.')
    }
  }, [onCapture, toast])

  return { available, grab, toast }
}

export { attachmentFromDataUrl }
