export const PLAN_PRICES = Object.freeze({
  monthly: { amount: 9.99, label: '£9.99 monthly' },
  annual: { amount: 69, label: '£69 annually' },
})

export const FREE_PROPERTY_LIMIT = 1

export const normalizeEntitlement = (value = {}) => {
  const plan = value.plan === 'pro' ? 'pro' : 'free'
  const isOwner = Boolean(value.isOwner ?? value.is_owner)
  const isAdmin = Boolean(value.isAdmin ?? value.is_admin ?? isOwner)
  return {
    plan: isOwner ? 'pro' : plan,
    isPro: isOwner || plan === 'pro',
    isOwner,
    isAdmin,
    source: value.source || 'default',
    subscriptionStatus: value.subscriptionStatus ?? value.subscription_status ?? null,
    currentPeriodEnd: value.currentPeriodEnd ?? value.current_period_end ?? null,
    hasBillingAccount: Boolean(value.hasBillingAccount ?? value.stripe_customer_id),
  }
}

export const canAddProperty = (entitlement, propertyCount) => (
  normalizeEntitlement(entitlement).isPro || Number(propertyCount) < FREE_PROPERTY_LIMIT
)

export const showFreeSupport = (entitlement) => !normalizeEntitlement(entitlement).isPro
