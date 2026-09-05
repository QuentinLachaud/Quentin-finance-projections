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
  rent: 1100, operatingCashflow: 300, mortgageInterestOnly: true, baseRate: 0.04,
}

const timelineRentChange = {
  id: 'rent-change', propertyId: 'p1', occurredAt: '2025-09-01', kind: 'change', category: 'finance',
  sourceField: 'rent', title: 'Rent changed', details: '£1,000 → £1,100 / month', before: 1000, after: 1100,
}

const actualExpenses = [
  { id: 'rent', date: '2025-06-01', property: 'BTL1', amount: 6000, description: 'Rent' },
  { id: 'repair', date: '2025-07-01', property: 'BTL1', amount: -750, description: 'Repair' },
]

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

  it('keeps unrelated rent events from collapsing value or debt to zero and preserves the before/after rent step', () => {
    const model = buildPerformanceModel({
      properties: [property],
      expenses: actualExpenses,
      timelineEvents: [timelineRentChange],
      scope: 'p1', now: new Date('2026-01-01T12:00:00Z'),
    })
    const rentChangePoints = model.actualPoints.filter((point) => point.date === '2025-09-01')
    expect(rentChangePoints.map((point) => point.monthlyRent)).toEqual([1000, 1100])
    expect(rentChangePoints.every((point) => point.assetValue === 200000)).toBe(true)
    expect(rentChangePoints.every((point) => point.debt === 150000)).toBe(true)
  })

  it('builds cumulative actual income, costs and appreciation only from recorded history', () => {
    const model = buildPerformanceModel({
      properties: [property], expenses: actualExpenses, timelineEvents: [timelineRentChange],
      scope: 'p1', now: new Date('2026-01-01T12:00:00Z'),
    })
    const today = model.actualPoints.at(-1)
    expect(model.metrics.actualCashEntries).toBe(2)
    expect(model.metrics.operatingNetIncome).toBe(5250)
    expect(model.metrics.recordedCosts).toBe(750)
    expect(model.metrics.currentMonthlyRent).toBe(1100)
    expect(today.cumulativeNetIncome).toBe(5250)
    expect(today.cumulativeCosts).toBe(750)
    expect(today.cumulativeAppreciation).toBe(20000)
    expect(today.monthlyRent).toBe(1100)
    expect(model.events.find((event) => event.type === 'rent_change')?.amount).toBe(0)
    expect(model.breakdown.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(model.metrics.wealthCreated, 2)
  })

  it('forecasts value, rent, cumulative costs, net income, appreciation and debt across the selected horizon without changing actual metrics', () => {
    const repayment = { ...property, mortgageInterestOnly: false, mortgageTermMonths: 300 }
    const input = { properties: [repayment], expenses: actualExpenses, timelineEvents: [timelineRentChange], settings: { appreciationRate: 0.03, rentGrowthRate: 0.02 }, scope: 'p1', now: new Date('2026-01-01T12:00:00Z') }
    const five = buildPerformanceModel({ ...input, horizonYears: 5 })
    const fifteen = buildPerformanceModel({ ...input, horizonYears: 15 })
    expect(five.metrics.wealthCreated).toBe(fifteen.metrics.wealthCreated)
    expect(fifteen.projection.propertyValue).toBeGreaterThan(five.projection.propertyValue)
    expect(fifteen.projection.monthlyRent).toBeGreaterThan(five.projection.monthlyRent)
    expect(fifteen.projection.cumulativeCosts).toBeGreaterThan(five.projection.cumulativeCosts)
    expect(fifteen.projection.cumulativeNetIncome).toBeGreaterThan(five.projection.cumulativeNetIncome)
    expect(fifteen.projection.cumulativeAppreciation).toBeGreaterThan(five.projection.cumulativeAppreciation)
    expect(fifteen.projection.debt).toBeLessThan(five.projection.debt)
    expect(five.projectionPoints).toHaveLength(60)
  })

  it('normalizes fixed-direction manual amounts so UI entry cannot silently invert tax or refinance cash', () => {
    expect(signedPerformanceAmount('tax', 1200)).toBe(-1200)
    expect(signedPerformanceAmount('refinance_cash', -9000)).toBe(9000)
    expect(signedPerformanceAmount('other', -250)).toBe(-250)
  })
})
