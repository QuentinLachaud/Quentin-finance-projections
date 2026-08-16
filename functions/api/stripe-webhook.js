import { adminRequest, json, subscriptionGrantsPro, verifyStripeSignature } from './_billing.js'

const upsertStripeEntitlement = (env, body) => adminRequest(env, '/rest/v1/account_entitlements?on_conflict=user_id', {
  method: 'POST', body, headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
})

export const applyStripeEvent = async (env, event) => {
  const object = event?.data?.object || {}
  if (event.type === 'checkout.session.completed') {
    const userId = object.metadata?.user_id || object.client_reference_id
    if (!userId) return false
    await upsertStripeEntitlement(env, {
      user_id: userId,
      plan: 'pro',
      source: 'stripe',
      stripe_customer_id: object.customer,
      stripe_subscription_id: object.subscription,
      subscription_status: 'active',
    })
    return true
  }

  if (event.type?.startsWith('customer.subscription.')) {
    const userId = object.metadata?.user_id
    if (!userId) return false
    const grantsPro = subscriptionGrantsPro(object.status)
    await upsertStripeEntitlement(env, {
      user_id: userId,
      plan: grantsPro ? 'pro' : 'free',
      source: grantsPro ? 'stripe' : 'default',
      stripe_customer_id: object.customer,
      stripe_subscription_id: object.id,
      stripe_price_id: object.items?.data?.[0]?.price?.id || null,
      subscription_status: object.status,
      current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null,
    })
    return true
  }
  return false
}

export async function onRequestPost({ request, env }) {
  const payload = await request.text()
  const valid = await verifyStripeSignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET)
  if (!valid) return json({ error: 'Invalid Stripe signature.' }, 400)
  try {
    const event = JSON.parse(payload)
    await applyStripeEvent(env, event)
    return json({ received: true })
  } catch (error) {
    return json({ error: error.message || 'Stripe webhook failed.' }, 500)
  }
}
