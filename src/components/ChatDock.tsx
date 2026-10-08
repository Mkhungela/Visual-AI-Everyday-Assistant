/**
 * Conversational follow-up.
 *
 * The conversation is always anchored to the task in progress — "what's next?",
 * "I don't have cheese", "it still isn't working" all resolve against the current
 * analysis rather than starting over. Photos can be sent mid-conversation too, which
 * is what makes "is this right?" work while your hands are busy.
 */

import { useEffect, useRef, useState } from 'react'
import { useSession } from '../state/session'
import { store, useStore, type Attachment } from '../lib/store'
import { useSpeaker } from '../lib/speech'
import { cx, relativeTime } from '../lib/utils'
import { attachmentsFromFiles } from '../lib/capture'
import { Button, Icon, Sheet, Spinner, Toast, useToast } from './ui'
import { VoiceSheet } from './Capture'

export function ChatDock({ open, onClose, onOpenSettings }: { open: boolean; onClose: () => void; onOpenSettings: () => void }) {
  const session = useSession()
  const app = useStore()
  const speaker = useSpeaker()
  const toast = useToast()
  const [text, setText] = useState('')
  const [images, setImages] = useState<Attachment[]>([])
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(app.voice.enabled)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [open, session.chat.length])

  const send = async (message: string) => {
    if (!message.trim() && !images.length) return
    const withImages = images
    setText('')
    setImages([])
    await session.send(message || 'What do you make of this?', withImages)
    if (autoSpeak && app.voice.enabled) {
      const last = session.chat[session.chat.length - 1]
      void last
    }
  }

  const isDemo = session.meta?.demo ?? false

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Chat about this task" full>
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {session.analysis && (
              <div className="rounded-xl border border-white/8 bg-white/4 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Working on</p>
                <p className="mt-0.5 text-sm font-semibold">{session.analysis.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-400">{session.analysis.summary}</p>
              </div>
            )}

            {isDemo && (
              <div className="flex items-start gap-2.5 rounded-xl border border-violet-brand/25 bg-violet-brand/8 p-3">
                <Icon.Sparkle size={15} className="mt-0.5 shrink-0 text-violet-brand" />
                <span className="text-[11px] leading-relaxed text-ink-200">
                  The demo engine understands a set of common questions offline. For a real conversation about your
                  specific situation,{' '}
                  <button onClick={onOpenSettings} className="font-semibold text-brand-300 underline">
                    add an AI key
                  </button>
                  .
                </span>
              </div>
            )}

            {session.chat.length === 0 && (
              <div className="space-y-2 py-4">
                <p className="text-center text-xs text-ink-400">Ask me anything about this task. For example:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['What do I do next?', 'I don’t have that ingredient', 'Explain it more simply', 'Is this safe?', 'How long will it take?'].map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => void send(s)}
                        className="chip"
                      >
                        {s}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {session.chat.map((c) => (
              <div key={c.id} className={cx('flex gap-2.5', c.role === 'user' ? 'justify-end' : 'justify-start')}>
                {c.role === 'assistant' && (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-400/30 bg-brand-400/10 text-brand-300">
                    <Icon.Sparkle size={14} />
                  </span>
                )}
                <div
                  className={cx(
                    'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    c.role === 'user'
                      ? 'bg-gradient-to-br from-brand-400/25 to-rose-brand/20 text-ink-100'
                      : c.error
                        ? 'border border-rose-500/30 bg-rose-500/10 text-rose-100'
                        : 'border border-white/8 bg-white/5 text-ink-100',
                  )}
                >
                  {c.images?.length ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {c.images.map((img) => (
                        <img key={img.id} src={img.thumb} alt="" className="h-20 w-20 rounded-lg object-cover" />
                      ))}
                    </div>
                  ) : null}
                  {c.pending ? (
                    <span className="flex items-center gap-2 text-ink-400">
                      <Spinner className="h-3.5 w-3.5" /> Thinking…
                    </span>
                  ) : (
                    <p className="whitespace-pre-line">{c.text}</p>
                  )}
                  {c.role === 'assistant' && !c.pending && !c.error && c.text && (
                    <button
                      onClick={() => void speaker.speak(c.text)}
                      className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-brand-300 hover:text-brand-200"
                    >
                      <Icon.Volume size={12} /> Read aloud
                    </button>
                  )}
                  <span className="mt-1 block text-[10px] text-ink-500">{relativeTime(c.at)}</span>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {images.length > 0 && (
            <div className="flex gap-2 border-t border-white/8 px-4 py-2.5">
              {images.map((img) => (
                <div key={img.id} className="relative">
                  <img src={img.thumb} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <button
                    onClick={() => setImages((list) => list.filter((i) => i.id !== img.id))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-ink-900 text-ink-200"
                  >
                    <Icon.X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="shrink-0 border-t border-white/8 p-3">
            <div className="flex items-end gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-ink-200 hover:bg-white/8"
                title="Send a photo"
              >
                <Icon.Camera size={17} />
              </button>
              <button
                onClick={() => setVoiceOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-ink-200 hover:bg-white/8"
                title="Speak"
              >
                <Icon.Mic size={17} />
              </button>
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(text)
                  }
                }}
                placeholder="Ask a follow-up…"
                className="field min-h-[40px] flex-1 resize-none border-transparent bg-transparent"
              />
              <Button
                variant="primary"
                className="h-10 px-3.5"
                disabled={(!text.trim() && !images.length) || session.chat.some((c) => c.pending)}
                onClick={() => void send(text)}
              >
                <Icon.ArrowRight size={17} />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => setAutoSpeak((a) => !a)}
                className={cx('flex items-center gap-1.5 text-[11px] font-medium', autoSpeak ? 'text-brand-300' : 'text-ink-400')}
              >
                <Icon.Volume size={12} /> {autoSpeak ? 'Speaking replies' : 'Speak replies'}
              </button>
              <span className="text-[10px] text-ink-500">
                {session.analysis?.steps.length ? `Step ${session.stepIndex + 1} of ${session.analysis.steps.length}` : ''}
              </span>
            </div>
          </div>
        </div>
      </Sheet>

      <VoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={(t) => {
          setText(t)
          void send(t)
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = e.target.files
          if (!files?.length) return
          const r = await attachmentsFromFiles(Array.from(files))
          setImages((list) => [...list, ...r.attachments])
          e.target.value = ''
        }}
      />
      <Toast message={toast.message} onDone={toast.clear} />
    </>
  )
}
