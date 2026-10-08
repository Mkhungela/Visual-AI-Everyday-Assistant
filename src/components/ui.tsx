/**
 * UI primitives and icons.
 *
 * Deliberately dependency-free: inline SVG, no icon library, so the app has a small
 * bundle and nothing to go stale.
 */

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../lib/utils'

/* ------------------------------------------------------------------ icons */

type IconProps = { className?: string; size?: number; strokeWidth?: number }

function Ico({
  children,
  className,
  size = 20,
  strokeWidth = 1.8,
  fill = 'none',
}: IconProps & { children: ReactNode; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const Icon = {
  Camera: (p: IconProps) => (
    <Ico {...p}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a2 2 0 0 0 1.7-.95l.5-.8A1.5 1.5 0 0 1 10.2 3.5h3.6a1.5 1.5 0 0 1 1.3.75l.5.8A2 2 0 0 0 17.3 6h1.2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.6" />
    </Ico>
  ),
  Mic: (p: IconProps) => (
    <Ico {...p}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
    </Ico>
  ),
  Upload: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 15.5V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15" />
    </Ico>
  ),
  Chat: (p: IconProps) => (
    <Ico {...p}>
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.6A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" />
    </Ico>
  ),
  Bookmark: (p: IconProps) => (
    <Ico {...p} fill="none">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z" />
    </Ico>
  ),
  BookmarkFilled: (p: IconProps) => (
    <Ico {...p} fill="currentColor" strokeWidth={0}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z" />
    </Ico>
  ),
  Book: (p: IconProps) => (
    <Ico {...p}>
      <path d="M4 4.5A2 2 0 0 1 6 2.5h6v19H6a2 2 0 0 1-2-2z" />
      <path d="M20 4.5a2 2 0 0 0-2-2h-6v19h6a2 2 0 0 0 2-2z" />
    </Ico>
  ),
  Settings: (p: IconProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </Ico>
  ),
  Home: (p: IconProps) => (
    <Ico {...p}>
      <path d="M4 10.5 12 3.5l8 7V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20z" />
      <path d="M9.5 21.5v-6h5v6" />
    </Ico>
  ),
  Play: (p: IconProps) => (
    <Ico {...p} fill="currentColor" strokeWidth={0}>
      <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.3-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z" />
    </Ico>
  ),
  Pause: (p: IconProps) => (
    <Ico {...p} fill="currentColor" strokeWidth={0}>
      <rect x="6" y="4" width="4" height="16" rx="1.2" />
      <rect x="14" y="4" width="4" height="16" rx="1.2" />
    </Ico>
  ),
  Stop: (p: IconProps) => (
    <Ico {...p} fill="currentColor" strokeWidth={0}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" />
    </Ico>
  ),
  ArrowRight: (p: IconProps) => (
    <Ico {...p}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Ico>
  ),
  ChevronLeft: (p: IconProps) => (
    <Ico {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Ico>
  ),
  ChevronDown: (p: IconProps) => (
    <Ico {...p}>
      <path d="M5 9l7 7 7-7" />
    </Ico>
  ),
  Check: (p: IconProps) => (
    <Ico {...p}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Ico>
  ),
  X: (p: IconProps) => (
    <Ico {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Ico>
  ),
  Alert: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 3.5 21.5 20H2.5z" />
      <path d="M12 9.5v5M12 17.3v.2" />
    </Ico>
  ),
  Sparkle: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </Ico>
  ),
  Eye: (p: IconProps) => (
    <Ico {...p}>
      <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Ico>
  ),
  Volume: (p: IconProps) => (
    <Ico {...p}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </Ico>
  ),
  VolumeOff: (p: IconProps) => (
    <Ico {...p}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </Ico>
  ),
  Video: (p: IconProps) => (
    <Ico {...p}>
      <rect x="2.5" y="5.5" width="13" height="13" rx="2.5" />
      <path d="M15.5 10.5l6-3.5v10l-6-3.5z" />
    </Ico>
  ),
  Hand: (p: IconProps) => (
    <Ico {...p}>
      <path d="M8 11V4.8a1.4 1.4 0 0 1 2.8 0V11M10.8 10.5V3.8a1.4 1.4 0 0 1 2.8 0v6.7M13.6 10.8V5.3a1.4 1.4 0 0 1 2.8 0V12" />
      <path d="M16.4 12V8.8a1.4 1.4 0 0 1 2.8 0v5.4c0 4-2.6 7-6.6 7-3.4 0-4.9-1.8-6.4-4.6L4.9 14a1.4 1.4 0 0 1 2.3-1.5L8 13.6" />
    </Ico>
  ),
  Wrench: (p: IconProps) => (
    <Ico {...p}>
      <path d="M15.5 3.5a5.5 5.5 0 0 0-5 8.3L4 18.3a2 2 0 1 0 2.8 2.8l6.5-6.6a5.5 5.5 0 0 0 7.7-6.6l-3.4 3.4-3-3z" />
    </Ico>
  ),
  List: (p: IconProps) => (
    <Ico {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </Ico>
  ),
  Clock: (p: IconProps) => (
    <Ico {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </Ico>
  ),
  Shield: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 2.5 20 6v6c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5V6z" />
      <path d="M8.8 12.2l2.2 2.2 4.2-4.4" />
    </Ico>
  ),
  Layers: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 2.8 21 7.5l-9 4.7-9-4.7z" />
      <path d="M3 12.2l9 4.7 9-4.7M3 16.6l9 4.7 9-4.7" />
    </Ico>
  ),
  Plus: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 5v14M5 12h14" />
    </Ico>
  ),
  Trash: (p: IconProps) => (
    <Ico {...p}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L18 7" />
    </Ico>
  ),
  Copy: (p: IconProps) => (
    <Ico {...p}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" />
    </Ico>
  ),
  Refresh: (p: IconProps) => (
    <Ico {...p}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4.5V10H15" />
    </Ico>
  ),
  Search: (p: IconProps) => (
    <Ico {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </Ico>
  ),
  Screen: (p: IconProps) => (
    <Ico {...p}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 20.5h7M12 17v3.5" />
    </Ico>
  ),
  Bulb: (p: IconProps) => (
    <Ico {...p}>
      <path d="M9 18h6M10 21.5h4" />
      <path d="M12 2.5a7 7 0 0 0-4 12.7V18h8v-2.8A7 7 0 0 0 12 2.5z" />
    </Ico>
  ),
  Compare: (p: IconProps) => (
    <Ico {...p}>
      <rect x="2.5" y="4.5" width="8" height="15" rx="1.5" />
      <rect x="13.5" y="4.5" width="8" height="15" rx="1.5" />
      <path d="M12 3v18" />
    </Ico>
  ),
  Pin: (p: IconProps) => (
    <Ico {...p}>
      <path d="M9 3.5h6l-.7 5.2 3.2 3.3-4.5 1v6l-1.5 1.5-1.5-1.5v-6l-4.5-1 3.2-3.3z" />
    </Ico>
  ),
  Lock: (p: IconProps) => (
    <Ico {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Ico>
  ),
  Rocket: (p: IconProps) => (
    <Ico {...p}>
      <path d="M12 2.5s5 3 5 9c0 3-1.5 5.5-2.5 7h-5C8.5 17 7 14.5 7 11.5c0-6 5-9 5-9z" />
      <circle cx="12" cy="10" r="1.8" />
      <path d="M9.5 18.5 7 21l3-.5M14.5 18.5 17 21l-3-.5" />
    </Ico>
  ),
}

/* ------------------------------------------------------------------ layout */

export function Card({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return <As className={cx('surface p-4', className)}>{children}</As>
}

export function SectionTitle({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon && <div className="mt-0.5 text-brand-400">{icon}</div>}
        <div>
          <h2 className="text-[15px] font-semibold leading-tight text-ink-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs leading-snug text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  className,
  disabled,
  type = 'button',
  title,
  ...rest
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'bare' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  title?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'onClick' | 'disabled' | 'type' | 'title' | 'children'>) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-[15px]',
    xl: 'px-6 py-4 text-base',
  }
  const variants = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25',
    bare: 'text-ink-300 hover:text-ink-100',
  }
  return (
    <button
      {...rest}
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx('btn', sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  active,
  onClick,
  className,
  title,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx('chip', active && 'chip-active', className)}
      disabled={!onClick}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'brand'
  className?: string
}) {
  const tones = {
    neutral: 'bg-white/6 text-ink-300 border-white/8',
    good: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
    warn: 'bg-amber-500/12 text-amber-200 border-amber-500/25',
    bad: 'bg-rose-500/12 text-rose-200 border-rose-500/25',
    info: 'bg-sky-500/12 text-sky-200 border-sky-500/25',
    brand: 'bg-brand-400/12 text-brand-200 border-brand-400/25',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-ink-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition',
          checked ? 'border-brand-400/50 bg-brand-400/30' : 'border-white/10 bg-white/8',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
          style={{ height: 18, width: 18 }}
        />
      </button>
    </label>
  )
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
  secret,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
  secret?: boolean
  mono?: boolean
}) {
  const [reveal, setReveal] = useState(false)
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <input
          className={cx('field', mono && 'font-mono text-xs', secret && 'pr-16')}
          type={secret && !reveal ? 'password' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-300 hover:text-white"
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-400">{hint}</span>}
    </label>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="field appearance-none pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-850">
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-400">{hint}</span>}
    </label>
  )
}

/* ------------------------------------------------------------------ overlays */

export function Sheet({
  open,
  onClose,
  children,
  title,
  full,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  full?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cx(
          'anim-sheet relative z-10 flex w-full flex-col overflow-hidden border border-white/10 bg-ink-900 shadow-2xl',
          full
            ? 'h-[100dvh] rounded-none sm:h-[92dvh] sm:max-w-2xl sm:rounded-2xl'
            : 'max-h-[90dvh] rounded-t-3xl sm:max-w-lg sm:rounded-2xl',
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/8 hover:text-white">
              <Icon.X size={18} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-white/8', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-rose-brand transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  )
}

export function Ring({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 5) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="3.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#ringgrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <defs>
        <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff5e7e" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 fill-ink-200 text-[10px] font-semibold"
        style={{ transformOrigin: 'center' }}
      >
        {Math.round(value * 100)}
      </text>
    </svg>
  )
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-ink-500">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink-200">{title}</h3>
      {body && <p className="max-w-xs text-xs leading-relaxed text-ink-400">{body}</p>}
      {action}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-brand-400',
        className,
      )}
    />
  )
}

/** Announce a transient message politely to screen readers as well as visually. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!message) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(onDone, 2600)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [message, onDone])
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="anim-rise pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/12 bg-ink-800/95 px-4 py-2 text-xs font-medium shadow-xl backdrop-blur"
    >
      {message}
    </div>
  )
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  return { message, show: setMessage, clear: () => setMessage(null) }
}
