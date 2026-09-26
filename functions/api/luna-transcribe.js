const OPENAI_ROOT = 'https://api.openai.com/v1'
const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-transcribe'
const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
])

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
})

const supabaseConfiguration = (env) => ({
  url: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  key: env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

const authenticateUser = async (request, env) => {
  const authorization = request.headers.get('authorization')
  const { url, key } = supabaseConfiguration(env)
  if (!authorization?.startsWith('Bearer ') || !url || !key) return null
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization },
  })
  if (!response.ok) return null
  return response.json().catch(() => null)
}

const audioType = (file) => String(file?.type || '').split(';', 1)[0].trim().toLowerCase()

const transcriptionFailure = (status) => {
  if (status === 429) return json({ error: 'Voice transcription is temporarily rate limited.', code: 'transcription_rate_limited' }, 429)
  if (status === 401 || status === 403) return json({ error: 'Voice transcription is not configured correctly.', code: 'transcription_authentication_failure' }, 502)
  return json({ error: 'Voice transcription failed.', code: 'transcription_upstream_failure' }, 502)
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    if (!env.OPENAI_API_KEY) return json({ error: 'Voice transcription is not configured yet.', code: 'not_configured' }, 503)

    const declaredLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES + 1_000_000) {
      return json({ error: 'Voice recording is too large.' }, 413)
    }

    const form = await request.formData().catch(() => null)
    const audio = form?.get('audio')
    if (!audio || typeof audio.size !== 'number' || typeof audio.arrayBuffer !== 'function') {
      return json({ error: 'No voice recording was provided.' }, 400)
    }
    if (audio.size <= 0) return json({ error: 'The voice recording was empty.' }, 400)
    if (audio.size > MAX_AUDIO_BYTES) return json({ error: 'Voice recording is too large.' }, 413)

    const type = audioType(audio)
    if (type && !ALLOWED_AUDIO_TYPES.has(type)) return json({ error: 'Unsupported voice recording format.' }, 415)

    const upstream = new FormData()
    const extension = type === 'audio/mp4'
      ? 'mp4'
      : type === 'audio/mpeg'
        ? 'mp3'
        : type === 'audio/ogg'
          ? 'ogg'
          : type === 'audio/wav' || type === 'audio/x-wav'
            ? 'wav'
            : 'webm'
    upstream.append('file', audio, `luna-voice.${extension}`)
    upstream.append('model', env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIPTION_MODEL)
    upstream.append('response_format', 'json')

    const root = String(env.OPENAI_BASE_URL || OPENAI_ROOT).replace(/\/$/, '')
    let response
    try {
      response = await fetch(`${root}/audio/transcriptions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: upstream,
      })
    } catch {
      return json({ error: 'Voice transcription is temporarily unavailable.', code: 'transcription_network_failure' }, 503)
    }

    if (!response.ok) return transcriptionFailure(response.status)
    const result = await response.json().catch(() => null)
    const text = String(result?.text || '').trim()
    if (!text) return json({ error: 'No speech was detected.' }, 422)
    return json({ text })
  } catch {
    return json({ error: 'Voice transcription failed.' }, 500)
  }
}
