/**
 * Saved tasks and personal knowledge.
 *
 * Two related ideas. Saves are "I solved this once, keep it". Knowledge is "this is
 * my house" — the washing machine model, the car, the kitchen list — so the assistant
 * never asks the same question twice.
 */

import { useState } from 'react'
import { useSession } from '../state/session'
import { store, useStore, type KnowledgeEntry, type SavedTask } from '../lib/store'
import { KNOWLEDGE_ICON, labelFor, summariseSave } from '../lib/knowledge'
import { cx, copyToClipboard, download, relativeTime, uid } from '../lib/utils'
import { Badge, Button, Card, Chip, Empty, Field, Icon, SectionTitle, Select, Sheet, Toast, useToast } from './ui'

export function Library() {
  const app = useStore()
  const session = useSession()
  const [tab, setTab] = useState<'saved' | 'knowledge' | 'history'>('saved')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null)
  const toast = useToast()

  const saves = app.saves.filter((s) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    )
  })
  const pinned = saves.filter((s) => s.pinned)
  const rest = saves.filter((s) => !s.pinned)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">Your library</h1>
        <p className="mt-1 text-sm text-ink-300">
          Saved tasks you can pick up again, and the things I know about your home so you never explain twice.
        </p>
      </header>

      <div className="surface-flat flex gap-1 p-1">
        {(
          [
            ['saved', `Saved (${app.saves.length})`],
            ['knowledge', `My things (${app.knowledge.length})`],
            ['history', `History (${app.history.length})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cx('tab', tab === id && 'tab-active')}>
            <span className="leading-none">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'saved' && (
        <>
          {app.saves.length > 3 && (
            <div className="relative">
              <Icon.Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="field pl-9"
                placeholder="Search your saved tasks"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}

          {app.saves.length === 0 ? (
            <Card>
              <Empty
                icon={<Icon.Bookmark size={26} />}
                title="Nothing saved yet"
                body="When you finish working something out, tap the bookmark at the top of the task. Next time you can pick it up exactly where you left off."
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {[...pinned, ...rest].map((s) => (
                <SaveRow
                  key={s.id}
                  task={s}
                  onOpen={() => session.loadSaved(s.id)}
                  onPin={() => store.togglePin(s.id)}
                  onDelete={() => {
                    store.removeSave(s.id)
                    toast.show('Deleted')
                  }}
                  onCopy={async () => {
                    const text = [
                      s.title,
                      '',
                      s.analysis.summary,
                      '',
                      ...s.analysis.steps.map((st) => `${st.n}. ${st.title}\n${st.detail}`),
                      ...s.analysis.recipes.map((r) => `\n${r.name}\n${r.steps.map((st) => `${st.n}. ${st.title}: ${st.detail}`).join('\n')}`),
                    ].join('\n')
                    const ok = await copyToClipboard(text)
                    toast.show(ok ? 'Copied to clipboard' : 'Could not copy')
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'knowledge' && (
        <>
          <Card>
            <SectionTitle
              icon={<Icon.Layers size={15} />}
              title="Tell me about your stuff once"
              subtitle="I will use it in every future answer instead of asking again"
            />
            <KnowledgeForm onSave={(e) => { store.addKnowledge(e); toast.show('Saved') }} />
          </Card>

          {app.knowledge.length === 0 ? (
            <Card>
              <Empty
                icon={<Icon.Home size={26} />}
                title="Nothing here yet"
                body="Add your washing machine model, your car, the tools you own, or the food in your kitchen. Everything you add makes the next answer more specific to you."
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {app.knowledge.map((k) => (
                <div key={k.id} className="surface flex items-start gap-3 p-3.5">
                  <span className="text-lg leading-none">{KNOWLEDGE_ICON[k.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {k.name}
                      <Badge tone="neutral">{labelFor(k.kind)}</Badge>
                    </p>
                    {k.detail && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-300">{k.detail}</p>}
                    <p className="mt-1 text-[10px] text-ink-500">Added {relativeTime(k.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(k)}
                      className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/8 hover:text-white"
                      title="Edit"
                    >
                      <Icon.Settings size={15} />
                    </button>
                    <button
                      onClick={() => store.removeKnowledge(k.id)}
                      className="rounded-lg p-1.5 text-ink-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                      title="Delete"
                    >
                      <Icon.Trash size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {app.history.length === 0 ? (
            <Card>
              <Empty icon={<Icon.Clock size={26} />} title="No history yet" body="Tasks you work through appear here." />
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {app.history.map((h) => (
                  <div key={h.id} className="surface flex items-center gap-3 p-3">
                    <span className="text-base">
                      {h.intent === 'cook' ? '🍳' : h.intent === 'fix' || h.intent === 'troubleshoot' ? '🔧' : h.intent === 'use' ? '🎛️' : '💡'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-400">
                        {relativeTime(h.updatedAt)} · {h.turns} message{h.turns === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  store.clearHistory()
                  toast.show('History cleared')
                }}
              >
                <Icon.Trash size={15} /> Clear history
              </Button>
            </>
          )}
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit">
        {editing && (
          <div className="p-4">
            <KnowledgeForm
              initial={editing}
              onSave={(e) => {
                store.removeKnowledge(editing.id)
                store.addKnowledge({ ...e, id: editing.id, createdAt: editing.createdAt })
                setEditing(null)
                toast.show('Updated')
              }}
            />
          </div>
        )}
      </Sheet>

      <Toast message={toast.message} onDone={toast.clear} />
    </div>
  )
}

function SaveRow({
  task,
  onOpen,
  onPin,
  onDelete,
  onCopy,
}: {
  task: SavedTask
  onOpen: () => void
  onPin: () => void
  onDelete: () => void
  onCopy: () => void
}) {
  const [menu, setMenu] = useState(false)
  return (
    <div className="surface overflow-hidden">
      <button onClick={onOpen} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/5">
        {task.thumb ? (
          <img src={task.thumb} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/6 text-xl">
            {task.intent === 'cook' ? '🍳' : task.intent === 'fix' ? '🔧' : '💡'}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {task.pinned && <Icon.Pin size={12} className="shrink-0 text-brand-400" />}
            <span className="truncate text-sm font-semibold">{task.title}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-ink-400">{task.summary}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-ink-500">{summariseSave(task.analysis)}</span>
            {task.stepReached > 0 && <Badge tone="brand">step {task.stepReached + 1}</Badge>}
          </span>
        </span>
      </button>

      <div className="flex items-center justify-between border-t border-white/6 px-2 py-1.5">
        <span className="px-1.5 text-[10px] text-ink-500">{relativeTime(task.updatedAt)}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onPin} title="Pin" className={cx('rounded-lg p-1.5 transition hover:bg-white/8', task.pinned ? 'text-brand-400' : 'text-ink-400 hover:text-white')}>
            <Icon.Pin size={14} />
          </button>
          <button onClick={onCopy} title="Copy text" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/8 hover:text-white">
            <Icon.Copy size={14} />
          </button>
          <button onClick={onDelete} title="Delete" className="rounded-lg p-1.5 text-ink-400 transition hover:bg-rose-500/15 hover:text-rose-300">
            <Icon.Trash size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function KnowledgeForm({ initial, onSave }: { initial?: KnowledgeEntry; onSave: (e: KnowledgeEntry) => void }) {
  const [kind, setKind] = useState<KnowledgeEntry['kind']>(initial?.kind ?? 'appliance')
  const [name, setName] = useState(initial?.name ?? '')
  const [detail, setDetail] = useState(initial?.detail ?? '')

  const placeholders: Record<KnowledgeEntry['kind'], { name: string; detail: string }> = {
    appliance: { name: 'Washing machine', detail: 'Bosch Serie 6 front loader, 7 kg. Detergent drawer top-left. Hates heavy loads.' },
    vehicle: { name: 'My car', detail: '2016 Toyota Corolla 1.6. Petrol. Space-saver spare in the boot.' },
    tool: { name: 'My tools', detail: 'Cordless drill, socket set 8–19 mm, adjustable spanner, hammer, screwdrivers.' },
    kitchen: { name: 'My kitchen', detail: 'eggs, rice, pasta, maize meal, onions, tomatoes, tinned tomatoes, cooking oil, curry powder, chicken, potatoes, bread, milk, cheese' },
    home: { name: 'My home', detail: 'Distribution board is in the garage. Stopcock under the kitchen sink. Geyser in the roof.' },
    other: { name: 'Something else', detail: 'Anything I should know' },
  }

  return (
    <div className="space-y-3">
      <Select
        label="What kind of thing"
        value={kind}
        onChange={(v) => setKind(v as KnowledgeEntry['kind'])}
        options={[
          { value: 'appliance', label: '🔌 Appliance' },
          { value: 'vehicle', label: '🚗 Vehicle' },
          { value: 'tool', label: '🔧 Tools I own' },
          { value: 'kitchen', label: '🍳 My kitchen' },
          { value: 'home', label: '🏠 My home' },
          { value: 'other', label: '📝 Something else' },
        ]}
      />
      <Field label="Name" value={name} onChange={setName} placeholder={placeholders[kind].name} />
      <label className="block">
        <span className="label">Details</span>
        <textarea
          className="field min-h-[84px] resize-none leading-relaxed"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={placeholders[kind].detail}
          rows={3}
        />
        <span className="mt-1 block text-[11px] text-ink-400">
          {kind === 'kitchen'
            ? 'Comma-separated ingredients work best — I match them against recipes.'
            : 'Model numbers, quirks, where things are. The more specific, the less I have to ask.'}
        </span>
      </label>
      <Button
        variant="primary"
        className="w-full"
        disabled={!name.trim()}
        onClick={() =>
          onSave({
            id: initial?.id ?? uid('kn'),
            kind,
            name: name.trim(),
            detail: detail.trim(),
            createdAt: initial?.createdAt ?? Date.now(),
          })
        }
      >
        <Icon.Plus size={15} /> {initial ? 'Save changes' : 'Add it'}
      </Button>
    </div>
  )
}
