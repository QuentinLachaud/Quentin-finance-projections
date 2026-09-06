import { describe, expect, it } from 'vitest'
import { importPropertyTenants } from './tenants.js'
import { rentScheduleForMonth, scheduledRentDateForMonth } from './rentSchedule.js'

const properties = [
  { id: 'btl1', name: 'BTL1', active: true, rent: 1500 },
  { id: 'btl2', name: 'BTL2', active: true, rent: 1100 },
]
const tenants = [
  { id: 'scott', propertyId: 'btl1', name: 'Scott Reoch', rentPaymentDay: 6, moveIn: '2024-01-01', moveOut: '' },
  { id: 'joaquim', propertyId: 'btl2', name: 'Joaquim', rentPaymentDay: 16, moveIn: '2024-01-01', moveOut: '' },
]

describe('calendar-month rent scheduling', () => {
  it('always produces exactly two on-time rents for the two stable active tenancies regardless of month length or today', () => {
    for (let month = 0; month < 12; month += 1) {
      const result = rentScheduleForMonth(tenants, properties, new Date(2027, month, 27, 12))
      expect(result.events).toHaveLength(2)
      expect(result.events.map((event) => event.dueDay)).toEqual([6, 16])
      expect(result.scheduledRent).toBe(2600)
      expect(new Set(result.events.map((event) => event.id)).size).toBe(2)
    }
  })

  it('clamps day 31 to the true calendar month end including leap years', () => {
    expect(scheduledRentDateForMonth(31, 2027, 1)).toBe('2027-02-28')
    expect(scheduledRentDateForMonth(31, 2028, 1)).toBe('2028-02-29')
    expect(scheduledRentDateForMonth(31, 2027, 3)).toBe('2027-04-30')
    expect(scheduledRentDateForMonth(31, 2027, 0)).toBe('2027-01-31')
  })

  it('uses the due date to determine first and last tenancy months without inventing proration', () => {
    const startsAfterDue = [{ ...tenants[0], moveIn: '2027-09-07' }]
    expect(rentScheduleForMonth(startsAfterDue, [properties[0]], new Date(2027, 8, 20, 12)).events).toHaveLength(0)
    const startsBeforeDue = [{ ...tenants[0], moveIn: '2027-09-05' }]
    expect(rentScheduleForMonth(startsBeforeDue, [properties[0]], new Date(2027, 8, 20, 12)).events).toHaveLength(1)
    const endsBeforeDue = [{ ...tenants[1], moveOut: '2027-09-15' }]
    expect(rentScheduleForMonth(endsBeforeDue, [properties[1]], new Date(2027, 8, 20, 12)).events).toHaveLength(0)
    const endsOnDue = [{ ...tenants[1], moveOut: '2027-09-16' }]
    expect(rentScheduleForMonth(endsOnDue, [properties[1]], new Date(2027, 8, 20, 12)).events).toHaveLength(1)
  })

  it('does not guess a missing payment day', () => {
    const result = rentScheduleForMonth([{ ...tenants[0], rentPaymentDay: null }], [properties[0]], new Date(2027, 8, 20, 12))
    expect(result.events).toHaveLength(0)
    expect(result.missingTenants).toHaveLength(1)
  })

  it('backfills the two requested legacy tenant payment days without overwriting an existing valid day', () => {
    const migratedProperties = [{ id: 'btl1' }, { id: 'btl2' }]
    const migrated = importPropertyTenants(migratedProperties, [
      { id: '1', propertyId: 'btl1', name: 'Scott Reoch' },
      { id: '2', propertyId: 'btl2', name: 'Joaquim' },
      { id: '3', propertyId: 'btl2', name: 'Scott Reoch', rentPaymentDay: 9 },
    ])
    expect(migrated.find((tenant) => tenant.id === '1').rentPaymentDay).toBe(6)
    expect(migrated.find((tenant) => tenant.id === '2').rentPaymentDay).toBe(16)
    expect(migrated.find((tenant) => tenant.id === '3').rentPaymentDay).toBe(9)
  })
})
