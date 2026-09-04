import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const center = readFileSync(new URL('./NotificationCenter.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const worker = readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8')

describe('notification UI integration', () => {
  it('exposes subtle bell, global and push toggles, and per-item actions', () => {
    expect(app).toContain('<NotificationBell')
    expect(app).toContain('Notifications')
    expect(app).toContain('Push notifications')
    expect(center).toContain('Snooze 1 week')
    expect(center).toContain('Dismiss')
    expect(center).toContain('Nothing due soon')
    expect(styles).toContain('.notification-bell')
    expect(styles).toContain('.notification-center')
  })

  it('registers push only through explicit settings actions and opens the centre from push clicks', () => {
    expect(app).toContain('enablePushNotifications()')
    expect(worker).toContain("self.addEventListener('push'")
    expect(worker).toContain("self.addEventListener('notificationclick'")
    expect(worker).toContain('/?notifications=1')
  })
})
