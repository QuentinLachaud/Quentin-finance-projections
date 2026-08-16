import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscriptionGrantsPro, verifyStripeSignature } from './_billing.js'

const sign = async (payload, secret, timestamp) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

afterEach(() => vi.restoreAllMocks())

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
