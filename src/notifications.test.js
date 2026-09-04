import { describe, expect, it } from 'vitest'
import {
  actionableNotifications, addMonthsDateOnly, complianceDiaryItems, dismissNotification,
  notificationCycleKey, snoozeNotification,
} from './notifications.js'

const property = (overrides = {}) => ({
  id: 'p1', name: 'BTL1', active: true, latestRemortgage: '2026-01-31', fixedRateMonths: 12,
  gasExpiry: '', eicrExpiry: '', patExpiry: '', epcExpiry: '', ...overrides,
})

describe('notification timing', () => {
  it('opens the remortgage reminder exactly three calendar months before the target date', () => {
    expect(addMonthsDateOnly('2027-01-31', -3)).toBe('2026-10-31')
    expect(actionableNotifications({ properties: [property()], now: new Date('2026-10-30T12:00:00Z') })).toHaveLength(0)
    const [event] = actionableNotifications({ properties: [property()], now: new Date('2026-10-31T12:00:00Z') })
    expect(event).toMatchObject({ type: 'remortgage', dueDate: '2027-01-31', notifyFrom: '2026-10-31' })
  })

  it.each([
    ['gasExpiry', 'gas'], ['eicrExpiry', 'eicr'], ['patExpiry', 'pat'], ['epcExpiry', 'epc'],
  ])('opens %s exactly 14 days before expiry', (field, type) => {
    const item = property({ latestRemortgage: '', fixedRateMonths: 0, [field]: '2026-09-30' })
    expect(actionableNotifications({ properties: [item], now: new Date('2026-09-15T12:00:00Z') })).toHaveLength(0)
    expect(actionableNotifications({ properties: [item], now: new Date('2026-09-16T12:00:00Z') })[0]).toMatchObject({ type, dueDate: '2026-09-30', notifyFrom: '2026-09-16' })
  })

  it('ignores excluded properties and keeps the compliance diary sorted from the shared definitions', () => {
    const items = complianceDiaryItems([
      property({ active: false, gasExpiry: '2026-09-10' }),
      property({ id: 'p2', name: 'BTL2', latestRemortgage: '', gasExpiry: '2026-09-20', eicrExpiry: '2026-09-18' }),
    ])
    expect(items.map((item) => item.label)).toEqual(['EICR', 'Gas certificate'])
  })
})

describe('notification user state', () => {
  const dueProperty = property({ latestRemortgage: '', gasExpiry: '2026-09-20' })
  const now = new Date('2026-09-10T12:00:00Z')
  const event = actionableNotifications({ properties: [dueProperty], now })[0]

  it('dismisses only the exact dated event and a changed due date creates a new identity', () => {
    const preferences = dismissNotification({}, event, now)
    expect(actionableNotifications({ properties: [dueProperty], preferences, now })).toHaveLength(0)
    const replacement = dueProperty ? { ...dueProperty, gasExpiry: '2026-09-24' } : dueProperty
    expect(actionableNotifications({ properties: [replacement], preferences, now })).toHaveLength(1)
  })

  it('snoozes for a week then creates a new push-delivery cycle when it returns', () => {
    const preferences = snoozeNotification({}, event, now)
    expect(preferences.snoozedUntil[event.key]).toBe('2026-09-17')
    expect(actionableNotifications({ properties: [dueProperty], preferences, now: new Date('2026-09-16T12:00:00Z') })).toHaveLength(0)
    expect(actionableNotifications({ properties: [dueProperty], preferences, now: new Date('2026-09-17T12:00:00Z') })).toHaveLength(1)
    expect(notificationCycleKey(preferences, event)).toBe('2026-09-17')
  })

  it('caps snooze at the due date', () => {
    const nearDue = actionableNotifications({ properties: [dueProperty], now: new Date('2026-09-18T12:00:00Z') })[0]
    const preferences = snoozeNotification({}, nearDue, new Date('2026-09-18T12:00:00Z'))
    expect(preferences.snoozedUntil[nearDue.key]).toBe('2026-09-20')
  })
})
