self.addEventListener('push', (event) => {
  let payload = { title: 'BTL Portfolio', body: 'You have an upcoming property reminder.', data: { url: '/?notifications=1' } }
  try {
    payload = { ...payload, ...(event.data?.json() || {}) }
  } catch {
    // Keep the safe generic fallback if a push provider returns malformed data.
  }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    data: payload.data || { url: '/?notifications=1' },
    renotify: false,
    requireInteraction: false,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/?notifications=1', self.location.origin)
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === target.origin)
    if (existing) {
      if ('navigate' in existing) await existing.navigate(target.href)
      return existing.focus()
    }
    return self.clients.openWindow(target.href)
  }))
})
