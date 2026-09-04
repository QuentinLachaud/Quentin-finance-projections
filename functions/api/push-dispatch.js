import { sendPushBatch, topicFromString } from '@mmmike/web-push/send'
import { actionableNotifications, notificationCycleKey, normalizeNotificationPreferences, pushPayloadForNotification } from '../../src/notifications.js'
import { adminRequest, json } from './_billing.js'

const safeEqual = (left = '', right = '') => {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return mismatch === 0
}

export const londonHour = (now = new Date()) => Number(new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London',
}).format(now))

export const dispatchCandidates = ({ portfolioRows = [], subscriptions = [], deliveryRows = [], now = new Date() } = {}) => {
  const subscriptionsByUser = new Map()
  subscriptions.forEach((subscription) => {
    const list = subscriptionsByUser.get(subscription.user_id) || []
    list.push(subscription)
    subscriptionsByUser.set(subscription.user_id, list)
  })
  const delivered = new Set(deliveryRows.map((row) => `${row.user_id}|${row.event_key}|${row.cycle_key}`))
  return portfolioRows.flatMap((row) => {
    const portfolio = row.portfolio || {}
    const settings = portfolio.settings || {}
    if (settings.notificationsEnabled === false || settings.pushNotificationsEnabled !== true) return []
    const userSubscriptions = subscriptionsByUser.get(row.user_id) || []
    if (!userSubscriptions.length) return []
    const preferences = normalizeNotificationPreferences(portfolio.notificationPreferences)
    return actionableNotifications({ properties: portfolio.properties, preferences, enabled: true, now }).flatMap((event) => {
      const cycleKey = notificationCycleKey(preferences, event)
      return delivered.has(`${row.user_id}|${event.key}|${cycleKey}`) ? [] : [{
        userId: row.user_id,
        event,
        cycleKey,
        subscriptions: userSubscriptions,
      }]
    })
  })
}

const claimDelivery = async (env, candidate) => {
  const result = await adminRequest(env, '/rest/v1/notification_deliveries?on_conflict=user_id,event_key,cycle_key', {
    method: 'POST',
    headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
    body: { user_id: candidate.userId, event_key: candidate.event.key, cycle_key: candidate.cycleKey },
  })
  return Array.isArray(result) && result.length > 0
}

const releaseClaim = (env, candidate) => adminRequest(env,
  `/rest/v1/notification_deliveries?user_id=eq.${encodeURIComponent(candidate.userId)}&event_key=eq.${encodeURIComponent(candidate.event.key)}&cycle_key=eq.${encodeURIComponent(candidate.cycleKey)}`,
  { method: 'DELETE' },
)

const removeGone = (env, userId, endpoints) => Promise.all(endpoints.map((endpoint) => adminRequest(env,
  `/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&endpoint=eq.${encodeURIComponent(endpoint)}`,
  { method: 'DELETE' },
)))

export async function onRequestPost({ request, env }) {
  const configuredSecret = String(env.NOTIFICATION_DISPATCH_SECRET || '')
  const suppliedSecret = String(request.headers.get('x-notification-dispatch-secret') || '')
  if (!configuredSecret || !safeEqual(configuredSecret, suppliedSecret)) return json({ error: 'Unauthorised.' }, 401)

  const url = new URL(request.url)
  const now = new Date()
  const force = url.searchParams.get('force') === '1'
  const hour = londonHour(now)
  if (!force && (hour < 9 || hour > 17)) return json({ ok: true, skipped: 'outside_delivery_window' })

  const publicKey = env.PUSH_VAPID_PUBLIC_KEY || env.VITE_PUSH_VAPID_PUBLIC_KEY
  const privateKey = env.PUSH_VAPID_PRIVATE_KEY
  const subject = env.PUSH_VAPID_SUBJECT || env.PUBLIC_SITE_URL
  if (!publicKey || !privateKey || !subject) return json({ error: 'Push delivery is not configured.', code: 'not_configured' }, 503)

  try {
    const [portfolioRows, subscriptions, deliveryRows] = await Promise.all([
      adminRequest(env, '/rest/v1/portfolio_states?select=user_id,portfolio'),
      adminRequest(env, '/rest/v1/push_subscriptions?select=id,user_id,endpoint,p256dh,auth'),
      adminRequest(env, '/rest/v1/notification_deliveries?select=user_id,event_key,cycle_key'),
    ])
    const candidates = dispatchCandidates({ portfolioRows, subscriptions, deliveryRows, now })
    let delivered = 0
    let failed = 0
    let removed = 0

    for (const candidate of candidates) {
      if (!await claimDelivery(env, candidate)) continue
      const subscriptionData = candidate.subscriptions.map((item) => ({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }))
      try {
        const result = await sendPushBatch(
          subscriptionData,
          pushPayloadForNotification(candidate.event),
          { publicKey, privateKey, subject },
          { ttl: 86400, urgency: 'low', topic: await topicFromString(candidate.event.key), concurrency: 8, timeoutMs: 10000 },
        )
        if (result.gone.length) {
          await removeGone(env, candidate.userId, result.gone)
          removed += result.gone.length
        }
        delivered += result.delivered
        failed += result.failed.length
        if (result.delivered === 0) await releaseClaim(env, candidate)
      } catch {
        failed += 1
        await releaseClaim(env, candidate)
      }
    }

    return json({ ok: true, candidates: candidates.length, delivered, failed, removed })
  } catch (error) {
    return json({ error: error.message || 'Push dispatch failed.' }, error.status >= 400 && error.status < 600 ? error.status : 502)
  }
}
