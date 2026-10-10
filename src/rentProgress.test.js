import { describe, expect, it } from 'vitest'
import { formatRentCycleDate, rentCycleForDate, scheduledRentAmountForDate } from './rentProgress.js'

const properties = [{ id: 'p1', name: 'BTL 1', active: true, rent: 1000 }]
const tenant = (day = 31, extra = {}) => ({ id: 't1', propertyId: 'p1', rentPaymentDay: day, moveIn: '2025-01-01', ...extra })

describe('rent progress cycle', () => {
  it('ends the mint arc exactly at today, not at the next rent date', () => {
    const cycle = rentCycleForDate([tenant()], properties, new Date(2026, 9, 10, 12))
    expect(cycle.previousDueDate).toBe('2026-09-30')
    expect(cycle.nextDueDate).toBe('2026-10-31')
    expect(cycle.daysUntil).toBe(21)
    expect(cycle.progress).toBeCloseTo(10 / 31, 10)
    expect(cycle.progress).toBeLessThan(1)
  })

  it('handles the rent due today, then resets the cycle tomorrow', () => {
    const due = rentCycleForDate([tenant()], properties, new Date(2026, 9, 31, 12))
    expect(due.daysUntil).toBe(0)
    expect(due.progress).toBe(1)
    const tomorrow = rentCycleForDate([tenant()], properties, new Date(2026, 10, 1, 12))
    expect(tomorrow.previousDueDate).toBe('2026-10-31')
    expect(tomorrow.nextDueDate).toBe('2026-11-30')
    expect(tomorrow.daysUntil).toBe(29)
    expect(tomorrow.progress).toBeCloseTo(1 / 30, 10)
  })

  it('uses the closest dates across several active properties', () => {
    const otherProperty = { id: 'p2', name: 'BTL 2', rent: 750 }
    const otherTenant = { id: 't2', propertyId: 'p2', rentPaymentDay: 12, moveIn: '2025-01-01' }
    const cycle = rentCycleForDate([tenant(5), otherTenant], [...properties, otherProperty], new Date(2026, 9, 10, 12))
    expect(cycle.previousDueDate).toBe('2026-10-05')
    expect(cycle.nextDueDate).toBe('2026-10-12')
    expect(cycle.daysUntil).toBe(2)
    expect(cycle.progress).toBeCloseTo(5 / 7)
  })

  it('uses calendar days through DST and leap-year month ends', () => {
    const afterClocksChange = rentCycleForDate([tenant(31)], properties, new Date(2026, 2, 30, 12))
    expect(afterClocksChange.previousDueDate).toBe('2026-02-28')
    expect(afterClocksChange.nextDueDate).toBe('2026-03-31')
    expect(afterClocksChange.daysUntil).toBe(1)
    expect(afterClocksChange.progress).toBeCloseTo(30 / 31)
    const leap = rentCycleForDate([tenant(31)], properties, new Date(2028, 1, 29, 12))
    expect(leap.nextDueDate).toBe('2028-02-29')
    expect(leap.daysUntil).toBe(0)
  })

  it('does not invent rent dates for missing day or inactive properties', () => {
    for (const inputs of [
      { tenants: [tenant(null)], properties },
      { tenants: [tenant()], properties: [{ ...properties[0], active: false }] },
      { tenants: [], properties },
    ]) {
      expect(rentCycleForDate(inputs.tenants, inputs.properties, new Date(2026, 9, 10, 12))).toEqual({
        previousDueDate: null,
        nextDueDate: null,
        daysUntil: null,
        progress: 0,
      })
    }
    expect(formatRentCycleDate(null)).toBe('—')
    expect(formatRentCycleDate('2026-10-31')).toBe('31 Oct')
  })

  it('does not treat a tenancy outside its valid dates as scheduled', () => {
    const future = tenant(31, { moveIn: '2026-12-01' })
    const cycle = rentCycleForDate([future], properties, new Date(2026, 9, 10, 12))
    expect(cycle.previousDueDate).toBeNull()
    expect(cycle.nextDueDate).toBe('2026-12-31')
    expect(cycle.progress).toBe(0)
  })
  it('looks up expected rent amounts for each boundary without implying payment', () => {
    const otherProperty = { id: 'p2', name: 'BTL 2', active: true, rent: 750 }
    const otherTenant = { id: 't2', propertyId: 'p2', rentPaymentDay: 12, moveIn: '2025-01-01' }
    const allProperties = [...properties, otherProperty]
    const allTenants = [tenant(5), otherTenant]
    const cycle = rentCycleForDate(allTenants, allProperties, new Date(2026, 9, 10, 12))
    expect(scheduledRentAmountForDate(allTenants, allProperties, cycle.previousDueDate)).toBe(1000)
    expect(scheduledRentAmountForDate(allTenants, allProperties, cycle.nextDueDate)).toBe(750)
    expect(scheduledRentAmountForDate([tenant(12), otherTenant], allProperties, '2026-10-12')).toBe(1750)
  })

  it('returns null for missing or invalid dates, but zero for valid zero-rent events', () => {
    expect(scheduledRentAmountForDate([], [], null)).toBeNull()
    expect(scheduledRentAmountForDate([], [], '2026-02-30')).toBeNull()
    expect(scheduledRentAmountForDate([tenant()], [{ ...properties[0], rent: 0 }], '2026-10-31')).toBe(0)
    expect(scheduledRentAmountForDate([tenant()], [{ ...properties[0], active: false }], '2026-10-31')).toBe(0)
  })
})
