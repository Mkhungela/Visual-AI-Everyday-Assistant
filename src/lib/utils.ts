/** Tiny shared helpers. No dependencies, no side effects. */

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s ? `${m}m ${s}s` : `${m}m`
}

export function formatMinutes(min?: number) {
  if (!min || min <= 0) return ''
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} hr ${m} min` : `${h} hr`
}

export function relativeTime(ts: number) {
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

/** Split text into chunks that are safe to send to a TTS endpoint. */
export function speechChunks(text: string, max = 700): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean ? [clean] : []
  const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean]
  const out: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(cur.trim())
      cur = ''
    }
    if (s.length > max) {
      // pathological single sentence — hard-split on word boundaries
      for (const word of s.split(' ')) {
        if ((cur + ' ' + word).length > max && cur) {
          out.push(cur.trim())
          cur = ''
        }
        cur += (cur ? ' ' : '') + word
      }
    } else {
      cur += s
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export function pluralise(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/** Normalise a string for loose matching ("Sun-Dried Tomatoes" → "sun dried tomatoes"). */
export function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when two ingredient-ish strings refer to the same thing. */
export function sameIngredient(a: string, b: string) {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  const xs = x.replace(/s$/, '')
  const ys = y.replace(/s$/, '')
  if (xs === ys) return true
  return xs.includes(ys) || ys.includes(xs)
}

export function bytesToSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopy(text),
    )
  }
  return Promise.resolve(fallbackCopy(text))
}

function fallbackCopy(text: string) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Markdown-ish → plain text, for reading guidance aloud or exporting. */
export function stripMarkdown(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .trim()
}
