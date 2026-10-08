/**
 * The session view.
 *
 * This is where "show me" becomes "help me do it". Five ways to receive the same
 * answer, and the user can switch between them mid-task without losing their place:
 *
 *   👁️ SHOW ME     the photo with arrows and labels drawn on it
 *   🔊 TELL ME     spoken instructions, hands free
 *   🎥 WATCH       demonstrations matched to this situation
 *   📖 READ        simple or detailed, at the user's level
 *   🤳 DO IT WITH ME  one step at a time, with progress remembered
 */

import { useEffect, useMemo, useState } from 'react'
import { useSession, useStep } from '../state/session'
import { store, useStore, type Attachment } from '../lib/store'
import { INTENT_ICONS, INTENT_LABELS, type Annotation, type Recipe, type TaskMode } from '../lib/schema'
import { compareImages, deepenRecipe, explain, isDemoSettings, shoppingList, troubleshootNext, voiceScript, type CompareResult, type ShoppingItem, type TroubleshootStepResult } from '../lib/session'
import { useSpeaker, speech, useSpeech } from '../lib/speech'
import { copyToClipboard, cx, formatDuration, formatMinutes, uid } from '../lib/utils'
import { attachmentsFromFiles } from '../lib/capture'
import { buildKitchenContext, knowledgeForPrompt } from '../lib/knowledge'
import { LANGUAGES, type SavedTask } from '../lib/store'
import {
  AnnotatedImage,
  DemoNotice,
  DiagramCard,
  MetaRow,
  ProgressTracker,
  SafetyBanner,
  StepCard,
  VideoCard,
  VideoPlayerSheet,
} from './Visuals'
import { Badge, Button, Card, Chip, Empty, Field, Icon, ProgressBar, SectionTitle, Select, Sheet, Spinner, Toast, Toggle, useToast } from './ui'
import type { VideoRef } from '../lib/schema'

type Mode = 'show' | 'tell' | 'watch' | 'read' | 'do'

const MODES: { id: Mode; label: string; emoji: string }[] = [
  { id: 'show', label: 'Show me', emoji: '👁️' },
  { id: 'tell', label: 'Tell me', emoji: '🔊' },
  { id: 'watch', label: 'Watch', emoji: '🎥' },
  { id: 'read', label: 'Read', emoji: '📖' },
  { id: 'do', label: 'Do it with me', emoji: '🤳' },
]

export function SessionView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const session = useSession()
  const app = useStore()
  const [mode, setMode] = useState<Mode>('do')
  const toast = useToast()
  const [video, setVideo] = useState<VideoRef | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState<Recipe | null>(null)

  const analysis = session.analysis
  const { steps, index, current } = useStep()
  const blocked = analysis?.safety.some((s) => s.stop) ?? false

  // Land on whichever mode can actually help most for this result.
  useEffect(() => {
    if (!analysis) return
    if (analysis.recipes.length || analysis.steps.length) setMode('do')
    else if (analysis.annotations.length) setMode('show')
    else setMode('show')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.title])

  if (!analysis) return null

  const isDemo = session.meta?.demo ?? false
  const saved = session.savedId ? app.saves.find((s) => s.id === session.savedId) : undefined

  const save = () => {
    const id = session.savedId ?? uid('save')
    const task: SavedTask = {
      id,
      title: analysis.title,
      summary: analysis.summary,
      intent: analysis.intent,
      createdAt: saved?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      thumb: session.attachments[0]?.thumb ?? '',
      analysis,
      pinned: saved?.pinned ?? false,
      tags: [analysis.intent, ...analysis.objects.slice(0, 2).map((o) => o.label)],
      notes: saved?.notes ?? '',
      stepReached: index,
    }
    store.saveTask(task)
    session.dispatch({ type: 'saved', id })
    toast.show('Saved to your tasks')
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">
              {INTENT_ICONS[analysis.intent]} {INTENT_LABELS[analysis.intent]}
            </Badge>
            {analysis.confidence < 0.5 && <Badge tone="warn">Not fully certain</Badge>}
            {session.meta?.grounded && <Badge tone="info">Web-grounded</Badge>}
            {session.meta?.healed && <Badge tone="neutral">Auto-corrected</Badge>}
          </div>
          <h1 className="text-balance text-xl font-bold leading-tight">{analysis.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={save}
            title={session.savedId ? 'Saved' : 'Save this task'}
            className={cx(
              'flex h-9 w-9 items-center justify-center rounded-xl border transition',
              session.savedId
                ? 'border-brand-400/40 bg-brand-400/15 text-brand-200'
                : 'border-white/10 text-ink-300 hover:bg-white/8 hover:text-white',
            )}
          >
            {session.savedId ? <Icon.BookmarkFilled size={16} /> : <Icon.Bookmark size={16} />}
          </button>
          <button
            onClick={() => session.reset()}
            title="Close this task and start something new"
            aria-label="Close this task"
            data-testid="task-close"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-ink-300 transition hover:bg-white/8 hover:text-white"
          >
            <Icon.X size={17} />
          </button>
        </div>
      </div>

      {isDemo && (
        <DemoNotice
          notice={session.meta?.notice ?? 'Answers come from the built-in guides, not from your photo.'}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* What I understood */}
      <Card className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-100">{analysis.summary}</p>
        {analysis.situation && analysis.situation !== analysis.summary && (
          <p className="border-l-2 border-brand-400/40 pl-3 text-xs italic leading-relaxed text-ink-400">
            Understood as: {analysis.situation}
          </p>
        )}
        <MetaRow
          difficulty={analysis.difficulty}
          timeMinutes={analysis.timeEstimateMin}
          tools={analysis.tools}
          materials={analysis.materials}
        />
        {analysis.objects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {analysis.objects.slice(0, 8).map((o, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-[11px] text-ink-200"
                title={o.note}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                {o.label}
                <span className="text-ink-500">{Math.round(o.confidence * 100)}%</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* What would you like to do? */}
      {session.intent?.options?.length ? (
        <Card>
          <SectionTitle
            icon={<Icon.Sparkle size={15} />}
            title={session.intent.clarify || 'What would you like to do?'}
            subtitle="I will build the guide around your answer"
          />
          <div className="flex flex-wrap gap-2">
            {session.intent.options.map((o) => (
              <button
                key={o.label}
                onClick={() => void session.askAboutIntent(o)}
                className="flex flex-col items-start gap-0.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left transition hover:border-brand-400/40 hover:bg-brand-400/10"
              >
                <span className="text-xs font-semibold text-ink-100">{o.label}</span>
                {o.description && <span className="text-[11px] text-ink-400">{o.description}</span>}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <SafetyBanner flags={analysis.safety} />

      {/* Mode switcher */}
      {!blocked && (
        <div className="sticky top-0 z-20 -mx-4 bg-ink-950/85 px-4 py-2 backdrop-blur">
          <div className="surface-flat flex gap-1 p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cx('tab', mode === m.id && 'tab-active')}
              >
                <span className="text-base leading-none">{m.emoji}</span>
                <span className="leading-none">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {blocked ? (
        <Card className="border-rose-500/30 bg-rose-500/6">
          <div className="flex items-start gap-3">
            <Icon.Alert size={20} className="mt-0.5 shrink-0 text-rose-300" />
            <div>
              <h3 className="text-sm font-semibold text-rose-200">I am not going to talk you through this one</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-200">
                Something about this situation is genuinely dangerous, and guiding you remotely would make it worse
                rather than better. The safety notes above say what to do instead — which is usually to get a qualified
                person in. If you think I have got this wrong, show me a clearer photo and tell me what you are actually
                trying to do.
              </p>
              <Button variant="ghost" className="mt-3" onClick={() => session.reset()}>
                <Icon.Refresh size={15} /> Show me something else
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {mode === 'show' && <ShowMode analysis={analysis} attachments={session.attachments} index={index} onOpenSettings={onOpenSettings} />}
          {mode === 'tell' && <TellMode analysis={analysis} />}
          {mode === 'watch' && <WatchMode analysis={analysis} onPlay={setVideo} onOpenSettings={onOpenSettings} />}
          {mode === 'read' && <ReadMode analysis={analysis} onOpenSettings={onOpenSettings} />}
          {mode === 'do' && (
            <DoMode
              onOpenRecipe={setRecipeOpen}
              onCompare={() => setCompareOpen(true)}
              onShopping={() => setShoppingOpen(true)}
            />
          )}
        </>
      )}

      {/* Progress + follow-ups always visible in guided modes */}
      {!blocked && steps.length > 0 && mode === 'do' && (
        <ProgressTracker steps={steps} index={index} completed={session.completed} onJump={(i) => session.dispatch({ type: 'setStep', index: i })} labels={analysis.progressLabels} />
      )}

      {(analysis.substitutions.length > 0 || analysis.missingItems.length > 0) && (
        <Card>
          <SectionTitle
            icon={<Icon.Layers size={15} />}
            title="Missing something?"
            subtitle="Swap it rather than restart — everything below keeps the plan intact"
            right={
              analysis.missingItems.length > 0 ? (
                <button onClick={() => setShoppingOpen(true)} className="text-[11px] font-semibold text-brand-300">
                  Shopping list
                </button>
              ) : undefined
            }
          />
          <div className="space-y-2">
            {analysis.substitutions.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/4 p-2.5">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-rose-300 line-through decoration-rose-400/50">{s.missing}</span>
                  <Icon.ArrowRight size={12} className="text-ink-400" />
                  <span className="text-emerald-300">{s.use}</span>
                </p>
                {s.note && <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{s.note}</p>}
              </div>
            ))}
            {analysis.missingItems.slice(0, 6).map((m, i) => (
              <p key={i} className="flex items-start gap-2 text-xs text-ink-300">
                <span className="mt-0.5 text-amber-300">•</span>
                <span className="min-w-0">
                  <span className="font-medium text-ink-100">{m.item}</span>
                  {m.why ? ` — ${m.why}` : ''}
                  {m.estCostZar ? <span className="text-ink-500"> · ~R{m.estCostZar} (estimate)</span> : null}
                </span>
              </p>
              ))}
          </div>
        </Card>
      )}

      {/* Follow-up questions */}
      {analysis.followUpQuestions.length > 0 && (
        <Card>
          <SectionTitle
            icon={<Icon.Chat size={15} />}
            title="A few things I need to know"
            subtitle="Answering these changes the guide, rather than me guessing"
          />
          <div className="space-y-3">
            {analysis.followUpQuestions.map((q) => (
              <FollowUp key={q.id} q={q} answered={session.answers.find((a) => a.question === q.question)?.answer} onAnswer={(a) => void session.answer(q.question, a)} />
            ))}
          </div>
        </Card>
      )}

      {/* Knowledge / grounding */}
      {analysis.knowledge.length > 0 && (
        <Card>
          <SectionTitle icon={<Icon.Bulb size={15} />} title="Worth knowing" />
          <ul className="space-y-2.5">
            {analysis.knowledge.map((k, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-brand" />
                <span className="min-w-0 text-xs leading-relaxed">
                  <span className="block text-ink-100">{k.claim}</span>
                  {k.why && <span className="mt-0.5 block text-ink-400">{k.why}</span>}
                  {k.confidence && k.confidence !== 'high' && (
                    <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-ink-500">
                      {k.confidence} confidence
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Suggested next utterances */}
      {analysis.askMeNext.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {analysis.askMeNext.slice(0, 5).map((s) => (
            <Chip key={s} onClick={() => void session.send(s)}>
              {s}
            </Chip>
          ))}
        </div>
      )}

      <CompareSheet open={compareOpen} onClose={() => setCompareOpen(false)} onOpenSettings={onOpenSettings} />
      <ShoppingSheet open={shoppingOpen} onClose={() => setShoppingOpen(false)} items={analysis.missingItems.map((m) => m.item)} taskTitle={analysis.title} />
      <RecipeSheet
        recipe={recipeOpen}
        onClose={() => setRecipeOpen(null)}
        onStart={(r) => {
          setRecipeOpen(null)
          setMode('do')
          void session.send(`Walk me through ${r.name} step by step`)
        }}
      />
      <VideoPlayerSheet video={video} onClose={() => setVideo(null)} />
      <Toast message={toast.message} onDone={toast.clear} />
    </div>
  )
}

/* ------------------------------------------------------------------ SHOW ME */

function ShowMode({
  analysis,
  attachments,
  index,
  onOpenSettings,
}: {
  analysis: NonNullable<ReturnType<typeof useSession>['analysis']>
  attachments: Attachment[]
  index: number
  onOpenSettings: () => void
}) {
  const [picked, setPicked] = useState<Annotation | null>(null)
  const currentStep = analysis.steps[index]

  const groups = useMemo(() => {
    const byImage = new Map<number, Annotation[]>()
    for (const a of analysis.annotations) {
      const list = byImage.get(a.img) ?? []
      list.push(a)
      byImage.set(a.img, list)
    }
    return byImage
  }, [analysis.annotations])

  const hasDiagrams = analysis.steps.some((s) => s.diagram)

  return (
    <div className="space-y-3.5">
      {!attachments.length && (
        <Card>
          <div className="flex items-start gap-3">
            <Icon.Eye size={18} className="mt-0.5 shrink-0 text-ink-400" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">No photo to draw on</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-300">
                SHOW ME puts arrows and labels on top of your own photo. Take or upload one and I will mark exactly
                where to look
                {hasDiagrams ? ' — and the schematics below already show what each control looks like.' : '.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {[...groups.entries()].map(([imgIndex, list]) => {
        const attachment = attachments[Math.min(imgIndex, attachments.length - 1)]
        if (!attachment) return null
        return (
          <Card key={imgIndex} className="p-2.5">
            <AnnotatedImage
              src={attachment.dataUrl}
              annotations={list}
              activeStep={currentStep?.n}
              onPick={setPicked}
            />
            <p className="px-1.5 pb-1 pt-2.5 text-[11px] text-ink-400">
              {list.length} mark{list.length === 1 ? '' : 's'} · showing step {currentStep?.n ?? 1}
            </p>
          </Card>
        )
      })}

      {attachments.length > 0 && analysis.annotations.length === 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <Icon.Eye size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">I did not mark anything on your photo</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-300">
                {sessionIsDemo(analysis)
                  ? 'The demo engine cannot see images, so it will not pretend to point at things. Add an AI key and I will draw the actual controls on your photo.'
                  : 'Either I could not confidently locate the controls, or this task is better explained in words. I would rather leave the photo clean than put an arrow in the wrong place — a wrong arrow is worse than no arrow.'}
              </p>
              {sessionIsDemo(analysis) && (
                <Button variant="ghost" size="sm" className="mt-2.5" onClick={onOpenSettings}>
                  <Icon.Settings size={14} /> Add an AI key
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {hasDiagrams && (
        <Card>
          <SectionTitle
            icon={<Icon.Layers size={15} />}
            title="Schematics for the controls"
            subtitle="What each control usually looks like and where it normally sits — an illustration, not a reading of your photo"
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {analysis.steps
              .filter((s) => s.diagram)
              .map((s) => (
                <DiagramCard key={s.n} diagram={s.diagram!} stepNumber={s.n} />
              ))}
          </div>
        </Card>
      )}

      {picked && (
        <Card className="border-brand-400/30 bg-brand-400/6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-100">{picked.label}</p>
              {picked.detail && <p className="mt-1 text-xs leading-relaxed text-ink-200">{picked.detail}</p>}
              {picked.step && <p className="mt-1.5 text-[11px] text-ink-400">Part of step {picked.step}</p>}
            </div>
            <button onClick={() => setPicked(null)} className="rounded-lg p-1 text-ink-400 hover:text-white">
              <Icon.X size={15} />
            </button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon={<Icon.List size={15} />} title="Step by step" subtitle="Tap any step to expand it" />
        <div className="space-y-2">
          {analysis.steps.map((s) => (
            <StepCard key={s.n} step={s} isActive={s.n === currentStep?.n} isDone={false} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function sessionIsDemo(analysis: { demo: boolean }) {
  return analysis.demo
}

/* ------------------------------------------------------------------ TELL ME */

function TellMode({ analysis }: { analysis: NonNullable<ReturnType<typeof useSession>['analysis']> }) {
  const app = useStore()
  const speaker = useSpeaker()
  const speechState = useSpeech()
  const [language, setLanguage] = useState(app.voice.language)
  const [script, setScript] = useState(analysis.voiceScript || analysis.summary)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(app.voice.rate)

  const items = useMemo(
    () => [
      { id: 'intro', text: script, lang: language },
      ...analysis.steps.map((s) => ({ id: `step-${s.n}`, text: s.voice || `${s.title}. ${s.detail}`, lang: language })),
    ],
    [script, analysis.steps, language],
  )

  const regenerate = async () => {
    setLoading(true)
    try {
      const next = await voiceScript({ analysis, language, settings: app.settings })
      setScript(next)
    } catch {
      setScript(analysis.voiceScript || analysis.summary)
    } finally {
      setLoading(false)
    }
  }

  const voiceSupport = LANGUAGES.find((l) => l.code === language)

  return (
    <div className="space-y-3.5">
      <Card>
        <SectionTitle
          icon={<Icon.Volume size={15} />}
          title="Hands-free instructions"
          subtitle="Speak the plan aloud — useful when both hands are busy"
        />

        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          {speechState.speaking ? (
            <>
              <Button variant="primary" onClick={() => speaker.pause()} disabled={speechState.paused}>
                <Icon.Pause size={16} /> Pause
              </Button>
              <Button onClick={() => speaker.resume()} disabled={!speechState.paused}>
                <Icon.Play size={16} /> Resume
              </Button>
              <Button variant="ghost" onClick={() => speaker.stop()}>
                <Icon.Stop size={15} /> Stop
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => void speaker.speak(items, { rate })}>
              <Icon.Play size={16} /> Read it to me
            </Button>
          )}
        </div>

        {speechState.currentId && (
          <div className="mb-3 rounded-xl border border-brand-400/25 bg-brand-400/8 px-3 py-2">
            <p className="flex items-center gap-2 text-[11px] font-semibold text-brand-200">
              <Icon.Volume size={13} />
              {speechState.currentId === 'intro' ? 'Reading the overview' : `Reading step ${speechState.currentId.replace('step-', '')}`}
            </p>
            <ProgressBar value={speechState.progress} className="mt-1.5" />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Language"
            value={language}
            onChange={setLanguage}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          />
          <label className="block">
            <span className="label">Speed — {rate.toFixed(1)}×</span>
            <input
              type="range"
              min={0.6}
              max={1.5}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-3 w-full accent-brand-400"
            />
          </label>
        </div>

        {voiceSupport && !voiceSupport.tts && (
          <p className="mt-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
            Browsers do not carry a {voiceSupport.label} voice. I can still write the instructions in it — and if you add a
            Gemini or OpenAI key, I can speak them with a cloud voice instead. Turn on “Cloud voice” in Settings.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void regenerate()} disabled={loading}>
            {loading ? <Spinner /> : <Icon.Refresh size={14} />} Rewrite for speaking
          </Button>
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(
              [analysis.title, '', script, '', ...analysis.steps.map((s) => `${s.n}. ${s.title}\n${s.detail}`)].join('\n'),
            )}`}
            download={`${analysis.title.replace(/[^\w\s-]/g, '').slice(0, 40)}.txt`}
            className="btn btn-ghost px-3 py-1.5 text-xs"
          >
            <Icon.Upload size={14} className="rotate-180" /> Download script
          </a>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Icon.Book size={15} />} title="The spoken script" />
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-100">{script}</p>
      </Card>

      <Card>
        <SectionTitle icon={<Icon.List size={15} />} title="Step by step, out loud" />
        <ol className="space-y-2.5">
          {analysis.steps.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', speechState.currentId === `step-${s.n}` ? 'bg-brand-400 text-ink-950' : 'bg-white/8 text-ink-300')}>
                {s.n}
              </span>
              <span className="min-w-0 text-sm leading-relaxed">
                <span className="block font-medium">{s.title}</span>
                <span className="text-ink-300">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ WATCH */

function WatchMode({
  analysis,
  onPlay,
  onOpenSettings,
}: {
  analysis: NonNullable<ReturnType<typeof useSession>['analysis']>
  onPlay: (v: VideoRef) => void
  onOpenSettings: () => void
}) {
  const app = useStore()
  const hasKey = Boolean(app.youtubeKey)

  return (
    <div className="space-y-3.5">
      <Card>
        <SectionTitle
          icon={<Icon.Video size={15} />}
          title="Demonstrations matched to your situation"
          subtitle={
            hasKey
              ? 'Matched on what is actually in your photo, not generic search results'
              : 'Built from what is on screen — add a YouTube key for real matches'
          }
        />
        {!hasKey && (
          <p className="mb-3 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-[11px] leading-relaxed text-ink-400">
            Without a YouTube Data API key I can only give you precise searches, because I will not invent a video ID.
            Add one in Settings and you get real matched videos, real thumbnails and the chapter timestamps the uploader
            wrote in the description.
          </p>
        )}
      </Card>

      {analysis.videos.length === 0 ? (
        <Card>
          <Empty
            icon={<Icon.Video size={26} />}
            title="No demonstrations found for this one"
            body="That usually means the task is too specific to match reliably. Tell me the make and model and I will look again."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {analysis.videos.map((v) => (
            <VideoCard key={v.id} video={v} onPlay={onPlay} />
          ))}
        </div>
      )}

      <Card>
        <SectionTitle icon={<Icon.Search size={15} />} title="How I chose these" />
        <ul className="space-y-2 text-xs leading-relaxed text-ink-300">
          <li>• Searches are built from the task, the identified objects and the specific fault — not from the category.</li>
          <li>• Results are ranked on keyword overlap with your situation and on whether they are actually instructional.</li>
          <li>• Videos whose description contains chapters are preferred, and those timestamps are shown as-is.</li>
          <li>• If nothing matches well enough, I say so rather than padding the list with filler.</li>
        </ul>
        {!hasKey && (
          <Button size="sm" variant="ghost" className="mt-3" onClick={onOpenSettings}>
            <Icon.Settings size={14} /> Add a YouTube key
          </Button>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ READ */

function ReadMode({
  analysis,
  onOpenSettings,
}: {
  analysis: NonNullable<ReturnType<typeof useSession>['analysis']>
  onOpenSettings: () => void
}) {
  const app = useStore()
  const [level, setLevel] = useState(app.persona.skill)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<'simple' | 'detailed'>(analysis.steps.length > 6 ? 'simple' : 'detailed')
  const toast = useToast()

  const base = detail === 'simple' ? analysis.simpleExplanation : analysis.detailedExplanation

  const rewrite = async (next: typeof level) => {
    setLevel(next)
    setLoading(true)
    try {
      const out = await explain({
        analysis,
        level: next,
        language: LANGUAGES.find((l) => l.code === app.voice.language)?.label ?? 'English',
        settings: app.settings,
      })
      setText(out)
    } catch {
      setText(null)
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    const body = [
      analysis.title,
      '',
      analysis.summary,
      '',
      ...analysis.steps.map((s) => `${s.n}. ${s.title}\n${s.detail}${s.check ? `\nCheck: ${s.check}` : ''}`),
    ].join('\n')
    const ok = await copyToClipboard(body)
    if (!ok) toast.show('Could not copy — select the text instead.')
  }

  return (
    <div className="space-y-3.5">
      <Card>
        <SectionTitle
          icon={<Icon.Book size={15} />}
          title="Written instructions"
          subtitle="Same answer, at the level you want it"
        />
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="flex rounded-xl border border-white/8 bg-white/4 p-0.5">
            <button
              onClick={() => setDetail('simple')}
              className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', detail === 'simple' ? 'bg-white/12 text-white' : 'text-ink-400')}
            >
              Simple
            </button>
            <button
              onClick={() => setDetail('detailed')}
              className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', detail === 'detailed' ? 'bg-white/12 text-white' : 'text-ink-400')}
            >
              Detailed
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['beginner', 'normal', 'detailed', 'expert'] as const).map((l) => (
              <Chip key={l} active={level === l} onClick={() => void rewrite(l)}>
                {l}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-ink-400">
            <Spinner /> Rewriting at {level} level…
          </div>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-100">{text ?? base}</p>
        )}

        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button size="sm" onClick={copy}>
            <Icon.Copy size={14} /> Copy
          </Button>
          {isDemoSettings(app.settings) && (
            <Button size="sm" variant="ghost" onClick={onOpenSettings}>
              <Icon.Settings size={14} /> Rewriting needs a key
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Icon.List size={15} />} title={`${analysis.steps.length} steps`} />
        <ol className="space-y-3.5">
          {analysis.steps.map((s) => (
            <li key={s.n} className="border-l-2 border-white/8 pl-3.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span className="text-brand-300">{s.n}.</span>
                {s.title}
                {s.durationSec ? <Badge tone="neutral">{formatDuration(s.durationSec)}</Badge> : null}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-200">{s.detail}</p>
              {s.check && <p className="mt-1.5 text-xs text-emerald-300">✓ {s.check}</p>}
              {s.tip && <p className="mt-1 text-xs text-ink-400">Tip: {s.tip}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ DO IT WITH ME */

function DoMode({
  onOpenRecipe,
  onCompare,
  onShopping,
}: {
  onOpenRecipe: (r: Recipe) => void
  onCompare: () => void
  onShopping: () => void
}) {
  const session = useSession()
  const app = useStore()
  const speaker = useSpeaker()
  const speechState = useSpeech()
  const { steps, index, current, isFirst, isLast, total } = useStep()
  const toast = useToast()
  const [recipeIndex, setRecipeIndex] = useState(0)
  const [deepening, setDeepening] = useState(false)
  const analysis = session.analysis!

  const done = session.completed[index]

  const speakStep = (n: number) => {
    const step = steps.find((s) => s.n === n)
    if (!step) return
    void speaker.speak([{ id: `step-${step.n}`, text: step.voice || `${step.title}. ${step.detail}`, lang: app.voice.language }])
  }

  useEffect(() => {
    if (app.voice.autoSpeak && current && app.voice.enabled) speakStep(current.n)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, app.voice.autoSpeak, app.voice.enabled])

  const advance = () => {
    session.dispatch({ type: 'toggleComplete', index })
    if (!session.completed[index]) {
      store.set((s) => ({ stats: { ...s.stats, stepsCompleted: s.stats.stepsCompleted + 1 } }))
    }
    if (!isLast) {
      const next = index + 1
      session.dispatch({ type: 'setStep', index: next })
      if (app.voice.autoSpeak) setTimeout(() => speakStep(steps[next]?.n ?? next + 1), 250)
    } else {
      toast.show('That is the whole task — well done.')
      void speaker.speak('That is the whole task. Well done. If anything does not look right, take a photo and I will check it.')
    }
  }

  /* --- food mode --- */
  if (analysis.recipes.length > 0) {
    const recipe = analysis.recipes[Math.min(recipeIndex, analysis.recipes.length - 1)]
    return (
      <div className="space-y-3.5">
        <Card>
          <SectionTitle
            icon={<Icon.List size={15} />}
            title={`${analysis.recipes.length} meal${analysis.recipes.length === 1 ? '' : 's'} you can make`}
            subtitle="Ranked by how little extra shopping they need"
          />
          <div className="space-y-2">
            {analysis.recipes.map((r, i) => (
              <button
                key={r.name}
                onClick={() => setRecipeIndex(i)}
                className={cx(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
                  i === recipeIndex ? 'border-brand-400/45 bg-brand-400/10' : 'border-white/8 bg-white/3 hover:bg-white/6',
                )}
              >
                <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', i === recipeIndex ? 'bg-brand-400 text-ink-950' : 'bg-white/8 text-ink-300')}>
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{r.name}</span>
                  {r.tagline && <span className="mt-0.5 block text-[11px] text-ink-400">{r.tagline}</span>}
                  <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-ink-400">
                    {r.minutes ? <span>{formatMinutes(r.minutes)}</span> : null}
                    {r.difficulty ? <span>· {r.difficulty}</span> : null}
                    {r.missing.length ? (
                      <span className="text-amber-300">· needs {r.missing.length} more</span>
                    ) : (
                      <span className="text-emerald-300">· you have everything</span>
                    )}
                    {!r.missing.length && r.niceToHave?.length ? (
                      <span className="text-ink-500">· better with {r.niceToHave.slice(0, 2).join(', ')}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            icon={<Icon.Sparkle size={15} />}
            title={recipe.name}
            subtitle={recipe.tagline}
            right={
              <Badge tone={recipe.missing.length ? 'warn' : 'good'}>
                {recipe.missing.length ? `${recipe.missing.length} missing` : 'Ready to cook'}
              </Badge>
            }
          />
          <MetaRow difficulty={recipe.difficulty} timeMinutes={recipe.minutes} materials={recipe.equipment} />

          <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Ingredients</h4>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className={cx('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', ing.have === false ? 'bg-amber-400' : 'bg-emerald-400')} />
                    <span className="min-w-0">
                      <span className={cx(ing.have === false && 'text-amber-200')}>{ing.item}</span>
                      {ing.quantity ? <span className="text-ink-400"> — {ing.quantity}</span> : null}
                      {ing.optional ? <span className="text-ink-500"> (optional)</span> : null}
                      {ing.substitute ? <span className="block text-[11px] text-ink-400">or {ing.substitute}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Cooking steps</h4>
              <ol className="space-y-2">
                {recipe.steps.map((s) => (
                  <li key={s.n} className="flex gap-2 text-xs leading-relaxed">
                    <span className="font-semibold text-brand-300">{s.n}.</span>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-100">{s.title}</span>
                      <span className="text-ink-300">{s.detail}</span>
                      {s.check && <span className="mt-0.5 block text-emerald-300">✓ {s.check}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => onOpenRecipe(recipe)}>
              <Icon.Hand size={14} /> Cook this with me
            </Button>
            <Button
              size="sm"
              onClick={() =>
                void speaker.speak([
                  { id: 'r', text: `${recipe.name}. ${recipe.steps.map((s) => `Step ${s.n}: ${s.title}. ${s.detail}`).join(' ') }`, lang: app.voice.language },
                ])
              }
            >
              <Icon.Volume size={14} /> Read the method
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={deepening}
              onClick={async () => {
                setDeepening(true)
                try {
                  const deeper = await deepenRecipe({
                    recipe,
                    have: buildKitchenContext(app.knowledge),
                    missing: recipe.missing,
                    constraints: app.persona.constraints,
                    servings: recipe.servings ?? 2,
                    settings: app.settings,
                  })
                  const next = [...analysis.recipes]
                  next[recipeIndex] = deeper
                  session.dispatch({ type: 'success', analysis: { ...analysis, recipes: next }, meta: session.meta!, visualRead: session.visualRead ?? undefined })
                  toast.show('Recipe expanded')
                } catch {
                  toast.show('Could not expand that right now')
                } finally {
                  setDeepening(false)
                }
              }}
            >
              {deepening ? <Spinner /> : <Icon.Sparkle size={14} />} More detail
            </Button>
            {recipe.missing.length > 0 && (
              <Button size="sm" variant="ghost" onClick={onShopping}>
                <Icon.Layers size={14} /> What I need to buy
              </Button>
            )}
          </div>

          {recipe.niceToHave?.length ? (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
              <span className="font-semibold">Still works without these, but better with: </span>
              {recipe.niceToHave.join(', ')}.
            </p>
          ) : null}
          {recipe.notes && <p className="mt-2.5 text-[11px] leading-relaxed text-ink-400">{recipe.notes}</p>}
          {recipe.costZar ? (
            <p className="mt-1 text-[11px] text-ink-500">Rough ingredient cost: about R{recipe.costZar} — an estimate, prices vary by shop.</p>
          ) : null}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Chip onClick={onCompare}>
            <Icon.Compare size={12} /> Did it turn out right?
          </Chip>
          {analysis.askMeNext.slice(0, 3).map((s) => (
            <Chip key={s} onClick={() => void session.send(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </div>
    )
  }

  /* --- step-by-step mode --- */
  if (!steps.length) {
    return (
      <Card>
        <Empty icon={<Icon.List size={26} />} title="No steps for this one" body="Ask me what to do next and I will work it out from here." />
      </Card>
    )
  }

  return (
    <div className="space-y-3.5">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-white/6">
          <div className="h-full bg-gradient-to-r from-brand-400 to-rose-brand transition-all duration-500" style={{ width: `${((index + (done ? 1 : 0)) / total) * 100}%` }} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Step {index + 1} of {total}
          </span>
          <button onClick={() => speakStep(current?.n ?? index + 1)} className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-300 hover:text-brand-200">
            <Icon.Volume size={13} /> {speechState.speaking ? 'Speaking…' : 'Read aloud'}
          </button>
        </div>

        <h3 className="mt-2 text-lg font-bold leading-snug">{current?.title}</h3>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-100">{current?.detail}</p>

        {current?.why && (
          <p className="mt-2 flex gap-2 text-xs leading-relaxed text-ink-300">
            <Icon.Bulb size={13} className="mt-0.5 shrink-0 text-violet-brand" />
            {current.why}
          </p>
        )}
        {current?.check && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
            <Icon.Check size={14} className="mt-0.5 shrink-0 text-emerald-300" />
            <span className="text-xs leading-relaxed text-emerald-100">{current.check}</span>
          </div>
        )}
        {current?.tip && <p className="mt-2 text-xs leading-relaxed text-ink-400">Tip: {current.tip}</p>}
        {current?.risk && current.risk !== 'none' && current.risk !== 'low' && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Icon.Alert size={13} /> This step carries extra risk — take it slowly
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" onClick={() => session.dispatch({ type: 'setStep', index: index - 1 })} disabled={isFirst}>
            <Icon.ChevronLeft size={16} /> Back
          </Button>
          <Button variant="primary" className="flex-1" onClick={advance}>
            {done ? (
              isLast ? (
                <>
                  <Icon.Check size={16} /> Finish
                </>
              ) : (
                <>
                  Next step <Icon.ArrowRight size={16} />
                </>
              )
            ) : isLast ? (
              <>
                <Icon.Check size={16} /> I have done it — finish
              </>
            ) : (
              <>
                <Icon.Check size={16} /> I have done it
              </>
            )}
          </Button>
        </div>
      </Card>

      {current?.diagram && <DiagramCard diagram={current.diagram} stepNumber={current.n} />}

      <div className="flex flex-wrap gap-2">
        <Chip onClick={onCompare}>
          <Icon.Compare size={12} /> Check with a photo
        </Chip>
        <Chip onClick={() => void session.send("What's next?")}>What&rsquo;s next?</Chip>
        <Chip onClick={() => void session.send('Explain that more simply')}>Simpler please</Chip>
        <Chip onClick={() => void session.send('Something is different from what you said')}>That doesn&rsquo;t match</Chip>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ follow-up */

function FollowUp({
  q,
  answered,
  onAnswer,
}: {
  q: NonNullable<ReturnType<typeof useSession>['analysis']>['followUpQuestions'][number]
  answered?: string
  onAnswer: (a: string) => void
}) {
  const [text, setText] = useState('')
  const session = useSession()

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-3">
      <p className="text-sm font-medium leading-snug">
        {q.question}
        {q.important && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-400">important</span>}
      </p>
      {q.why && <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{q.why}</p>}

      {answered ? (
        <div className="mt-2.5 flex items-center gap-2">
          <Badge tone="good">
            <Icon.Check size={10} /> {answered}
          </Badge>
          <button onClick={() => onAnswer('')} className="text-[11px] text-ink-400 underline">
            change
          </button>
        </div>
      ) : q.kind === 'text' ? (
        <div className="mt-2.5 flex gap-2">
          <input
            className="field flex-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer"
            onKeyDown={(e) => e.key === 'Enter' && text.trim() && onAnswer(text.trim())}
          />
          <Button variant="primary" onClick={() => text.trim() && onAnswer(text.trim())} disabled={!text.trim()}>
            <Icon.ArrowRight size={16} />
          </Button>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(q.options.length ? q.options : ['Yes', 'No']).map((o) => (
            <Chip key={o} onClick={() => onAnswer(o)}>
              {o}
            </Chip>
          ))}
        </div>
      )}

      {session.status === 'analyzing' && !answered && (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-ink-400">
          <Spinner className="h-3 w-3" /> Updating the guide…
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ compare */

function CompareSheet({ open, onClose, onOpenSettings }: { open: boolean; onClose: () => void; onOpenSettings: () => void }) {
  const session = useSession()
  const app = useStore()
  const [before, setBefore] = useState<Attachment | null>(null)
  const [after, setAfter] = useState<Attachment | null>(null)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = (slot: 'before' | 'after', list: Attachment[]) => {
    const first = list[0]
    if (!first) return
    if (slot === 'before') setBefore(first)
    else setAfter(first)
  }

  const input = (slot: 'before' | 'after') => (
    <input
      type="file"
      accept="image/*"
      hidden
      onChange={async (e) => {
        const files = e.target.files
        if (!files?.length) return
        const r = await attachmentsFromFiles(Array.from(files))
        pick(slot, r.attachments)
        e.target.value = ''
      }}
      id={`cmp-${slot}`}
    />
  )

  const run = async () => {
    if (!before || !after) return
    setBusy(true)
    try {
      const out = await compareImages({ before, after, analysis: session.analysis ?? undefined, settings: app.settings, persona: app.persona })
      setResult(out)
    } catch (err) {
      setResult({
        verdict: 'cannot_tell',
        headline: err instanceof Error ? err.message : 'Comparison failed.',
        whatChanged: [],
        stillToDo: [],
        confidence: 0,
        caveat: '',
        annotations: [],
        demo: false,
      })
    } finally {
      setBusy(false)
    }
  }

  const verdictTone = result?.verdict === 'correct' ? 'good' : result?.verdict === 'not_correct' ? 'bad' : result?.verdict === 'partially_correct' ? 'warn' : 'neutral'

  return (
    <Sheet open={open} onClose={onClose} title="Compare before and after" full>
      <div className="space-y-4 p-4">
        <p className="text-xs leading-relaxed text-ink-300">
          Take one photo before you start and one after you finish, from roughly the same angle and distance. I will tell
          you what actually changed — and what a photo genuinely cannot tell you.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {(['before', 'after'] as const).map((slot) => {
            const value = slot === 'before' ? before : after
            return (
              <div key={slot}>
                <span className="label">{slot}</span>
                <button
                  onClick={() => document.getElementById(`cmp-${slot}`)?.click()}
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 transition hover:border-brand-400/40"
                >
                  {value ? (
                    <img src={value.dataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-ink-500">
                      <Icon.Camera size={20} />
                      <span className="text-[11px]">Add photo</span>
                    </span>
                  )}
                </button>
                {input(slot)}
              </div>
            )
          })}
        </div>

        <Button variant="primary" disabled={!before || !after || busy} onClick={run} className="w-full">
          {busy ? <Spinner /> : <Icon.Compare size={16} />} Compare them
        </Button>

        {result && (
          <div className="space-y-3.5">
            <div className={cx('rounded-xl2 border p-3.5', verdictTone === 'good' ? 'border-emerald-500/30 bg-emerald-500/8' : verdictTone === 'bad' ? 'border-rose-500/30 bg-rose-500/8' : 'border-amber-500/30 bg-amber-500/8')}>
              <div className="mb-1.5 flex items-center gap-2">
                <Badge tone={verdictTone as never}>
                  {result.verdict.replace('_', ' ')}
                </Badge>
                {result.confidence ? <span className="text-[11px] text-ink-400">{Math.round(result.confidence * 100)}% confident</span> : null}
              </div>
              <p className="text-sm font-medium leading-relaxed">{result.headline}</p>
            </div>

            {result.whatChanged.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">What changed</h4>
                <ul className="space-y-1.5">
                  {result.whatChanged.map((w, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-200">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-brand" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.stillToDo.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Still to do</h4>
                <ul className="space-y-1.5">
                  {result.stillToDo.map((w, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-amber-100">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {after && result.annotations.length > 0 && (
              <AnnotatedImage src={after.dataUrl} annotations={result.annotations} className="border border-white/8" />
            )}

            <div className="rounded-xl border border-white/8 bg-white/4 p-3">
              <p className="flex gap-2 text-[11px] leading-relaxed text-ink-300">
                <Icon.Shield size={13} className="mt-0.5 shrink-0 text-amber-300" />
                {result.caveat || 'Two photos cannot prove something is safe, sealed or correctly torqued. They only show what looks different.'}
              </p>
            </div>

            {result.demo && (
              <Button variant="ghost" className="w-full" onClick={onOpenSettings}>
                <Icon.Settings size={15} /> Add a key to compare photos properly
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ shopping */

function ShoppingSheet({
  open,
  onClose,
  items,
  taskTitle,
}: {
  open: boolean
  onClose: () => void
  items: string[]
  taskTitle: string
}) {
  const app = useStore()
  const [list, setList] = useState<{ items: ShoppingItem[]; totalEstimate: number; note: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !items.length) return
    setBusy(true)
    void shoppingList({ taskTitle, missing: items, settings: app.settings })
      .then(setList)
      .finally(() => setBusy(false))
  }, [open, taskTitle, items.join('|'), app.settings])

  const copy = async () => {
    const body = [
      `Shopping list — ${taskTitle}`,
      '',
      ...(list?.items ?? []).map((i) => `• ${i.item}${i.quantity ? ` (${i.quantity})` : ''}${i.estCost ? ` ~R${i.estCost}` : ''}`),
      list?.totalEstimate ? `\nEstimated total: about R${list.totalEstimate}` : '',
      list?.note ? `\n${list.note}` : '',
    ].join('\n')
    await copyToClipboard(body)
  }

  return (
    <Sheet open={open} onClose={onClose} title="What I still need" full>
      <div className="space-y-4 p-4">
        <p className="text-xs leading-relaxed text-ink-300">
          Only the things you actually told me you do not have. Prices are rough estimates — they vary a lot by area and
          shop, so treat them as a guide rather than a quote.
        </p>

        {busy && !list && (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <Spinner /> Building the list…
          </div>
        )}

        {items.length === 0 && (
          <Empty icon={<Icon.Check size={24} />} title="You have everything" body="Nothing to buy for this one." />
        )}

        <div className="space-y-2">
          {(list?.items ?? items.map((i) => ({ item: i, why: '', quantity: '', estCost: 0, optional: false, substitutes: [] }))).map((i, n) => (
            <div key={n} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/4 p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/15 text-[10px] text-ink-400">
                {n + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {i.item}
                  {i.optional && <Badge tone="neutral">optional</Badge>}
                </p>
                {i.why && <p className="mt-0.5 text-[11px] text-ink-400">{i.why}</p>}
                {i.substitutes?.length ? (
                  <p className="mt-1 text-[11px] text-ink-400">Could also use: {i.substitutes.join(', ')}</p>
                ) : null}
              </div>
              {i.estCost ? <span className="shrink-0 text-xs text-ink-300">~R{i.estCost}</span> : null}
            </div>
          ))}
        </div>

        {list?.totalEstimate ? (
          <div className="flex items-center justify-between rounded-xl border border-brand-400/25 bg-brand-400/8 px-3.5 py-3">
            <span className="text-xs font-medium text-ink-200">Estimated total</span>
            <span className="text-sm font-bold text-brand-200">about R{list.totalEstimate}</span>
          </div>
        ) : null}

        {list?.note && <p className="text-[11px] leading-relaxed text-ink-400">{list.note}</p>}

        {(list?.items.length ?? items.length) > 0 && (
          <Button variant="ghost" className="w-full" onClick={copy}>
            <Icon.Copy size={15} /> Copy the list
          </Button>
        )}
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ recipe detail */

function RecipeSheet({
  recipe,
  onClose,
  onStart,
}: {
  recipe: Recipe | null
  onClose: () => void
  onStart: (r: Recipe) => void
}) {
  if (!recipe) return null
  return (
    <Sheet open onClose={onClose} title={recipe.name} full>
      <div className="space-y-4 p-4">
        {recipe.tagline && <p className="text-sm text-ink-300">{recipe.tagline}</p>}
        <MetaRow difficulty={recipe.difficulty} timeMinutes={recipe.minutes} materials={recipe.equipment} />

        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Ingredients</h4>
          <ul className="space-y-1.5">
            {recipe.ingredients.map((i, n) => (
              <li key={n} className="flex items-start gap-2 text-sm">
                <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', i.have === false ? 'bg-amber-400' : 'bg-emerald-400')} />
                <span>
                  {i.item}
                  {i.quantity ? <span className="text-ink-400"> — {i.quantity}</span> : null}
                  {i.optional ? <span className="text-ink-500"> (optional)</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Method</h4>
          <ol className="space-y-3">
            {recipe.steps.map((s) => (
              <li key={s.n} className="border-l-2 border-white/8 pl-3.5">
                <p className="text-sm font-semibold">
                  <span className="text-brand-300">{s.n}. </span>
                  {s.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-200">{s.detail}</p>
                {s.check && <p className="mt-1 text-xs text-emerald-300">✓ {s.check}</p>}
              </li>
            ))}
          </ol>
        </div>

        <Button variant="primary" className="w-full" onClick={() => onStart(recipe)}>
          <Icon.Hand size={16} /> Cook this with me
        </Button>
      </div>
    </Sheet>
  )
}
