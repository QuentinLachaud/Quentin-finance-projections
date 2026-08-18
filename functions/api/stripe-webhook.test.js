import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyStripeEvent, onRequestPost } from './stripe-webhook.js'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' }

afterEach(() => vi.unstubAllGlobals())

describe('Stripe entitlement events', () => {
  it('grants Pro from a completed Checkout session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await applyStripeEvent(env, {
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_1', subscription: 'sub_1', metadata: { user_id: 'user-1' } } },
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ user_id: 'user-1', plan: 'pro', source: 'stripe', stripe_customer_id: 'cus_1' })
  })

  it('updates price, renewal date and access from subscription status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await applyStripeEvent(env, {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', metadata: { user_id: 'user-1' }, items: { data: [{ price: { id: 'price_annual' }, current_period_end: 1786900000 }] } } },
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.plan).toBe('free')
    expect(body.source).toBe('default')
    expect(body.stripe_price_id).toBe('price_annual')
    expect(body.current_period_end).toBe(new Date(1786900000 * 1000).toISOString())
  })

  it('ignores unrelated events and malformed subscription events safely', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await applyStripeEvent(env, { type: 'invoice.created', data: { object: {} } })).toBe(false)
    expect(await applyStripeEvent(env, { type: 'customer.subscription.updated', data: { object: { status: 'active' } } })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Stripe webhook boundary audit', () => {
  it('rejects a webhook with no valid signature before touching entitlement storage', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({
      request: new Request('https://app.test/api/stripe-webhook', { method: 'POST', body: '{}' }),
      env: { ...env, STRIPE_WEBHOOK_SECRET: 'whsec_test' },
    })
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
