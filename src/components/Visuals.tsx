/**
 * Visual guidance.
 *
 * `AnnotatedImage` is the SHOW ME surface: arrows, circles and labels drawn over the
 * user's own photo using normalised coordinates from the model. Shapes are SVG in the
 * image's own pixel space so circles stay circular; labels are HTML so their text
 * stays legible regardless of image size.
 *
 * `DiagramCard` is the honest fallback: when we know *what* a control is but cannot
 * locate it in the photo, we illustrate the description instead of inventing a
 * position.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Annotation, SafetyFlag, Step, StepDiagram } from '../lib/schema'
import { RISK_META, highestRisk } from '../lib/schema'
import type { VideoRef } from '../lib/schema'
import { cx, formatDuration, formatMinutes } from '../lib/utils'
import { Badge, Button, Icon, ProgressBar } from './ui'
import { embedUrl } from '../lib/videos'

/* ------------------------------------------------------------------ annotated image */

export function AnnotatedImage({
  src,
  annotations,
  activeStep,
  onPick,
  className,
  children,
}: {
  src: string
  annotations: Annotation[]
  activeStep?: number
  onPick?: (a: Annotation) => void
  className?: string
  children?: React.ReactNode
}) {
  const [dims, setDims] = useState({ w: 1000, h: 750 })
  const [showAll, setShowAll] = useState(false)

  const visible = useMemo(() => {
    if (showAll || activeStep === undefined) return annotations
    const forStep = annotations.filter((a) => a.step === undefined || a.step === activeStep)
    return forStep.length ? forStep : annotations
  }, [annotations, activeStep, showAll])

  const w = dims.w
  const h = dims.h
  const strokeScale = Math.max(w, h) / 900

  return (
    <div className={cx('relative overflow-hidden rounded-2xl bg-ink-950', className)}>
      <div className="relative w-full" style={{ aspectRatio: `${w} / ${h}` }}>
        <img
          src={src}
          alt="What you showed me"
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth && img.naturalHeight) setDims({ w: img.naturalWidth, h: img.naturalHeight })
          }}
        />

        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: onPick ? 'auto' : 'none' }}
        >
          {visible.map((a, i) => {
            const px = a.x * w
            const py = a.y * h
            const colour = a.tone === 'danger' ? '#fb7185' : a.tone === 'success' ? '#34d399' : '#ffb347'
            const isActive = a.step === activeStep
            const common = { key: a.id, className: isActive ? 'anim-pop' : undefined }

            if (a.kind === 'box' || a.kind === 'highlight') {
              const bw = (a.w ?? 0.18) * w
              const bh = (a.h ?? 0.12) * h
              return (
                <g {...common}>
                  <rect
                    x={px - bw / 2}
                    y={py - bh / 2}
                    width={bw}
                    height={bh}
                    rx={6 * strokeScale}
                    fill={a.kind === 'highlight' ? `${colour}22` : 'none'}
                    stroke={colour}
                    strokeWidth={2.5 * strokeScale}
                    strokeDasharray={a.kind === 'box' ? `${9 * strokeScale} ${6 * strokeScale}` : undefined}
                    onClick={() => onPick?.(a)}
                    style={{ cursor: onPick ? 'pointer' : 'default' }}
                  />
                </g>
              )
            }

            if (a.kind === 'arrow') {
              const angle = ((a.angle ?? -90) * Math.PI) / 180
              const len = Math.min(w, h) * 0.22
              const tailX = px - Math.cos(angle) * len
              const tailY = py - Math.sin(angle) * len
              return (
                <g {...common}>
                  <line
                    x1={tailX}
                    y1={tailY}
                    x2={px}
                    y2={py}
                    stroke={colour}
                    strokeWidth={3.5 * strokeScale}
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              )
            }

            if (a.kind === 'line') {
              const angle = ((a.angle ?? 0) * Math.PI) / 180
              const len = Math.min(w, h) * 0.18
              return (
                <line
                  {...common}
                  x1={px - Math.cos(angle) * len}
                  y1={py - Math.sin(angle) * len}
                  x2={px + Math.cos(angle) * len}
                  y2={py + Math.sin(angle) * len}
                  stroke={colour}
                  strokeWidth={3 * strokeScale}
                  strokeLinecap="round"
                />
              )
            }

            // circle + label fall through to a ring marker with an HTML label on top
            const radius = Math.max(a.w ?? 0.09, a.h ?? 0.09) * Math.min(w, h) * 0.5
            return (
              <g {...common} onClick={() => onPick?.(a)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
                {isActive && (
                  <circle cx={px} cy={py} r={radius * 1.35} fill="none" stroke={colour} strokeWidth={1.5 * strokeScale} opacity={0.4} />
                )}
                <circle
                  cx={px}
                  cy={py}
                  r={radius}
                  fill="none"
                  stroke={colour}
                  strokeWidth={3 * strokeScale}
                  strokeDasharray={a.kind === 'circle' ? undefined : `${8 * strokeScale} ${5 * strokeScale}`}
                />
                <circle cx={px} cy={py} r={2.6 * strokeScale} fill={colour} />
              </g>
            )
          })}

          <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2.6" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4 Z" fill="#ffb347" />
            </marker>
          </defs>
        </svg>

        {/* Labels as HTML so text never distorts with the image */}
        {visible.map((a, i) => {
          const onLeft = a.x > 0.6
          return (
            <button
              key={`lbl-${a.id}-${i}`}
              type="button"
              onClick={() => onPick?.(a)}
              className={cx(
                'absolute z-10 max-w-[46%] -translate-y-1/2 rounded-lg border px-2 py-1 text-left text-[11px] font-semibold leading-tight shadow-lg backdrop-blur-sm transition',
                a.tone === 'danger'
                  ? 'border-rose-400/50 bg-rose-950/80 text-rose-100'
                  : a.tone === 'success'
                    ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-100'
                    : 'border-brand-400/50 bg-ink-950/85 text-brand-100',
                a.step === activeStep && 'ring-1 ring-brand-400/60',
                onPick && 'hover:scale-[1.03]',
              )}
              style={{
                left: onLeft ? undefined : `calc(${a.x * 100}% + ${a.x > 0.35 ? '-100%' : '14px'})`,
                right: onLeft ? `calc(${(1 - a.x) * 100}% + 14px)` : undefined,
                top: `${a.y * 100}%`,
              }}
            >
              {a.step ? <span className="mr-1 opacity-70">{a.step}.</span> : null}
              {a.label}
            </button>
          )
        })}
      </div>

      {annotations.length > 1 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="absolute right-2.5 top-2.5 z-20 rounded-full border border-white/15 bg-ink-950/80 px-2.5 py-1 text-[11px] font-semibold text-ink-200 backdrop-blur hover:text-white"
        >
          {showAll ? 'Just this step' : `All ${annotations.length} marks`}
        </button>
      )}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ generic diagram */

const POSITIONS: Record<StepDiagram['position'], { x: number; y: number }> = {
  tl: { x: 1, y: 1 },
  tc: { x: 3, y: 1 },
  tr: { x: 5, y: 1 },
  ml: { x: 1, y: 3 },
  mc: { x: 3, y: 3 },
  mr: { x: 5, y: 3 },
  bl: { x: 1, y: 5 },
  bc: { x: 3, y: 5 },
  br: { x: 5, y: 5 },
}

/**
 * A schematic, not a reading of the photo. Used only when we know what a control is
 * called and where it usually sits, never to imply we found it in the user's image.
 */
export function DiagramCard({ diagram, stepNumber }: { diagram: StepDiagram; stepNumber?: number }) {
  const pos = POSITIONS[diagram.position] ?? POSITIONS.mc
  const cell = 44
  const gap = 14
  const pad = 26
  const W = pad * 2 + cell * 3 + gap * 2
  const H = pad * 2 + cell * 3 + gap * 2 + 26
  const kind = diagram.kind

  return (
    <div className="surface-flat overflow-hidden p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-ink-400">
        <Icon.Layers size={13} />
        <span>Generic diagram — shows what to look for, not your photo</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[300px]">
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.09)" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const x = pad + col * (cell + gap)
            const y = pad + row * (cell + gap)
            const isTarget = col === pos.x - 1 && row === pos.y - 1
            return (
              <g key={`${row}-${col}`}>
                <rect
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={kind === 'dial' && isTarget ? 22 : 9}
                  fill={isTarget ? 'rgba(255,179,71,0.16)' : 'rgba(255,255,255,0.04)'}
                  stroke={isTarget ? '#ffb347' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isTarget ? 2.4 : 1}
                  strokeDasharray={isTarget ? '5 3' : undefined}
                />
                {isTarget && (
                  <>
                    {kind === 'display' && <rect x={x + 9} y={y + 15} width={cell - 18} height={cell - 26} rx="2" fill="rgba(255,179,71,0.5)" />}
                    {kind === 'button' && <circle cx={x + cell / 2} cy={y + cell / 2} r="9" fill="rgba(255,179,71,0.65)" />}
                    {kind === 'lever' && <path d={`M${x + 14} ${y + 32} L${x + 30} ${y + 12}`} stroke="rgba(255,179,71,0.8)" strokeWidth="4" strokeLinecap="round" />}
                    {kind === 'drawer' && <rect x={x + 7} y={y + 19} width={cell - 14} height="7" rx="2" fill="rgba(255,179,71,0.7)" />}
                    {kind === 'door' && <rect x={x + 7} y={y + 7} width={cell - 14} height={cell - 14} rx="2" fill="none" stroke="rgba(255,179,71,0.7)" strokeWidth="2.4" />}
                    {(kind === 'dial' || kind === 'label' || kind === 'tool') && (
                      <circle cx={x + cell / 2} cy={y + cell / 2} r="6" fill="rgba(255,179,71,0.75)" />
                    )}
                  </>
                )}
              </g>
            )
          }),
        )}
        <text x={W / 2} y={H - 9} textAnchor="middle" fill="#ffd9a8" fontSize="12" fontWeight="600">
          {stepNumber ? `${stepNumber}. ` : ''}
          {diagram.label}
        </text>
      </svg>
      <p className="mt-1 text-center text-[11px] leading-snug text-ink-400">
        {describePosition(diagram.position)}
      </p>
    </div>
  )
}

function describePosition(p: StepDiagram['position']) {
  const rows: Record<string, string> = { t: 'top', m: 'middle', b: 'bottom' }
  const cols: Record<string, string> = { l: 'left', c: 'centre', r: 'right' }
  const row = rows[p[0]] ?? 'middle'
  const col = cols[p[1]] ?? 'centre'
  if (col === 'centre') return `Located at the ${row} of the panel`
  return `Located at the ${row} ${col} of the panel`
}

/* ------------------------------------------------------------------ safety */

export function SafetyBanner({
  flags,
  compact,
}: {
  flags: SafetyFlag[]
  compact?: boolean
}) {
  if (!flags.length) return null
  const worst = highestRisk(flags)
  const meta = RISK_META[worst]
  const stopped = flags.some((f) => f.stop)
  const escalate = flags.some((f) => f.escalate)

  if (compact) {
    return (
      <div className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs', meta.bg, meta.border)}>
        <Icon.Shield size={15} className={meta.colour} />
        <span className={cx('font-medium', meta.colour)}>{meta.label}</span>
        <span className="truncate text-ink-300">{flags[0].message}</span>
      </div>
    )
  }

  return (
    <div className={cx('rounded-xl2 border p-3.5', meta.bg, meta.border)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon.Shield size={17} className={meta.colour} />
        <span className={cx('text-sm font-semibold', meta.colour)}>
          {stopped ? 'Stop — this needs a professional' : escalate ? 'Take care — professional help advised' : meta.label}
        </span>
      </div>
      <ul className="space-y-2.5">
        {flags.map((f) => (
          <li key={f.id} className="flex gap-2.5">
            <span className={cx('mt-0.5 text-[11px] font-bold uppercase tracking-wide', RISK_META[f.level].colour)}>
              {f.level === 'none' ? '•' : f.level}
            </span>
            <span className="min-w-0 text-xs leading-relaxed">
              <span className="block text-ink-100">{f.message}</span>
              {f.precaution && <span className="mt-0.5 block text-ink-300">{f.precaution}</span>}
              {f.escalate && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200">
                  <Icon.Wrench size={10} /> Qualified help recommended
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ progress */

export function ProgressTracker({
  steps,
  index,
  completed,
  onJump,
  labels,
}: {
  steps: Step[]
  index: number
  completed: Record<number, boolean>
  onJump?: (i: number) => void
  labels?: string[]
}) {
  const done = steps.filter((_, i) => completed[i]).length
  return (
    <div className="surface-flat p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-200">Progress</span>
        <span className="text-[11px] text-ink-400">
          {done} of {steps.length} done
        </span>
      </div>
      <ProgressBar value={steps.length ? done / steps.length : 0} />
      <ol className="mt-3 space-y-1">
        {steps.map((s, i) => {
          const isDone = completed[i]
          const isCurrent = i === index && !isDone
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => onJump?.(i)}
                disabled={!onJump}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition',
                  isCurrent && 'bg-brand-400/10 text-brand-100',
                  !isCurrent && !isDone && 'text-ink-300 hover:bg-white/5',
                  isDone && 'text-emerald-300/80',
                )}
              >
                <span
                  className={cx(
                    'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold',
                    isDone
                      ? 'border-emerald-400/50 bg-emerald-500/25 text-emerald-200'
                      : isCurrent
                        ? 'border-brand-400/60 bg-brand-400/20 text-brand-100'
                        : 'border-white/12 text-ink-400',
                  )}
                  style={{ height: 18, width: 18 }}
                >
                  {isDone ? '✓' : isCurrent ? '→' : s.n}
                </span>
                <span className={cx('truncate', isDone && 'line-through decoration-emerald-400/40')}>
                  {labels?.[i] ?? s.title}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ step card */

export function StepCard({
  step,
  isActive,
  isDone,
  onOpen,
  onToggle,
}: {
  step: Step
  isActive?: boolean
  isDone?: boolean
  onOpen?: () => void
  onToggle?: () => void
}) {
  const [open, setOpen] = useState(isActive ?? false)
  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  const risk = RISK_META[step.risk]
  return (
    <div
      className={cx(
        'surface overflow-hidden transition',
        isActive && 'ring-1 ring-brand-400/40',
        isDone && 'opacity-70',
      )}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          onOpen?.()
        }}
        className="flex w-full items-start gap-3 p-3.5 text-left"
      >
        <span
          className={cx(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            isDone
              ? 'bg-emerald-500/20 text-emerald-300'
              : isActive
                ? 'bg-gradient-to-br from-brand-400 to-rose-brand text-ink-950'
                : 'bg-white/8 text-ink-300',
          )}
        >
          {isDone ? '✓' : step.n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={cx('text-sm font-semibold', isDone && 'line-through decoration-white/30')}>
              {step.title}
            </span>
            {step.risk !== 'none' && step.risk !== 'low' && (
              <Badge tone={step.risk === 'critical' || step.risk === 'high' ? 'bad' : 'warn'}>
                <Icon.Alert size={10} /> {risk.label}
              </Badge>
            )}
            {step.durationSec ? <Badge tone="neutral">{formatDuration(step.durationSec)}</Badge> : null}
          </span>
          {!open && <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-ink-400">{step.detail}</span>}
        </span>
        <Icon.ChevronDown className={cx('mt-1 shrink-0 text-ink-400 transition', open && 'rotate-180')} size={16} />
      </button>

      {open && (
        <div className="anim-rise space-y-3 px-3.5 pb-3.5 pl-[3.4rem]">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-100">{step.detail}</p>
          {step.why && (
            <p className="flex gap-2 text-xs leading-relaxed text-ink-300">
              <Icon.Bulb size={13} className="mt-0.5 shrink-0 text-violet-brand" />
              <span>{step.why}</span>
            </p>
          )}
          {step.check && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-2">
              <Icon.Check size={13} className="mt-0.5 shrink-0 text-emerald-300" />
              <span className="text-xs leading-relaxed text-emerald-100">
                <span className="font-semibold">Check: </span>
                {step.check}
              </span>
            </div>
          )}
          {step.tip && (
            <p className="text-xs leading-relaxed text-ink-400">
              <span className="font-semibold text-ink-300">Tip: </span>
              {step.tip}
            </p>
          )}
          {step.diagram && <DiagramCard diagram={step.diagram} stepNumber={step.n} />}
          {onToggle && (
            <Button size="sm" variant={isDone ? 'ghost' : 'primary'} onClick={onToggle}>
              {isDone ? (
                <>
                  <Icon.Refresh size={13} /> Not done yet
                </>
              ) : (
                <>
                  <Icon.Check size={13} /> I have done this
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ video */

export function VideoCard({ video, onPlay }: { video: VideoRef; onPlay: (v: VideoRef) => void }) {
  const [failed, setFailed] = useState(false)
  const isSearch = video.url.includes('results?search_query')
  const embed = embedUrl(video)

  return (
    <div className="surface overflow-hidden">
      <div className="relative aspect-video w-full bg-ink-950">
        {video.thumbnail && !failed && !isSearch ? (
          <img
            src={video.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-ink-800 to-ink-950">
            <Icon.Search size={22} className="text-brand-400" />
            <span className="px-6 text-center text-[11px] text-ink-400">
              {isSearch ? 'Live search on YouTube' : 'Preview unavailable'}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent p-3">
          {!isSearch && embed && (
            <button
              type="button"
              onClick={() => onPlay(video)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink-950 shadow-lg transition hover:scale-105"
              title="Play here"
            >
              <Icon.Play size={15} />
            </button>
          )}
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-xs font-medium text-white/90 underline-offset-2 hover:underline"
          >
            {isSearch ? 'Search YouTube' : 'Open on YouTube'}
          </a>
          {video.matchScore !== undefined && !isSearch && (
            <span className="ml-auto shrink-0 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/80">
              {Math.round(video.matchScore * 100)}% match
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5">
        <h4 className="text-sm font-semibold leading-snug">{video.title}</h4>
        {video.channel && <p className="mt-0.5 text-[11px] text-ink-400">{video.channel}</p>}
        <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-ink-300">
          <Icon.Sparkle size={12} className="mt-0.5 shrink-0 text-brand-400" />
          <span>{video.why}</span>
        </p>
        {video.chapters?.length ? (
          <div className="mt-2.5 rounded-lg border border-white/8 bg-white/4 p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Chapters from the description
            </p>
            <ul className="space-y-1">
              {video.chapters.map((c, i) => (
                <li key={i} className="flex gap-2 text-[11px]">
                  <span className="shrink-0 font-mono text-brand-300">{c.t}</span>
                  <span className="text-ink-300">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ misc bits */

export function MetaRow({
  difficulty,
  timeMinutes,
  tools,
  materials,
}: {
  difficulty?: string
  timeMinutes?: number
  tools?: string[]
  materials?: string[]
}) {
  const items: { icon: React.ReactNode; label: string }[] = []
  if (difficulty) items.push({ icon: <Icon.Rocket size={12} />, label: `Difficulty: ${difficulty}` })
  if (timeMinutes) items.push({ icon: <Icon.Clock size={12} />, label: formatMinutes(timeMinutes) })
  if (tools?.length) items.push({ icon: <Icon.Wrench size={12} />, label: tools.join(', ') })
  if (materials?.length) items.push({ icon: <Icon.Layers size={12} />, label: materials.join(', ') })
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span
          key={i}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-[11px] text-ink-300"
        >
          <span className="text-brand-400">{it.icon}</span>
          <span className="truncate">{it.label}</span>
        </span>
      ))}
    </div>
  )
}

export function DemoNotice({ notice, onOpenSettings }: { notice: string; onOpenSettings: () => void }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-violet-brand/25 bg-violet-brand/8 p-3">
      <Icon.Sparkle size={15} className="mt-0.5 shrink-0 text-violet-brand" />
      <div className="min-w-0 text-xs leading-relaxed text-ink-200">
        <span className="font-semibold text-violet-brand">Demo engine running. </span>
        {notice}
        <button
          onClick={onOpenSettings}
          className="ml-1 font-semibold text-brand-300 underline underline-offset-2 hover:text-brand-200"
        >
          Add a key
        </button>
      </div>
    </div>
  )
}

export function VideoPlayerSheet({ video, onClose }: { video: VideoRef | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!video) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [video, onClose])

  if (!video) return null
  const embed = embedUrl(video)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" ref={ref}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur" onClick={onClose} />
      <div className="anim-pop relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/12 bg-ink-900">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <p className="truncate pr-4 text-sm font-semibold">{video.title}</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/8 hover:text-white">
            <Icon.X size={18} />
          </button>
        </div>
        {embed ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={embed}
              title={video.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-ink-300">
            This one has to open on YouTube.{' '}
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-brand-300 underline">
              Open it here
            </a>
            .
          </div>
        )}
        <div className="p-3.5">
          <p className="text-xs leading-relaxed text-ink-300">{video.why}</p>
        </div>
      </div>
    </div>
  )
}
