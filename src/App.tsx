/**
 * App shell.
 *
 * Four destinations and one primary action. The task view takes over the screen as
 * soon as something has been analysed, because that is what the user came for.
 */

import { useEffect, useState } from 'react'
import { SessionProvider, useSession } from './state/session'
import { store, useStore } from './lib/store'
import { cx } from './lib/utils'
import { Home } from './components/Home'
import { SessionView } from './components/Session'
import { Library } from './components/Library'
import { Settings } from './components/Settings'
import { ChatDock } from './components/ChatDock'
import { Button, Icon, Sheet } from './components/ui'

type Tab = 'home' | 'task' | 'library' | 'settings'

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  )
}

function Shell() {
  const session = useSession()
  const app = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [chatOpen, setChatOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(!app.onboarded)

  // When an analysis lands, move the user straight into it.
  useEffect(() => {
    if (session.status === 'ready' && session.analysis && tab === 'home') setTab('task')
    if (session.status === 'idle' && tab === 'task') setTab('home')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, session.analysis?.title])

  const hasTask = Boolean(session.analysis)

  return (
    <div className="relative z-10 flex min-h-[100dvh] flex-col">
      <main className="flex-1 pb-24">
        {tab === 'home' && (
          <Home onOpenSettings={() => setTab('settings')} onOpenSaved={() => setTab('library')} />
        )}
        {tab === 'task' && hasTask && <SessionView onOpenSettings={() => setTab('settings')} />}
        {tab === 'task' && !hasTask && (
          <div className="mx-auto max-w-2xl px-4 py-20 text-center">
            <p className="text-sm text-ink-400">Nothing open right now.</p>
            <Button variant="primary" className="mt-4" onClick={() => setTab('home')}>
              <Icon.Camera size={16} /> Show me something
            </Button>
          </div>
        )}
        {tab === 'library' && <Library />}
        {tab === 'settings' && <Settings />}
      </main>

      {/* Floating chat handle for the active task */}
      {hasTask && tab !== 'task' && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-rose-brand text-ink-950 shadow-xl"
          title="Chat about this task"
        >
          <Icon.Chat size={20} />
        </button>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-ink-950/92 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-stretch">
          <NavItem icon={<Icon.Home size={20} />} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
          <NavItem
            icon={<Icon.Hand size={20} />}
            label="Task"
            active={tab === 'task'}
            disabled={!hasTask}
            badge={hasTask ? session.analysis?.steps.length : undefined}
            onClick={() => setTab('task')}
          />
          <NavItem
            icon={<Icon.Bookmark size={20} />}
            label="Library"
            active={tab === 'library'}
            badge={app.saves.length || undefined}
            onClick={() => setTab('library')}
          />
          <NavItem icon={<Icon.Settings size={20} />} label="Settings" active={tab === 'settings'} onClick={() => setTab('settings')} />
        </div>
      </nav>

      <button
        onClick={() => setChatOpen(true)}
        disabled={!hasTask}
        className={cx(
          'fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full border border-white/12 bg-ink-800/95 px-4 py-3 text-xs font-semibold shadow-xl backdrop-blur transition',
          hasTask ? 'text-ink-100 hover:bg-ink-750' : 'hidden',
        )}
      >
        <Icon.Chat size={16} className="text-brand-300" />
        Ask a follow-up
        {session.chat.length > 0 && (
          <span className="ml-0.5 rounded-full bg-brand-400/25 px-1.5 py-0.5 text-[10px] text-brand-100">
            {session.chat.length}
          </span>
        )}
      </button>

      <ChatDock open={chatOpen} onClose={() => setChatOpen(false)} onOpenSettings={() => { setChatOpen(false); setTab('settings') }} />

      <Onboarding
        open={showOnboarding}
        onClose={() => {
          store.set({ onboarded: true })
          setShowOnboarding(false)
        }}
        onAddKey={() => {
          store.set({ onboarded: true })
          setShowOnboarding(false)
          setTab('settings')
        }}
      />
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  disabled,
  badge,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition',
        active ? 'text-brand-300' : disabled ? 'text-ink-600' : 'text-ink-400 hover:text-ink-200',
      )}
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-400/25 px-1 text-[9px] font-bold text-brand-100">
            {badge > 99 ? '99' : badge}
          </span>
        ) : null}
      </span>
      {label}
      {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-400" />}
    </button>
  )
}

function Onboarding({
  open,
  onClose,
  onAddKey,
}: {
  open: boolean
  onClose: () => void
  onAddKey: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Welcome">
      <div className="space-y-5 p-5">
        <div className="flex justify-center pt-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-rose-brand text-ink-950">
            <Icon.Camera size={30} />
          </span>
        </div>

        <div className="text-center">
          <h2 className="text-lg font-bold leading-snug">Show me what you&rsquo;re dealing with.</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
            Tell me what you want to do. I&rsquo;ll help you get it done — visually, out loud, or step by step with you.
          </p>
        </div>

        <div className="space-y-2.5">
          {[
            ['📷', 'Show me', 'An appliance, a warning light, ingredients, a tool, a screen — I work out what it is and what you need.'],
            ['🤳', 'Do it with me', 'One step at a time, at your pace, with the progress remembered.'],
            ['🔊', 'Or just listen', 'Hands busy? I will read the instructions out and pick up where you left off.'],
            ['🛡️', 'Honest by design', 'I will not point at something I cannot see, and I will not pretend a photo proves something is safe.'],
          ].map(([emoji, title, body]) => (
            <div key={title} className="flex gap-3 rounded-xl border border-white/8 bg-white/4 p-3">
              <span className="text-lg leading-none">{emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-400">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={onAddKey}>
            <Icon.Sparkle size={17} /> Add a free AI key — make it live
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={onClose}>
            Try the offline demo first
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-ink-500">
            Google Gemini&rsquo;s free tier needs no credit card. Your key stays in this browser, and the demo works
            without one anyway.
          </p>
        </div>
      </div>
    </Sheet>
  )
}
