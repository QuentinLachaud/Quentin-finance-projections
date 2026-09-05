import { getCurrentSubscription, getNotificationPermission, isPushSupported, serializeSubscription, subscribe, unsubscribe } from '@mmmike/web-push/client'
import { supabase } from './supabase.js'
import './mobilePush.css'

let cachedVapidPublicKey = import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY || ''

const authHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('A signed-in session is required for push notifications.')
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

const registerServiceWorker = async () => navigator.serviceWorker.register('/push-sw.js')
const mobileMediaMatches = (query) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches

export const isMobilePushDevice = () => {
  if (typeof navigator === 'undefined') return false
  const phoneWidth = mobileMediaMatches('(max-width: 760px)')
  const touchCapable = Number(navigator.maxTouchPoints || 0) > 0 || mobileMediaMatches('(pointer: coarse)')
  return phoneWidth && touchCapable
}

const loadVapidPublicKey = async () => {
  if (cachedVapidPublicKey) return cachedVapidPublicKey
  try {
    const response = await fetch('/api/push-config', { headers: { accept: 'application/json' } })
    if (!response.ok) return ''
    const payload = await response.json()
    cachedVapidPublicKey = typeof payload?.publicKey === 'string' ? payload.publicKey.trim() : ''
    return cachedVapidPublicKey
  } catch {
    return ''
  }
}

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
  if (!isMobilePushDevice()) return 'mobile-only'
  if (!isPushSupported()) return 'unsupported'
  return getNotificationPermission()
}

export const enablePushNotifications = async () => {
  if (!isMobilePushDevice()) return { status: 'mobile-only' }
  if (!isPushSupported()) return { status: 'unsupported' }
  const vapidPublicKey = await loadVapidPublicKey()
  if (!vapidPublicKey) return { status: 'not-configured' }
  await registerServiceWorker()
  const result = await subscribe(vapidPublicKey)
  if (result.status !== 'subscribed') return result
  await uploadSubscription(result.subscription)
  return { status: 'subscribed' }
}

export const syncPushNotifications = async () => {
  if (!isMobilePushDevice()) return { status: 'mobile-only' }
  if (!isPushSupported()) return { status: 'unsupported' }
  const vapidPublicKey = await loadVapidPublicKey()
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
  if (!isMobilePushDevice()) return { status: 'mobile-only' }
  if (!isPushSupported()) return { status: 'unsupported' }
  await registerServiceWorker()
  const endpoint = await unsubscribe()
  await removeServerSubscription(endpoint)
  return { status: 'disabled' }
}
