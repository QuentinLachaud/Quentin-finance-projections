import { getCurrentSubscription, getNotificationPermission, isPushSupported, serializeSubscription, subscribe, unsubscribe } from '@mmmike/web-push/client'
import { supabase } from './supabase.js'

const vapidPublicKey = import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY || ''

const authHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('A signed-in session is required for push notifications.')
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

const registerServiceWorker = async () => navigator.serviceWorker.register('/push-sw.js')

const uploadSubscription = async (subscription) => {
  const response = await fetch('/api/push-subscription', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(serializeSubscription(subscription)),
  })
  if (!response.ok) throw new Error('Push subscription could not be saved.')
}

const removeServerSubscription = async (endpoint) => {
  if (!endpoint) return
  const response = await fetch('/api/push-subscription', {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ endpoint }),
  })
  if (!response.ok) throw new Error('Push subscription could not be removed.')
}

export const pushCapability = () => {
  if (!isPushSupported()) return 'unsupported'
  if (!vapidPublicKey) return 'not-configured'
  return getNotificationPermission()
}

export const enablePushNotifications = async () => {
  if (!isPushSupported()) return { status: 'unsupported' }
  if (!vapidPublicKey) return { status: 'not-configured' }
  await registerServiceWorker()
  const result = await subscribe(vapidPublicKey)
  if (result.status !== 'subscribed') return result
  await uploadSubscription(result.subscription)
  return { status: 'subscribed' }
}

export const syncPushNotifications = async () => {
  if (!isPushSupported()) return { status: 'unsupported' }
  if (!vapidPublicKey) return { status: 'not-configured' }
  if (getNotificationPermission() !== 'granted') return { status: getNotificationPermission() }
  await registerServiceWorker()
  const existing = await getCurrentSubscription()
  if (existing) {
    await uploadSubscription(existing)
    return { status: 'subscribed' }
  }
  return { status: 'permission-required' }
}

export const disablePushNotifications = async () => {
  if (!isPushSupported()) return { status: 'unsupported' }
  await registerServiceWorker()
  const endpoint = await unsubscribe()
  await removeServerSubscription(endpoint)
  return { status: 'disabled' }
}
