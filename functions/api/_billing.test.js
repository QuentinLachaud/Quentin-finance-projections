import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminRequest, authenticateUser, json, stripeRequest, subscriptionGrantsPro, verifyStripeSignature } from './_billing.js'

const sign = async (payload, secret, timestamp) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Stripe webhook verification', () => {
  it('accepts a current matching HMAC and rejects tampering or replayed events', async () => {
    const now = Date.UTC(2026, 7, 16, 12)
    const timestamp = Math.floor(now / 1000)
    const payload = '{"id":"evt_test"}'
    const signature = await sign(payload, 'whsec_test', timestamp)

    expect(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, 'whsec_test', now)).toBe(true)
    expect(await verifyStripeSignature(`${payload}x`, `t=${timestamp},v1=${signature}`, 'whsec_test', now)).toBe(false)
    expect(await verifyStripeSignature(payload, `t=${timestamp - 301},v1=${signature}`, 'whsec_test', now)).toBe(false)
  })

  it('keeps access during Stripe retry states but removes it after cancellation', () => {
    expect(subscriptionGrantsPro('active')).toBe(true)
    expect(subscriptionGrantsPro('trialing')).toBe(true)
    expect(subscriptionGrantsPro('past_due')).toBe(true)
    expect(subscriptionGrantsPro('canceled')).toBe(false)
    expect(subscriptionGrantsPro('unpaid')).toBe(false)
  })
})

describe('billing transport security audit', () => {
  it('marks private JSON responses no-store', async () => {
    const response = json({ ok: true })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ ok: true })
  })

  it('does not call Supabase auth without a valid Bearer header', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = await authenticateUser(new Request('https://app.test/api/billing'), {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable',
    })
    expect(user).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses sb_secret service keys as apikey only, never as a Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await adminRequest({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_example',
    }, '/rest/v1/account_entitlements?select=*')
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.apikey).toBe('sb_secret_example')
    expect(headers.authorization).toBeUndefined()
  })

  it('keeps legacy service-role compatibility with an Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await adminRequest({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-key',
    }, '/rest/v1/account_entitlements?select=*')
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.apikey).toBe('legacy-service-key')
    expect(headers.authorization).toBe('Bearer legacy-service-key')
  })

  it('fails closed before network access when billing storage is not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(adminRequest({}, '/rest/v1/account_entitlements')).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed before network access when Stripe is not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(stripeRequest({}, 'customers', { email: 'a@example.com' })).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
