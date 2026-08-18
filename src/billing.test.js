import { describe, expect, it } from 'vitest'
import { canAddProperty, FREE_PROPERTY_LIMIT, normalizeEntitlement, PLAN_PRICES, showFreeSupport } from './billing.js'

describe('account entitlements', () => {
  it('handles a null entitlement safely while billing is still loading', () => {
    expect(normalizeEntitlement(null)).toMatchObject({ plan: 'free', isPro: false, isOwner: false, isAdmin: false })
    expect(canAddProperty(null, 0)).toBe(true)
    expect(canAddProperty(null, 1)).toBe(false)
    expect(showFreeSupport(null)).toBe(true)
  })

  it('limits free accounts to one BTL without hiding their real portfolio', () => {
    expect(FREE_PROPERTY_LIMIT).toBe(1)
    expect(canAddProperty({ plan: 'free' }, 0)).toBe(true)
    expect(canAddProperty({ plan: 'free' }, 1)).toBe(false)
    expect(canAddProperty({ plan: 'free' }, 4)).toBe(false)
  })

  it('allows Pro and owner accounts to add any number of BTLs', () => {
    expect(canAddProperty({ plan: 'pro' }, 99)).toBe(true)
    expect(canAddProperty({ plan: 'free', isOwner: true }, 99)).toBe(true)
    expect(normalizeEntitlement({ plan: 'free', is_owner: true }).isAdmin).toBe(true)
  })

  it('shows voluntary support only to free accounts and preserves the advertised prices', () => {
    expect(showFreeSupport({ plan: 'free' })).toBe(true)
    expect(showFreeSupport({ plan: 'pro' })).toBe(false)
    expect(PLAN_PRICES.monthly.amount).toBe(9.99)
    expect(PLAN_PRICES.annual.amount).toBe(79)
  })
})

describe('entitlement normalization audit', () => {
  it('normalizes snake_case server fields without accidentally dropping access', () => {
    expect(normalizeEntitlement({
      plan: 'pro',
      is_admin: true,
      subscription_status: 'active',
      current_period_end: '2027-01-01T00:00:00Z',
      stripe_customer_id: 'cus_1',
    })).toMatchObject({
      isPro: true,
      isAdmin: true,
      subscriptionStatus: 'active',
      currentPeriodEnd: '2027-01-01T00:00:00Z',
      hasBillingAccount: true,
    })
  })

  it('fails closed for unknown plan values and invalid property counts', () => {
    expect(normalizeEntitlement({ plan: 'enterprise' }).isPro).toBe(false)
    expect(canAddProperty({ plan: 'free' }, undefined)).toBe(false)
    expect(canAddProperty({ plan: 'free' }, Number.NaN)).toBe(false)
  })
})
