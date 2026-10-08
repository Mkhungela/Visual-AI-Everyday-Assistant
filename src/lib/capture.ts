/**
 * Camera, microphone and file capture.
 *
 * Everything has a graceful fallback: live getUserMedia where the browser allows it,
 * a hidden `<input capture>` otherwise — which on Android/iOS opens the native camera
 * app, so a user can always take a photo even on a locked-down browser.
 */

import { fileToImage, isImageFile, videoFrames } from './images'
import type { Attachment } from './store'
import { uid } from './utils'
import { thumbnail } from './images'

export interface CaptureResult {
  attachments: Attachment[]
  /** set when a video was supplied, so the UI can explain that frames were extracted */
  note?: string
}

export async function attachmentFromFile(
  file: File,
  kind: Attachment['kind'] = 'photo',
  label = 'photo',
): Promise<Attachment> {
  const img = await fileToImage(file)
  const thumb = await thumbnail(img.dataUrl)
  return {
    id: uid('att'),
    dataUrl: img.dataUrl,
    thumb,
    label,
    kind,
    bytes: img.bytes,
  }
}

export async function attachmentFromDataUrl(
  dataUrl: string,
  kind: Attachment['kind'] = 'photo',
  label = 'photo',
): Promise<Attachment> {
  const thumb = await thumbnail(dataUrl)
  return {
    id: uid('att'),
    dataUrl,
    thumb,
    label,
    kind,
    bytes: Math.round((dataUrl.length * 3) / 4),
  }
}

/** Handle whatever the user dropped/selected — photos, screenshots, PDFs-as-images, videos. */
export async function attachmentsFromFiles(files: File[], opts: { multiple?: boolean } = {}): Promise<CaptureResult> {
  const list = Array.from(files)
  const images = list.filter(isImageFile)
  const videos = list.filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(f.name))

  const out: Attachment[] = []
  const notes: string[] = []

  for (let i = 0; i < images.length; i++) {
    const kind: Attachment['kind'] = opts.multiple && images.length > 2 ? 'ingredient' : 'photo'
    out.push(await attachmentFromFile(images[i], kind, i === 0 ? 'photo' : `photo ${i + 1}`))
  }

  for (const v of videos) {
    try {
      const frames = await videoFrames(v, 3)
      for (let i = 0; i < frames.length; i++) {
        out.push(await attachmentFromDataUrl(frames[i], 'frame', `video frame ${i + 1} of ${frames.length}`))
      }
      notes.push(`I took ${frames.length} stills from “${v.name}” — video understanding works from key frames.`)
    } catch (err) {
      notes.push(err instanceof Error ? err.message : `Could not read ${v.name}.`)
    }
  }

  if (!out.length) {
    notes.push(
      images.length || videos.length
        ? 'That file could not be read.'
        : 'I can look at photos, screenshots and short videos.',
    )
  }

  return { attachments: out, note: notes.join(' ') || undefined }
}

/* -------------------------------------------------------------- live camera */

export interface CameraHandle {
  stream: MediaStream
  stop: () => void
}

export async function startCamera(facing: 'environment' | 'user' = 'environment'): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'This browser will not give the page live camera access. Use the photo button — it opens your normal camera app instead.',
    )
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  })
  return {
    stream,
    stop: () => stream.getTracks().forEach((t) => t.stop()),
  }
}

/** Pull a still off a running <video> element. */
export async function grabFrame(video: HTMLVideoElement): Promise<Attachment> {
  const w = video.videoWidth || 1280
  const h = video.videoHeight || 720
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  const img = await fileToImage(dataUrlToBlob(dataUrl))
  const thumb = await thumbnail(img.dataUrl)
  return { id: uid('cam'), dataUrl: img.dataUrl, thumb, label: 'camera', kind: 'photo', bytes: img.bytes }
}

function dataUrlToBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/* -------------------------------------------------------------- screen grab */

/** Real screen capture where the browser allows it — otherwise the user uploads a screenshot. */
export async function captureScreen(): Promise<Attachment> {
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>
  }
  if (!md?.getDisplayMedia) {
    throw new Error('Screen capture needs a desktop browser. On a phone, take a screenshot and upload it.')
  }
  const stream = await md.getDisplayMedia({ video: { frameRate: 5 }, audio: false })
  try {
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play()
    await new Promise((r) => setTimeout(r, 450))
    const attachment = await grabFrame(video)
    return { ...attachment, kind: 'screenshot', label: 'screenshot' }
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}

/* -------------------------------------------------------------- recorder */

export interface RecorderHandle {
  stop: () => Promise<{ blob: Blob; seconds: number }>
  cancel: () => void
  seconds: () => number
}

export async function startRecording(kind: 'audio' | 'video'): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia(
    kind === 'audio' ? { audio: true } : { video: { facingMode: { ideal: 'environment' } }, audio: true },
  )
  const mime = pickMime(kind)
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  const startedAt = Date.now()
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.start(250)
  let cancelled = false

  const cleanup = () => stream.getTracks().forEach((t) => t.stop())

  return {
    seconds: () => Math.round((Date.now() - startedAt) / 1000),
    cancel: () => {
      cancelled = true
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
      cleanup()
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          cleanup()
          const type = recorder.mimeType || 'audio/webm'
          resolve({ blob: new Blob(chunks, { type }), seconds: Math.round((Date.now() - startedAt) / 1000) })
        }
        try {
          recorder.stop()
        } catch {
          cleanup()
          resolve({ blob: new Blob(chunks, { type: 'audio/webm' }), seconds: Math.round((Date.now() - startedAt) / 1000) })
        }
        if (cancelled) cleanup()
      }),
  }
}

function pickMime(kind: 'audio' | 'video') {
  const candidates =
    kind === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? ''
}

/** Audio → text via the provider's transcription endpoint when a key exists. */
export async function transcribeAudio(blob: Blob, opts: { provider: string; apiKey: string; baseUrl?: string }): Promise<string> {
  const { provider, apiKey } = opts
  if (!apiKey) throw new Error('Dictation through the model needs an API key.')
  const base =
    provider === 'openai'
      ? 'https://api.openai.com/v1'
      : provider === 'groq'
        ? 'https://api.groq.com/openai/v1'
        : opts.baseUrl
  if (!base) throw new Error('This provider cannot transcribe audio. Use the browser microphone instead.')

  const form = new FormData()
  form.append('file', blob, 'recording.webm')
  form.append('model', provider === 'groq' ? 'whisper-large-v3-turbo' : 'whisper-1')
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Transcription failed (${res.status}).`)
  const data = await res.json()
  return String(data?.text ?? '').trim()
}

/** Send audio straight to a model that accepts it (Gemini), for tone/immediacy. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result)
      resolve(s.slice(s.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Could not read the recording.'))
    reader.readAsDataURL(blob)
  })
}

export { splitDataUrl } from './images'
