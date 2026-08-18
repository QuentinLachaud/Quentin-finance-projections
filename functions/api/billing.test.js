import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet, onRequestPost } from './billing.js'

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'public-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  OWNER_EMAIL: 'owner@example.com',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_MONTHLY_PRICE_ID: 'price_monthly',
  STRIPE_ANNUAL_PRICE_ID: 'price_annual',
  PUBLIC_SITE_URL: 'https://btlportfolio.co.uk',
}

const request = (body) => new Request('https://btlportfolio.co.uk/api/billing', {
  method: body ? 'POST' : 'GET',
  headers: { authorization: 'Bearer user-token', ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
})

afterEach(() => vi.unstubAllGlobals())

describe('billing API', () => {
  it('rejects unauthenticated requests before accessing private billing data', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: new Request('https://btlportfolio.co.uk/api/billing'), env })
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('upgrades only the configured owner to owner and admin access', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'owner-id', email: 'owner@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'owner-id', plan: 'pro', source: 'owner', is_admin: true }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: request(), env })
    expect(await response.json()).toMatchObject({ plan: 'pro', isPro: true, isOwner: true, isAdmin: true })
  })

  it('creates annual Checkout with the exact configured price and safe return URLs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1', email: 'person@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'user-1', plan: 'free', source: 'default', is_admin: false, stripe_customer_id: 'cus_1' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/test' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({ request: request({ action: 'checkout', interval: 'annual' }), env })
    const stripeBody = fetchMock.mock.calls[2][1].body
    expect(response.status).toBe(200)
    expect(stripeBody.get('line_items[0][price]')).toBe('price_annual')
    expect(stripeBody.get('success_url')).toBe('https://btlportfolio.co.uk/?billing=success')
    expect(stripeBody.get('subscription_data[metadata][user_id]')).toBe('user-1')
  })

  it('prevents ordinary users from manually granting Pro', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1', email: 'person@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'user-1', plan: 'free', source: 'default', is_admin: false }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({ request: request({ action: 'admin-set-plan', email: 'friend@example.com', plan: 'pro' }), env })
    expect(response.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('billing endpoint edge-case audit', () => {
  it('prevents an already-Pro account from creating a duplicate Checkout session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1', email: 'pro@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'user-1', plan: 'pro', source: 'manual', is_admin: false }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({ request: request({ action: 'checkout', interval: 'monthly' }), env })
    expect(response.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not open a billing portal for an account with no Stripe customer', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1', email: 'person@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'user-1', plan: 'free', source: 'default', is_admin: false }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({ request: request({ action: 'portal' }), env })
    expect(response.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects unknown billing actions after authentication', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1', email: 'person@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'user-1', plan: 'free', source: 'default', is_admin: false }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({ request: request({ action: 'surprise-action' }), env })
    expect(response.status).toBe(400)
  })

  it('refuses to manually downgrade a user who still has an active Stripe subscription', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'admin-1', email: 'admin@example.com' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'admin-1', plan: 'pro', source: 'manual', is_admin: true }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [{ id: 'target-1', email: 'paid@example.com' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: 'target-1', source: 'stripe', subscription_status: 'active' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({
      request: request({ action: 'admin-set-plan', email: 'paid@example.com', plan: 'free' }),
      env,
    })
    expect(response.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
