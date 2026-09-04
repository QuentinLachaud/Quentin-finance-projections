import { adminRequest, authenticateUser, json } from './_billing.js'

const validPart = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max
const validSubscription = (body) => {
  try {
    const url = new URL(body?.endpoint)
    return url.protocol === 'https:'
      && validPart(body.endpoint, 4096)
      && validPart(body?.keys?.p256dh, 1024)
      && validPart(body?.keys?.auth, 512)
  } catch {
    return false
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    const body = await request.json().catch(() => null)
    if (!validSubscription(body)) return json({ error: 'Invalid push subscription.' }, 400)
    await adminRequest(env, '/rest/v1/push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        updated_at: new Date().toISOString(),
      },
    })
    return json({ ok: true })
  } catch (error) {
    return json({ error: error.message || 'Push subscription could not be saved.' }, error.status >= 400 && error.status < 600 ? error.status : 502)
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    const body = await request.json().catch(() => null)
    if (!validPart(body?.endpoint, 4096)) return json({ error: 'A push endpoint is required.' }, 400)
    await adminRequest(env, `/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&endpoint=eq.${encodeURIComponent(body.endpoint)}`, { method: 'DELETE' })
    return json({ ok: true })
  } catch (error) {
    return json({ error: error.message || 'Push subscription could not be removed.' }, error.status >= 400 && error.status < 600 ? error.status : 502)
  }
}
