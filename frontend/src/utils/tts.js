const cache   = new Map()   // text → audio_url (completed)
const inflight = new Map()  // text → Promise    (in-flight dedup)
let _current = null

async function _fetch(text) {
  if (cache.has(text))    return cache.get(text)
  if (inflight.has(text)) return inflight.get(text)   // share in-flight request

  const p = (async () => {
    const form = new FormData()
    form.append('text', text)
    const res = await fetch('/tts', { method: 'POST', body: form })
    const { audio_url } = await res.json()
    cache.set(text, audio_url)
    inflight.delete(text)
    return audio_url
  })()

  inflight.set(text, p)
  return p
}

/** Play TTS. Pass an AbortSignal to cancel before playback starts. */
export async function speak(text, signal) {
  if (_current) { _current.pause(); _current = null }
  try {
    const url = await _fetch(text)
    if (signal?.aborted) return
    if (_current) { _current.pause(); _current = null }
    _current = new Audio(url)
    _current.play()
  } catch (e) {
    console.error('[tts]', e)
  }
}

/**
 * Pre-fetch TTS in the background.
 * Returns a Promise — await it to know when the audio is ready.
 */
export function preload(text) {
  return _fetch(text).catch(() => {})
}

/** Stop any currently playing TTS audio. */
export function stop() {
  if (_current) { _current.pause(); _current = null }
}
