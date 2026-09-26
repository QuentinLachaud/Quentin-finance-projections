import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './luna-transcribe.js'

const OPENAI_KEY = 'openai-key-never-return'

const env = (overrides = {}) => ({
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'public-key',
  OPENAI_API_KEY: OPENAI_KEY,
  ...overrides,
})

const requestWithAudio = (file = new File(['voice-bytes'], 'voice.webm', { type: 'audio/webm' })) => {
  const form = new FormData()
  form.append('audio', file)
  return new Request('https://preview.example.test/api/luna-transcribe', {
    method: 'POST',
    headers: { authorization: 'Bearer session-token' },
    body: form,
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('Luna speech transcription endpoint', () => {
  it('authenticates the user and forwards the recording to the OpenAI transcription API', async () => {
    let upstreamBody
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const href = String(url)
      if (href.endsWith('/auth/v1/user')) {
        expect(options.headers.authorization).toBe('Bearer session-token')
        return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      }
      if (href.endsWith('/audio/transcriptions')) {
        expect(options.headers.authorization).toBe(`Bearer ${OPENAI_KEY}`)
        expect(options.headers['content-type']).toBeUndefined()
        upstreamBody = options.body
        return new Response(JSON.stringify({ text: 'What is the rent for BTL1?' }), { status: 200 })
      }
      throw new Error(`Unexpected request: ${href}`)
    }))

    const response = await onRequestPost({ request: requestWithAudio(), env: env() })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: 'What is the rent for BTL1?' })
    expect(upstreamBody).toBeInstanceOf(FormData)
    expect(upstreamBody.get('model')).toBe('gpt-transcribe')
    expect(upstreamBody.get('response_format')).toBe('json')
    expect(upstreamBody.get('file')).toBeInstanceOf(File)
  })

  it('rejects unauthenticated, empty, oversized and unsupported recordings before calling OpenAI', async () => {
    const fetchMock = vi.fn(async (url) => {
      const href = String(url)
      if (href.endsWith('/auth/v1/user')) return new Response('{}', { status: 401 })
      throw new Error(`Unexpected request: ${href}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const unauthenticated = await onRequestPost({ request: requestWithAudio(), env: env() })
    expect(unauthenticated.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      throw new Error(`OpenAI should not be called: ${url}`)
    }))
    const empty = await onRequestPost({ request: requestWithAudio(new File([], 'empty.webm', { type: 'audio/webm' })), env: env() })
    expect(empty.status).toBe(400)
    const unsupported = await onRequestPost({ request: requestWithAudio(new File(['x'], 'voice.bin', { type: 'application/octet-stream' })), env: env() })
    expect(unsupported.status).toBe(415)
  })

  it('uses the configurable transcription model and never returns upstream secret text', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const href = String(url)
      if (href.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      if (href.endsWith('/audio/transcriptions')) {
        expect(options.body.get('model')).toBe('gpt-transcribe-custom')
        return new Response(JSON.stringify({ error: { message: `bad ${OPENAI_KEY}` } }), { status: 500 })
      }
      throw new Error(`Unexpected request: ${href}`)
    }))

    const response = await onRequestPost({
      request: requestWithAudio(),
      env: env({ OPENAI_TRANSCRIBE_MODEL: 'gpt-transcribe-custom' }),
    })
    const serialized = await response.text()
    expect(response.status).toBe(502)
    expect(serialized).not.toContain(OPENAI_KEY)
    expect(JSON.parse(serialized)).toEqual({ error: 'Voice transcription failed.', code: 'transcription_upstream_failure' })
  })
})
