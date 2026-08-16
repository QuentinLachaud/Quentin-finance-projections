export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
})

const supabaseConfig = (env) => ({
  url: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  publicKey: env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
  serviceKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
})

export const authenticateUser = async (request, env) => {
  const authorization = request.headers.get('authorization')
  const { url, publicKey } = supabaseConfig(env)
  if (!authorization?.startsWith('Bearer ') || !url || !publicKey) return null
  const response = await fetch(`${url}/auth/v1/user`, { headers: { authorization, apikey: publicKey } })
  return response.ok ? response.json() : null
}

export const adminRequest = async (env, path, { method = 'GET', body, headers = {} } = {}) => {
  const { url, serviceKey } = supabaseConfig(env)
  if (!url || !serviceKey) throw Object.assign(new Error('Billing storage is not configured.'), { status: 503 })
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(serviceKey.startsWith('sb_secret_')
        ? {}
        : { authorization: `Bearer ${serviceKey}` }),
      apikey: serviceKey,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    throw Object.assign(new Error(detail.message || detail.error_description || 'Billing storage request failed.'), { status: response.status })
  }
  if (response.status === 204) return null
  return response.json().catch(() => null)
}

export const entitlementForUser = async (env, user) => {
  const ownerEmail = String(env.OWNER_EMAIL || '').trim().toLowerCase()
  const isOwner = Boolean(ownerEmail && user.email?.toLowerCase() === ownerEmail)
  const rows = await adminRequest(env, `/rest/v1/account_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=*`)
  let record = rows?.[0]
  if (!record || (isOwner && (!record.is_admin || record.plan !== 'pro' || record.source !== 'owner'))) {
    const desired = {
      user_id: user.id,
      plan: isOwner ? 'pro' : record?.plan || 'free',
      source: isOwner ? 'owner' : record?.source || 'default',
      is_admin: isOwner || Boolean(record?.is_admin),
    }
    const updated = await adminRequest(env, '/rest/v1/account_entitlements?on_conflict=user_id', {
      method: 'POST',
      body: desired,
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    })
    record = updated?.[0] || { ...record, ...desired }
  }
  return {
    plan: isOwner ? 'pro' : record.plan,
    isPro: isOwner || record.plan === 'pro',
    isOwner,
    isAdmin: isOwner || Boolean(record.is_admin),
    source: isOwner ? 'owner' : record.source,
    subscriptionStatus: record.subscription_status,
    currentPeriodEnd: record.current_period_end,
    hasBillingAccount: Boolean(record.stripe_customer_id),
    stripeCustomerId: record.stripe_customer_id,
  }
}

export const updateEntitlement = (env, userId, values) => adminRequest(
  env,
  `/rest/v1/account_entitlements?user_id=eq.${encodeURIComponent(userId)}`,
  { method: 'PATCH', body: values, headers: { prefer: 'return=representation' } },
)

export const findUserByEmail = async (env, email) => {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null
  const response = await adminRequest(env, '/auth/v1/admin/users?per_page=1000')
  return response?.users?.find((user) => user.email?.toLowerCase() === normalized) || null
}

export const stripeRequest = async (env, path, values) => {
  if (!env.STRIPE_SECRET_KEY) throw Object.assign(new Error('Stripe is not configured yet.'), { status: 503 })
  const body = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value))
  })
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || 'Stripe could not complete this request.'), { status: response.status })
  return payload
}

const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
const safeEqual = (left, right) => {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return mismatch === 0
}

export const verifyStripeSignature = async (payload, header, secret, now = Date.now()) => {
  if (!payload || !header || !secret) return false
  const parts = header.split(',').map((part) => part.split('='))
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!timestamp || !signatures.length || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  return signatures.some((signature) => safeEqual(signature, digest))
}

export const subscriptionGrantsPro = (status) => ['active', 'trialing', 'past_due'].includes(status)
