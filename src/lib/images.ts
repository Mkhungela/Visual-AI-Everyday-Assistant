/**
 * Image handling.
 *
 * Phone cameras produce 4–12 MB JPEGs. Sending those to a vision model is slow,
 * expensive and often rejected, so everything is downscaled and re-encoded before
 * it ever leaves the device.
 */

export interface LoadedImage {
  dataUrl: string
  width: number
  height: number
  bytes: number
}

export const MAX_EDGE = 1280
export const THUMB_EDGE = 420
export const SEND_QUALITY = 0.82

/** Decode a File/Blob into a data URL, honouring EXIF orientation via createImageBitmap. */
export async function fileToImage(file: File | Blob, maxEdge = MAX_EDGE, quality = SEND_QUALITY): Promise<LoadedImage> {
  const bitmap = await decode(file)
  const { width, height } = fit(bitmap.width, bitmap.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)
  if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
    ;(bitmap as ImageBitmap).close()
  }
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl, width, height, bytes: Math.round((dataUrl.length * 3) / 4) }
}

async function decode(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap applies EXIF rotation for us, which matters for phone photos.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* some browsers reject the option bag — fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await loadImage(url)
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file could not be read as an image.'))
    img.src = src
  })
}

function fit(w: number, h: number, maxEdge: number) {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h }
  const scale = maxEdge / Math.max(w, h)
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/** Re-encode an existing data URL at a smaller size. */
export async function downscale(dataUrl: string, maxEdge = MAX_EDGE, quality = SEND_QUALITY): Promise<LoadedImage> {
  const img = await loadImage(dataUrl)
  const { width, height } = fit(img.naturalWidth, img.naturalHeight, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  const out = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl: out, width, height, bytes: Math.round((out.length * 3) / 4) }
}

/** Small preview used in cards and saved lists. */
export function thumbnail(dataUrl: string, maxEdge = THUMB_EDGE): Promise<string> {
  return downscale(dataUrl, maxEdge, 0.62).then((r) => r.dataUrl)
}

/** Split a data URL into the pieces every provider API wants. */
export function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.*)$/s)
  if (!m) return { mimeType: 'image/jpeg', data: dataUrl.replace(/^data:[^,]*,/, '') }
  return { mimeType: m[1] || 'image/jpeg', data: m[2] }
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name)
}

/** Grab frames from a video file so a single clip can be reasoned about. */
export async function videoFrames(file: File, count = 3, maxEdge = 900): Promise<string[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('That video could not be read.'))
      setTimeout(() => reject(new Error('Timed out reading that video.')), 15000)
    })

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const out: string[] = []

    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 0.5)) / count
      video.currentTime = Math.min(t, Math.max(0, duration - 0.05))
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        video.onseeked = done
        setTimeout(done, 3000)
      })
      const { width, height } = fit(video.videoWidth || 640, video.videoHeight || 480, maxEdge)
      canvas.width = width
      canvas.height = height
      ctx.drawImage(video, 0, 0, width, height)
      out.push(canvas.toDataURL('image/jpeg', 0.8))
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Average colour of an image region — used to give the demo engine something real to look at. */
export async function imageStats(dataUrl: string) {
  const img = await loadImage(dataUrl)
  const w = 64
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  let r = 0
  let g = 0
  let b = 0
  let luminance = 0
  let variance = 0
  const n = w * h
  for (let i = 0; i < n; i++) {
    const rr = data[i * 4]
    const gg = data[i * 4 + 1]
    const bb = data[i * 4 + 2]
    r += rr
    g += gg
    b += bb
    const l = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb
    luminance += l
    variance += l * l
  }
  r /= n
  g /= n
  b /= n
  luminance /= n
  variance = variance / n - luminance * luminance
  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    luminance: Math.round(luminance),
    contrast: Math.round(Math.sqrt(Math.max(0, variance))),
    aspect: img.naturalWidth / img.naturalHeight,
    bright: luminance > 150,
    dark: luminance < 55,
  }
}
