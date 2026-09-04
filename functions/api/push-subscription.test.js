import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestDelete, onRequestPost } from './push-subscription.js'

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'public-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
}

const request = (method, body, authorised = true) => new Request('https://app.example/api/push-subscription', {
  method,
  headers: { 'content-type': 'application/json', ...(authorised ? { authorization: 'Bearer token' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
})

afterEach(() => vi.unstubAllGlobals())

describe('push subscription API', () => {
  it('rejects unauthenticated calls without touching storage', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({ request: request('POST', {}, false), env })
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-https or incomplete subscriptions after auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1' }), { status: 200 })))
    const response = await onRequestPost({ request: request('POST', { endpoint: 'http://bad.test', keys: {} }), env })
    expect(response.status).toBe(400)
  })

  it('stores an authenticated subscription without returning capability data', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({ request: request('POST', { endpoint: 'https://push.example/subscription-secret', keys: { p256dh: 'public-key-material', auth: 'auth-material' } }), env })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(fetchMock.mock.calls[1][0]).toContain('/rest/v1/push_subscriptions?on_conflict=endpoint')
  })

  it('removes only the signed-in users matching endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestDelete({ request: request('DELETE', { endpoint: 'https://push.example/device' }), env })
    expect(response.status).toBe(200)
    expect(fetchMock.mock.calls[1][0]).toContain('user_id=eq.u1')
    expect(fetchMock.mock.calls[1][0]).toContain('endpoint=eq.https%3A%2F%2Fpush.example%2Fdevice')
  })
})
