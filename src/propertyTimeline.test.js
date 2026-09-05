import { describe, expect, it } from 'vitest'
import {
  buildPropertyTimeline, filterPropertyTimelineHistory, loanChangeEvents,
  normalizePropertyTimelineEvents, propertyChangeEvents,
} from './propertyTimeline.js'

const property = {
  id: 'btl-1', name: 'BTL1', postcode: 'G1 1AA', active: true,
  purchaseDate: '2025-02-28', purchasePrice: 235000,
  rent: 1650, latestValuation: 261924,
  gasExpiry: '2026-09-20', eicrExpiry: '2028-04-01', patExpiry: '', epcExpiry: '',
  latestRemortgage: '2025-02-28', fixedRateMonths: 24,
}

const loan = { id: 'loan-1', propertyId: 'btl-1', lender: 'Paragon', loanAmount: 181587, principalAmount: 176300, rate: 0.0484, fixedRateMonths: 24, fixedStartDate: '2025-02-28', feeMode: 'percent', feeValue: 3, addFeeToLoan: true, interestOnly: true, ltvBand: 75 }
const tenants = [
  { id: 't1', propertyId: 'btl-1', name: 'Current tenant', moveIn: '2025-03-01', moveOut: '2026-12-01' },
  { id: 't0', propertyId: 'btl-1', name: 'Old tenant', moveIn: '2024-01-01', moveOut: '2025-02-01' },
]
const expenses = [
  { id: 'e1', date: '2026-08-20', property: 'BTL1', category: 'Repairs', amount: -185, description: 'Boiler pressure valve replaced', notes: '', document: { title: 'ABC Heating invoice', type: 'Receipt / invoice', contractorId: 'c1', association: { kind: 'property', id: 'btl-1', label: 'BTL1' }, storagePath: 'u/btl-1/invoice.pdf' } },
  { id: 'e2', date: '2026-08-15', property: 'All', category: '', amount: -90, description: '', document: { title: 'Gas certificate', type: 'Compliance certificate', contractorId: 'c1', association: { kind: 'property', id: 'btl-1', label: 'BTL1' }, storagePath: 'u/btl-1/gas.pdf' } },
  { id: 'other', date: '2026-08-10', property: 'BTL2', category: 'Repairs', amount: -50, description: 'Not this property' },
]

describe('property timeline model', () => {
  it('derives useful dated history without inventing undated current-state history', () => {
    const result = buildPropertyTimeline({ property, loans: [loan], tenants, expenses, now: new Date('2026-09-05T12:00:00Z') })
    expect(result.history.map((event) => event.title)).toEqual(expect.arrayContaining([
      'Property purchased', 'Mortgage / refinance started', 'Tenant moved in', 'Tenant moved out',
      'Boiler pressure valve replaced', 'Gas certificate',
    ]))
    expect(result.history.some((event) => event.title === 'Current valuation')).toBe(false)
    expect(result.history.some((event) => event.title === 'Current rent')).toBe(false)
    expect(result.history.filter((event) => event.sourceId === 'e1')).toHaveLength(1)
    expect(result.history.find((event) => event.sourceId === 'e1')?.category).toBe('maintenance')
    expect(result.history.find((event) => event.sourceId === 'e2')?.category).toBe('compliance')
    expect(result.history.some((event) => event.sourceId === 'other')).toBe(false)
  })

  it('uses the shared compliance/remortgage diary for upcoming dates and adds future tenant move-out', () => {
    const result = buildPropertyTimeline({ property, loans: [loan], tenants, now: new Date('2026-09-05T12:00:00Z') })
    expect(result.upcoming.map((event) => event.title)).toEqual(expect.arrayContaining(['Gas certificate due', 'EICR due', 'Remortgage window opens', 'Tenant move-out']))
    expect(result.upcoming[0].date <= result.upcoming.at(-1).date).toBe(true)
  })

  it('captures only material property fields and ignores unchanged saves', () => {
    const changed = propertyChangeEvents(property, { ...property, rent: 1700, latestValuation: 270000, gasExpiry: '2026-10-01' }, new Date('2026-09-05T12:00:00Z'))
    expect(changed.map((event) => event.title)).toEqual(['Rent changed', 'Property valuation updated', 'Gas certificate date updated'])
    expect(changed.every((event) => event.occurredAt === '2026-09-05')).toBe(true)
    expect(propertyChangeEvents(property, { ...property }, new Date('2026-09-05T12:00:00Z'))).toEqual([])
  })

  it('coalesces a multi-field mortgage edit into one snapshot and uses refinance date when it changes', () => {
    const next = { ...loan, lender: 'The Mortgage Works', rate: 0.0399, loanAmount: 180000, fixedStartDate: '2026-10-01' }
    const events = loanChangeEvents(loan, next, property.id, new Date('2026-09-05T12:00:00Z'))
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Mortgage refinanced')
    expect(events[0].occurredAt).toBe('2026-10-01')
    expect(events[0].before.lender).toBe('Paragon')
    expect(events[0].after.lender).toBe('The Mortgage Works')
  })

  it('does not duplicate a stored refinance snapshot with the current linked loan event', () => {
    const next = { ...loan, fixedStartDate: '2026-08-01', rate: 0.04 }
    const [snapshot] = loanChangeEvents(loan, next, property.id, new Date('2026-08-01T12:00:00Z'))
    const result = buildPropertyTimeline({ property, loans: [next], timelineEvents: [snapshot], now: new Date('2026-09-05T12:00:00Z') })
    expect(result.history.filter((event) => event.sourceId === loan.id && event.occurredAt === '2026-08-01')).toHaveLength(1)
  })

  it('normalizes away orphaned stored events and filters history categories', () => {
    const normalized = normalizePropertyTimelineEvents([
      { id: 'ok', propertyId: 'btl-1', kind: 'manual', manualType: 'note', occurredAt: '2026-09-01', title: 'Meter reading' },
      { id: 'orphan', propertyId: 'missing', kind: 'manual', occurredAt: '2026-09-01', title: 'Orphan' },
    ], [property])
    expect(normalized.map((event) => event.id)).toEqual(['ok'])
    expect(filterPropertyTimelineHistory([{ category: 'finance' }, { category: 'maintenance' }], 'finance')).toEqual([{ category: 'finance' }])
  })
})
