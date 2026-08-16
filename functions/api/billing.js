import {
  adminRequest, authenticateUser, entitlementForUser, findUserByEmail, json, stripeRequest, updateEntitlement,
} from './_billing.js'

const handlerError = (error) => json({ error: error.message || 'Billing is temporarily unavailable.' }, error.status >= 400 && error.status < 600 ? error.status : 500)

export async function onRequestGet({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    return json(await entitlementForUser(env, user))
  } catch (error) {
    return handlerError(error)
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    const entitlement = await entitlementForUser(env, user)
    const input = await request.json().catch(() => ({}))
    const action = input.action
    const siteUrl = String(env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')

    if (action === 'checkout') {
      if (entitlement.isPro) return json({ error: 'This account already has Pro access.' }, 409)
      const interval = input.interval === 'annual' ? 'annual' : 'monthly'
      const priceId = interval === 'annual' ? env.STRIPE_ANNUAL_PRICE_ID : env.STRIPE_MONTHLY_PRICE_ID
      if (!priceId) return json({ error: 'This Pro price is not configured yet.' }, 503)
      let customerId = entitlement.stripeCustomerId
      if (!customerId) {
        const customer = await stripeRequest(env, 'customers', {
          email: user.email,
          'metadata[user_id]': user.id,
        })
        customerId = customer.id
        await updateEntitlement(env, user.id, { stripe_customer_id: customerId })
      }
      const session = await stripeRequest(env, 'checkout/sessions', {
        mode: 'subscription',
        customer: customerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': 1,
        success_url: `${siteUrl}/?billing=success`,
        cancel_url: `${siteUrl}/?billing=cancelled`,
        'metadata[user_id]': user.id,
        'subscription_data[metadata][user_id]': user.id,
        allow_promotion_codes: true,
      })
      return json({ url: session.url })
    }

    if (action === 'portal') {
      if (!entitlement.stripeCustomerId) return json({ error: 'No Stripe billing account exists for this user.' }, 409)
      const session = await stripeRequest(env, 'billing_portal/sessions', {
        customer: entitlement.stripeCustomerId,
        return_url: `${siteUrl}/`,
      })
      return json({ url: session.url })
    }

    if (action === 'admin-set-plan') {
      if (!entitlement.isAdmin) return json({ error: 'Owner access is required.' }, 403)
      const target = await findUserByEmail(env, input.email)
      if (!target) return json({ error: 'No existing account uses that email address.' }, 404)
      const plan = input.plan === 'pro' ? 'pro' : 'free'
      const existing = await adminRequest(env, `/rest/v1/account_entitlements?user_id=eq.${encodeURIComponent(target.id)}&select=*`)
      if (plan === 'free' && existing?.[0]?.source === 'stripe' && ['active', 'trialing', 'past_due'].includes(existing[0].subscription_status)) {
        return json({ error: 'This user has an active Stripe subscription. Cancel it through Stripe instead.' }, 409)
      }
      const rows = await adminRequest(env, '/rest/v1/account_entitlements?on_conflict=user_id', {
        method: 'POST',
        body: { user_id: target.id, plan, source: plan === 'pro' ? 'manual' : 'default', is_admin: existing?.[0]?.is_admin || false },
        headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      })
      return json({ email: target.email, plan: rows?.[0]?.plan || plan })
    }

    return json({ error: 'Unknown billing action.' }, 400)
  } catch (error) {
    return handlerError(error)
  }
}
