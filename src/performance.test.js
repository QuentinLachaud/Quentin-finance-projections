import { describe, expect, it } from 'vitest'
import {
  buildPerformanceModel,
  normalizePerformanceEvents,
  signedPerformanceAmount,
  xirr,
} from './performance.js'

const property = {
  id: 'p1', name: 'BTL1', purchaseDate: '2025-01-01', purchasePrice: 200000,
  latestValuation: 220000, mortgagePrincipalAmount: 150000, loanAmount: 150000,
  rent: 1000, operatingCashflow: 300, mortgageInterestOnly: true, baseRate: 0.04,
}

describe('performance engine', () => {
  it('solves dated annualised return rather than treating irregular cash flows as a simple CAGR', () => {
    expect(xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1100 }])).toBeCloseTo(0.1, 3)
  })

  it('uses an explicit initial cash event when supplied and otherwise exposes the derived purchase basis as estimated', () => {
    const estimated = buildPerformanceModel({ properties: [property], scope: 'p1', now: new Date('2026-01-01T12:00:00Z') })
    expect(estimated.metrics.capitalBasis).toBe('estimated')
    expect(estimated.events.find((event) => event.sourceType === 'derived-capital-basis')?.amount).toBe(-50000)

    const performanceEvents = normalizePerformanceEvents([{ id: 'basis', propertyId: 'p1', occurredAt: '2025-01-01', type: 'initial_capital', amount: 48000 }], [property])
    const recorded = buildPerformanceModel({ properties: [property], performanceEvents, scope: 'p1', now: new Date('2026-01-01T12:00:00Z') })
    expect(recorded.metrics.capitalBasis).toBe('recorded')
    expect(recorded.events.some((event) => event.sourceType === 'derived-capital-basis')).toBe(false)
    expect(recorded.events.find((event) => event.id === 'basis')?.amount).toBe(-48000)
  })

  it('includes only dated real cash entries in historical cash return and keeps change snapshots non-cash', () => {
    const model = buildPerformanceModel({
      properties: [property],
      expenses: [
        { id: 'rent', date: '2025-06-01', property: 'BTL1', amount: 6000, description: 'Rent' },
        { id: 'repair', date: '2025-07-01', property: 'BTL1', amount: -750, description: 'Repair' },
      ],
      timelineEvents: [{ id: 'rent-change', propertyId: 'p1', occurredAt: '2025-09-01', kind: 'change', category: 'finance', sourceField: 'rent', title: 'Rent changed', details: '£1,000 → £1,100 / month', before: 1000, after: 1100 }],
      scope: 'p1', now: new Date('2026-01-01T12:00:00Z'),
    })
    expect(model.metrics.actualCashEntries).toBe(2)
    expect(model.events.find((event) => event.type === 'rent_change')?.amount).toBe(0)
    expect(model.metrics.cashReturned).toBe(6000)
    expect(model.breakdown.find((item) => item.key === 'costs')?.amount).toBe(-750)
    expect(model.breakdown.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(model.metrics.wealthCreated, 2)
  })

  it('projects value, rent, cash flow and repayment debt across 5/10/15 year horizons without altering actual metrics', () => {
    const repayment = { ...property, mortgageInterestOnly: false, mortgageTermMonths: 300 }
    const five = buildPerformanceModel({ properties: [repayment], settings: { appreciationRate: 0.03, rentGrowthRate: 0.02 }, scope: 'p1', horizonYears: 5, now: new Date('2026-01-01T12:00:00Z') })
    const fifteen = buildPerformanceModel({ properties: [repayment], settings: { appreciationRate: 0.03, rentGrowthRate: 0.02 }, scope: 'p1', horizonYears: 15, now: new Date('2026-01-01T12:00:00Z') })
    expect(five.metrics.wealthCreated).toBe(fifteen.metrics.wealthCreated)
    expect(fifteen.projection.propertyValue).toBeGreaterThan(five.projection.propertyValue)
    expect(fifteen.projection.annualRent).toBeGreaterThan(five.projection.annualRent)
    expect(fifteen.projection.debt).toBeLessThan(five.projection.debt)
  })

  it('normalizes fixed-direction manual amounts so UI entry cannot silently invert tax or refinance cash', () => {
    expect(signedPerformanceAmount('tax', 1200)).toBe(-1200)
    expect(signedPerformanceAmount('refinance_cash', -9000)).toBe(9000)
    expect(signedPerformanceAmount('other', -250)).toBe(-250)
  })
})
