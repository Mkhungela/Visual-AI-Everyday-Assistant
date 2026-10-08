/**
 * The home screen.
 *
 * One job: let someone point at a problem without first deciding what category it
 * belongs to. Everything else on this screen is secondary to the SHOW ME button.
 */

import { useRef, useState } from 'react'
import { useSession } from '../state/session'
import { store, useStore, type Attachment } from '../lib/store'
import { summariseSave } from '../lib/knowledge'
import { cx, relativeTime } from '../lib/utils'
import { CameraSheet, Composer, useScreenCapture, VoiceSheet } from './Capture'
import { attachmentsFromFiles } from '../lib/capture'
import { Badge, Button, Card, Icon, SectionTitle, Spinner, Toast, useToast } from './ui'

const MODES = [
  { icon: '🍳', label: 'Food', blurb: 'What can I make with this?' },
  { icon: '🏠', label: 'Home', blurb: 'Appliances, cleaning, fixes' },
  { icon: '🚗', label: 'Vehicle', blurb: 'Warning lights, tyres, checks' },
  { icon: '🔧', label: 'DIY', blurb: 'Tools, repairs, assembly' },
  { icon: '💻', label: 'Tech', blurb: 'Screens, settings, devices' },
  { icon: '👕', label: 'Clothing', blurb: 'Care labels, washing, stains' },
  { icon: '🌱', label: 'Garden', blurb: 'Plants and what they need' },
  { icon: '📄', label: 'Documents', blurb: 'Forms, letters, contracts' },
]

export function Home({ onOpenSettings, onOpenSaved }: { onOpenSettings: () => void; onOpenSaved: () => void }) {
  const session = useSession()
  const app = useStore()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const hiddenUpload = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const addAttachments = (list: Attachment[], noteText?: string) => {
    session.dispatch({ type: 'addAttachments', attachments: list })
    if (noteText) toast.show(noteText)
  }

  const screen = useScreenCapture(addAttachments)

  const committing = (extra?: Attachment[]) => {
    const attachments = extra ? [...session.attachments, ...extra] : session.attachments
    if (attachments.length && attachments !== session.attachments) {
      session.dispatch({ type: 'addAttachments', attachments: extra! })
    }
    void session.run()
  }

  const hasKey = Boolean(app.settings.apiKey) || app.settings.provider === 'ollama' || app.settings.provider === 'custom'
  const busy = session.status === 'analyzing'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-6 pt-5">
      {/* Hero */}
      <header className="pt-2">
        <h1 className="text-balance text-[26px] font-bold leading-[1.15] tracking-tight">
          Show me what you&rsquo;re
          <br />
          dealing with.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          Point your camera at anything — an appliance, a warning light, ingredients, a tool, a screen. Tell me what you
          want to do and I&rsquo;ll walk you through it.
        </p>
      </header>

      {!hasKey && (
        <button
          onClick={onOpenSettings}
          className="flex items-start gap-3 rounded-xl2 border border-violet-brand/25 bg-violet-brand/8 p-3.5 text-left transition hover:bg-violet-brand/12"
        >
          <Icon.Sparkle size={17} className="mt-0.5 shrink-0 text-violet-brand" />
          <span className="min-w-0 text-xs leading-relaxed text-ink-200">
            <span className="font-semibold text-violet-brand">You are in demo mode. </span>
            The built-in engine works offline with real guides, but it cannot see your photos. Add a free Google Gemini
            key and everything you show me gets analysed properly.{' '}
            <span className="font-semibold text-brand-300 underline underline-offset-2">Add a key →</span>
          </span>
        </button>
      )}

      {/* Primary action */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setCameraOpen(true)}
          disabled={busy}
          className="group relative flex items-center gap-4 overflow-hidden rounded-xl3 border border-brand-400/30 bg-gradient-to-br from-brand-400/18 via-brand-500/10 to-rose-brand/12 p-5 text-left transition active:scale-[0.985] disabled:opacity-50"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-rose-brand text-ink-950 shadow-lg">
            <Icon.Camera size={26} />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold leading-tight">SHOW ME</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-300">
              Take a photo, or pick one you already have
            </span>
          </span>
          <Icon.ArrowRight size={20} className="ml-auto shrink-0 text-brand-300 transition group-hover:translate-x-0.5" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <ActionTile icon={<Icon.Mic size={20} />} label="ASK ME" hint="Speak your question" onClick={() => setVoiceOpen(true)} />
          <ActionTile
            icon={<Icon.Upload size={20} />}
            label="UPLOAD"
            hint="Photo, video or screenshot"
            onClick={() => hiddenUpload.current?.click()}
          />
          <ActionTile
            icon={<Icon.Chat size={20} />}
            label="CHAT"
            hint="Type it instead"
            onClick={() => document.getElementById('home-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          />
          <ActionTile
            icon={<Icon.Compare size={20} />}
            label="COMPARE"
            hint="Before and after"
            onClick={() => session.dispatch({ type: 'setRequest', request: 'Compare these two photos — did I do it right?' })}
          />
        </div>

        {screen.available && (
          <button
            onClick={screen.grab}
            className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-xs font-medium text-ink-200 transition hover:bg-white/8"
          >
            <Icon.Screen size={15} className="text-sky-brand" />
            Capture my screen — for app and software problems
          </button>
        )}
      </div>

      {/* Composer */}
      <div id="home-composer" className="scroll-mt-24">
        <Composer
          value={session.request}
          onChange={(v) => session.dispatch({ type: 'setRequest', request: v })}
          onSubmit={() => committing()}
          attachments={session.attachments}
          onRemoveAttachment={(id) => session.dispatch({ type: 'removeAttachment', id })}
          onAttach={() => hiddenUpload.current?.click()}
          onVoice={() => setVoiceOpen(true)}
          onCamera={() => setCameraOpen(true)}
          busy={busy}
          placeholder={session.attachments.length ? 'What do you want to do with this?' : 'Tell me what you want to do…'}
        />
        {session.error && (
          <p className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-200">
            {session.error}
          </p>
        )}
        {busy && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-400/20 bg-brand-400/6 px-3.5 py-3">
            <Spinner />
            <span className="text-xs text-ink-200">
              {session.attachments.length ? 'Looking at what you showed me…' : 'Working out what you need…'}
            </span>
          </div>
        )}
      </div>

      {/* Personal shortcuts */}
      {app.knowledge.length > 0 && (
        <section>
          <SectionTitle
            icon={<Icon.Layers size={15} />}
            title="Your things"
            subtitle="Already saved, so you never have to explain twice"
          />
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {app.knowledge.slice(0, 8).map((k) => (
              <button
                key={k.id}
                onClick={() => {
                  session.dispatch({ type: 'setRequest', request: `Help me with my ${k.name}` })
                  void session.run(`Help me with my ${k.name}`)
                }}
                className="surface-flat w-[150px] shrink-0 p-3 text-left transition hover:bg-white/8"
              >
                <span className="text-lg">{k.kind === 'appliance' ? '🔌' : k.kind === 'vehicle' ? '🚗' : k.kind === 'tool' ? '🔧' : k.kind === 'kitchen' ? '🍳' : '🏠'}</span>
                <span className="mt-1.5 block truncate text-xs font-semibold">{k.name}</span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-ink-400">{k.detail}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Saved */}
      {app.saves.length > 0 && (
        <section>
          <SectionTitle
            icon={<Icon.Bookmark size={15} />}
            title="Pick up where you left off"
            right={
              <button onClick={onOpenSaved} className="text-[11px] font-semibold text-brand-300 hover:text-brand-200">
                See all
              </button>
            }
          />
          <div className="space-y-2">
            {app.saves.slice(0, 3).map((s) => (
              <button
                key={s.id}
                onClick={() => session.loadSaved(s.id)}
                className="surface flex w-full items-center gap-3 p-2.5 text-left transition hover:bg-white/6"
              >
                {s.thumb ? (
                  <img src={s.thumb} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/6 text-lg">
                    {s.intent === 'cook' ? '🍳' : s.intent === 'fix' ? '🔧' : '💡'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.title}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-400">
                    {summariseSave(s.analysis)} · {relativeTime(s.updatedAt)}
                  </span>
                </span>
                <Icon.ArrowRight size={16} className="shrink-0 text-ink-400" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Modes */}
      <section>
        <SectionTitle
          icon={<Icon.Bulb size={15} />}
          title="What I can help with"
          subtitle="You do not need to choose — I work it out from what you show me"
        />
        <div className="grid grid-cols-2 gap-2.5">
          {MODES.map((m) => (
            <button
              key={m.label}
              onClick={() => session.dispatch({ type: 'setRequest', request: m.blurb })}
              className="surface-flat flex items-start gap-2.5 p-3 text-left transition hover:bg-white/7"
            >
              <span className="text-base leading-none">{m.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{m.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <p className="pb-2 text-center text-[11px] leading-relaxed text-ink-500">
        Your photos and API key stay on this device. Nothing is uploaded anywhere except to the AI provider you chose.
      </p>

      {/* hidden input for upload */}
      <input
        ref={hiddenUpload}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = e.target.files
          if (!files?.length) return
          const r = await attachmentsFromFiles(Array.from(files), { multiple: files.length > 1 })
          addAttachments(r.attachments, r.note)
          e.target.value = ''
        }}
      />

      <CameraSheet open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={addAttachments} />
      <VoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={(text) => {
          session.dispatch({ type: 'setRequest', request: text })
          void session.run(text)
        }}
      />
      <Toast message={toast.message ?? note} onDone={() => { toast.clear(); setNote(null) }} />
    </div>
  )
}

function ActionTile({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="surface flex items-center gap-3 p-3.5 text-left transition hover:bg-white/7 active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-brand-300">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold tracking-wide">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-ink-400">{hint}</span>
      </span>
    </button>
  )
}
