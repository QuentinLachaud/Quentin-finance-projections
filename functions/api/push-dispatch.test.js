import { describe, expect, it } from 'vitest'
import { dispatchCandidates, londonHour, onRequestPost } from './push-dispatch.js'

const portfolio = {
  settings: { notificationsEnabled: true, pushNotificationsEnabled: true },
  notificationPreferences: {},
  properties: [{ id: 'p1', name: 'BTL1', active: true, latestRemortgage: '', fixedRateMonths: 0, gasExpiry: '2026-09-20' }],
}

describe('scheduled push selection', () => {
  it('uses Europe/London for the quiet daytime window', () => {
    expect(londonHour(new Date('2026-09-04T08:30:00Z'))).toBe(9)
    expect(londonHour(new Date('2026-01-04T09:30:00Z'))).toBe(9)
  })

  it('selects one undelivered reminder cycle and suppresses an existing claim', () => {
    const base = {
      portfolioRows: [{ user_id: 'u1', portfolio }],
      subscriptions: [{ user_id: 'u1', endpoint: 'https://push.example/secret', p256dh: 'key', auth: 'auth' }],
      now: new Date('2026-09-10T12:00:00Z'),
    }
    const first = dispatchCandidates(base)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ userId: 'u1', cycleKey: 'initial' })
    expect(dispatchCandidates({ ...base, deliveryRows: [{ user_id: 'u1', event_key: first[0].event.key, cycle_key: 'initial' }] })).toHaveLength(0)
  })

  it('honours master/push toggles and snooze state', () => {
    const base = {
      subscriptions: [{ user_id: 'u1', endpoint: 'https://push.example/secret', p256dh: 'key', auth: 'auth' }],
      now: new Date('2026-09-10T12:00:00Z'),
    }
    expect(dispatchCandidates({ ...base, portfolioRows: [{ user_id: 'u1', portfolio: { ...portfolio, settings: { notificationsEnabled: false, pushNotificationsEnabled: true } } }] })).toHaveLength(0)
    expect(dispatchCandidates({ ...base, portfolioRows: [{ user_id: 'u1', portfolio: { ...portfolio, settings: { notificationsEnabled: true, pushNotificationsEnabled: false } } }] })).toHaveLength(0)
    const eventKey = 'p1|gas|2026-09-20'
    expect(dispatchCandidates({ ...base, portfolioRows: [{ user_id: 'u1', portfolio: { ...portfolio, notificationPreferences: { snoozedUntil: { [eventKey]: '2026-09-15' } } } }] })).toHaveLength(0)
  })

  it('rejects callers without the dispatch secret before storage access', async () => {
    const response = await onRequestPost({ request: new Request('https://app.example/api/push-dispatch', { method: 'POST' }), env: { NOTIFICATION_DISPATCH_SECRET: 'secret' } })
    expect(response.status).toBe(401)
  })
})
