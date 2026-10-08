/**
 * Video intelligence.
 *
 * The goal is not "here are some search results" — it is "here is a demonstration
 * of the exact thing you are looking at". Two honest paths:
 *
 *  with a YouTube Data API key — real search, real thumbnails, real durations, and
 *    chapters parsed from each video's own description timestamps.
 *  without one — precise deep links, clearly presented as searches rather than as
 *    matched videos. We never invent a video ID or a timestamp.
 */

import type { AnalysisResult } from './schema'
import type { VideoRef } from './schema'

export interface RawVideo {
  id: string
  title: string
  channel: string
  description: string
  thumbnail: string
  url: string
  publishedAt?: string
}

const HOWTO_SIGNALS = [
  'how to',
  'tutorial',
  'guide',
  'step by step',
  'step-by-step',
  'explained',
  'walkthrough',
  'beginner',
  'diy',
]

const STOP = new Set([
  'the','a','an','and','or','of','to','for','with','in','on','at','is','are','be','it','this','that','my','your',
  'how','do','i','you','what','should','me','can','we','if','not','then','get','got','need','want','use','using',
  'your','from','by','as','so','but','also','have','has','was','were','will','would','could','there','here',
])

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

/** Build the queries worth searching, best first. */
export function buildQueries(analysis: AnalysisResult, extra: string[] = []): { query: string; why: string }[] {
  const primary = analysis.objects[0]?.label ?? ''
  const allObjects = analysis.objects.map((o) => o.label).filter(Boolean)
  const task = analysis.title.replace(/^(how to|help me)\s+/i, '')
  const out: { query: string; why: string }[] = []

  const push = (query: string, why: string) => {
    const q = query.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (q.length > 6 && !out.some((o) => o.query.toLowerCase() === q.toLowerCase())) out.push({ query: q, why })
  }

  if (primary) push(`how to ${task} ${primary}`, `Demonstrates your exact task on the same kind of item.`)
  if (analysis.intent === 'cook') {
    push(`${analysis.recipes[0]?.name ?? task} recipe step by step`, 'Shows the technique for this dish end to end.')
    push(`${primary || allObjects.join(' ')} recipe easy`, 'A simpler take on the same ingredients.')
  } else if (analysis.intent === 'troubleshoot' || analysis.intent === 'fix') {
    push(`${primary} ${analysis.troubleshoot?.likelyCauses[0]?.cause ?? 'not working'} fix`, 'Targets the most likely cause.')
    push(`${primary} troubleshooting guide`, 'Covers the other causes worth ruling out.')
  } else if (analysis.intent === 'assemble') {
    push(`${primary || task} assembly instructions`, 'Follows the real assembly order.')
  } else if (analysis.intent === 'software') {
    push(`${analysis.software?.app ?? primary} ${task}`, 'Walks the same menus on screen.')
  } else {
    push(`${primary || task} tutorial beginners`, 'Assumes no prior experience.')
  }
  for (const e of extra) push(e, 'Suggested from your situation.')
  return out.slice(0, 4)
}

/** Ask YouTube for real videos when the user has supplied a Data API key. */
export async function searchYouTube(
  query: string,
  key: string,
  maxResults = 5,
): Promise<RawVideo[]> {
  const res = await fetch('/api/youtube', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, key, maxResults }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => null)
    throw new Error(j?.error?.message ?? `Video search failed (${res.status}).`)
  }
  const data = (await res.json()) as { videos: RawVideo[] }
  return data.videos ?? []
}

/** Score how well a video matches this specific task, 0..1. */
export function scoreVideo(video: RawVideo, analysis: AnalysisResult): number {
  const taskKeys = new Set([
    ...keywords(analysis.title),
    ...keywords(analysis.objects.map((o) => o.label).join(' ')),
    ...keywords(analysis.summary).slice(0, 12),
  ])
  const titleKeys = keywords(video.title)
  const descKeys = keywords(video.description ?? '').slice(0, 120)

  let titleHits = 0
  for (const k of titleKeys) if (taskKeys.has(k)) titleHits++
  let descHits = 0
  for (const k of descKeys) if (taskKeys.has(k)) descHits++

  const titleCoverage = titleKeys.length ? titleHits / Math.min(titleKeys.length, 10) : 0
  const descCoverage = Math.min(1, descHits / 10)
  const howto = HOWTO_SIGNALS.some((s) => video.title.toLowerCase().includes(s) || (video.description ?? '').toLowerCase().includes(s)) ? 0.16 : 0

  // Prefer videos that actually have chapters — they are far easier to use mid-task.
  const chapterBonus = parseChapters(video.description ?? '').length >= 3 ? 0.08 : 0

  const score = Math.min(1, titleCoverage * 0.55 + descCoverage * 0.21 + howto + chapterBonus)
  return Math.round(score * 100) / 100
}

/**
 * Pull real chapter markers out of a video description.
 * Only ever returns timestamps the uploader actually wrote.
 */
export function parseChapters(description: string): { t: string; label: string }[] {
  if (!description) return []
  const lines = description.split(/\r?\n/)
  const out: { t: string; label: string }[] = []
  const re = /^\s*[\[(]?\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[\])]?\s*[-–—:•]?\s*(.+?)\s*$/
  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    const [, h, mnt, sec, label] = m
    const clean = label.replace(/^[-–—:•\s]+/, '').trim()
    if (!clean || clean.length > 90) continue
    if (/^(https?:|www\.)/i.test(clean)) continue
    out.push({ t: h ? `${Number(h)}:${mnt.padStart(2, '0')}:${sec}` : `${Number(mnt)}:${sec}`, label: clean })
    if (out.length >= 14) break
  }
  // A single timestamp is usually just a link, not a chapter list.
  return out.length >= 2 ? out : []
}

export function durationText(iso?: string) {
  if (!iso) return ''
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return ''
  const [, h, mi, s] = m
  const parts = [h ? `${h}h` : '', mi ? `${mi}m` : '', !h && s ? `${s}s` : ''].filter(Boolean)
  return parts.join(' ')
}

export interface VideoPlan {
  videos: VideoRef[]
  /** why we returned searches rather than matched videos, if that is what happened */
  notice?: string
  queries: { query: string; why: string }[]
}

/**
 * Resolve the best available demonstrations for an analysis.
 * Degrades honestly: no API key never produces a fake video.
 */
export async function planVideos(args: {
  analysis: AnalysisResult
  youtubeKey?: string
}): Promise<VideoPlan> {
  const { analysis, youtubeKey } = args
  const queries = buildQueries(analysis, analysis.videos.map((v) => v.query).filter(Boolean))
  if (!queries.length) return { videos: [], queries: [] }

  // The model may already have proposed plausible videos — keep them only as
  // search targets, and only when we cannot verify the real thing.
  const modelSuggestions: VideoRef[] = analysis.videos ?? []

  if (!youtubeKey) {
    const fromModel = modelSuggestions.map((v) => ({
      ...v,
      // guarantee these are searches, never a fabricated watch link
      url: v.url?.includes('results?search_query')
        ? v.url
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(v.query || v.title)}`,
    }))
    const fromQueries: VideoRef[] = queries.map((q, i) => ({
      id: `q${i + 1}`,
      title: prettyQueryTitle(q.query),
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q.query)}`,
      why: q.why,
      query: q.query,
      matchScore: 0.5,
    }))
    const merged = dedupe([...fromQueries, ...fromModel])
    return {
      videos: merged.slice(0, 5),
      queries,
      notice:
        'These are search links built from what is on screen. Add a YouTube Data API key in Settings and I will match actual videos and pull their real chapter timestamps instead.',
    }
  }

  const results: RawVideo[] = []
  const errors: string[] = []
  await Promise.all(
    queries.slice(0, 3).map(async (q) => {
      try {
        results.push(...(await searchYouTube(q.query, youtubeKey, 5)))
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'search failed')
      }
    }),
  )

  if (!results.length) {
    const searchLinks: VideoRef[] = queries.map((q, i) => ({
      id: `q${i + 1}`,
      title: prettyQueryTitle(q.query),
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q.query)}`,
      why: q.why,
      query: q.query,
      matchScore: 0.5,
    }))
    return {
      videos: searchLinks,
      queries,
      notice: errors[0] ? `Video lookup failed: ${errors[0]}. Falling back to search links.` : undefined,
    }
  }

  const scored = results
    .map((v) => ({ v, score: scoreVideo(v, analysis) }))
    .sort((a, b) => b.score - a.score)

  const videos: VideoRef[] = []
  const seen = new Set<string>()
  for (const { v, score } of scored) {
    if (seen.has(v.id) || videos.length >= 4) continue
    seen.add(v.id)
    const chapters = parseChapters(v.description ?? '')
    videos.push({
      id: v.id,
      title: v.title,
      channel: v.channel,
      url: v.url,
      thumbnail: v.thumbnail,
      durationText: durationText(v.publishedAt),
      why: whyFor(score, analysis),
      query: queries.find((q) => v.title.toLowerCase().includes(keywords(q.query)[0] ?? ''))?.query ?? queries[0].query,
      matchScore: score,
      chapters: chapters.length ? chapters : undefined,
    })
  }

  return { videos, queries }
}

function whyFor(score: number, analysis: AnalysisResult) {
  const item = analysis.objects[0]?.label || 'what you showed me'
  if (score >= 0.5) return `Close match for ${item} — same kind of task, worth watching before you start.`
  if (score >= 0.3) return `Covers ${item} and the same sequence of steps.`
  return `Related demonstration — useful background, but not your exact model.`
}

function prettyQueryTitle(query: string) {
  const t = query.replace(/\bhow to\b/i, '').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function dedupe(list: VideoRef[]): VideoRef[] {
  const seen = new Set<string>()
  const out: VideoRef[] = []
  for (const v of list) {
    const key = v.query?.toLowerCase() || v.url
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

export function embedUrl(ref: VideoRef) {
  const id = ref.id.length === 11 && !ref.id.startsWith('q') ? ref.id : ref.url.match(/[?&]v=([\w-]{11})/)?.[1]
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null
}
