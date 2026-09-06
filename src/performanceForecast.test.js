import { describe, expect, it } from 'vitest'
import {
  activePerformanceUpdate,
  buildTheoreticalPerformanceProjection,
  niceCurrencyAxis,
  normalizePerformanceUpdates,
  performanceAnchorForProperty,
  performanceXAxisTicks,
  resolvePerformanceAssumptions,
  validatePerformanceUpdate,
} from './performanceForecast.js'

const property = {
  id: 'p1', name: 'BTL1', active: true, latestValuation: 240000, purchasePrice: 200000,
  rent: 1200, loanAmount: 150000, mortgageInterestOnly: true, mortgageTermMonths: 300,
  baseRate: 0.04, factorsFees: 0, repairs: 65, applianceReserve: 0, legionella: 0,
  gasCertificate: 0, eicr: 0, fixedRateMonths: 60,
}
const second = { ...property, id: 'p2', name: 'BTL2', latestValuation: 160000, rent: 900, loanAmount: 100000 }
const settings = {
  accountType: 'company', rentGrowthRate: 0.02, appreciationRate: 0.03, rateShock: 0,
  managementRate: 0, fullyManaged: false, companyCosts: [], extractions: [], bufferMonths: 6,
  associatedCompanies: 0, accountingPeriodMonths: 12,
}
const now = new Date('2026-09-06T12:00:00Z')

describe('theoretical Performance forecast', () => {
  it('uses current inclusive update ranges as anchors but ignores expired history', () => {
    const updates = [
      { id: 'old', kind: 'rent', propertyId: 'p1', value: 1000, startMonth: '2023-08', endMonth: '2025-12', order: 0 },
      { id: 'current', kind: 'rent', propertyId: 'p1', value: 1350, startMonth: '2026-01', endMonth: '2026-09', order: 1 },
      { id: 'value', kind: 'valuation', propertyId: 'p1', value: 255000, startMonth: '2026-09', endMonth: '', order: 2 },
    ]
    expect(activePerformanceUpdate(updates, 'p1', 'rent', '2026-09')?.id).toBe('current')
    expect(activePerformanceUpdate(updates, 'p1', 'rent', '2026-10')).toBeNull()
    expect(performanceAnchorForProperty(property, updates, '2026-09')).toMatchObject({ rent: 1350, value: 255000, rentSource: 'update', valueSource: 'update' })
  })

  it('rejects invalid and overlapping ranges while keeping persisted order deterministic', () => {
    const updates = [{ id: 'a', kind: 'rent', propertyId: 'p1', value: 1100, startMonth: '2026-01', endMonth: '2026-06', order: 8 }]
    expect(validatePerformanceUpdate({ id: 'b', kind: 'rent', propertyId: 'p1', value: 1200, startMonth: '2026-06', endMonth: '2026-08' }, updates, [property])).toContain('overlaps')
    expect(validatePerformanceUpdate({ id: 'b', kind: 'rent', propertyId: 'p1', value: -1, startMonth: '2026-07', endMonth: '2026-08' }, updates, [property])).toContain('above £0')
    expect(normalizePerformanceUpdates(updates, [property])[0].order).toBe(0)
  })

  it('starts exactly from today anchors and compounds rent/HPI monthly', () => {
    const model = buildTheoreticalPerformanceProjection({ properties: [property], settings, scope: 'p1', scenarioId: 0, horizonYears: 1, now })
    expect(model.points[0].assetValue).toBeCloseTo(240000, 6)
    expect(model.points[0].monthlyRent).toBeCloseTo(1200, 6)
    expect(model.points[12].assetValue).toBeCloseTo(240000 * 1.03, 4)
    expect(model.points[12].monthlyRent).toBeCloseTo(1200 * 1.02, 4)
    expect(model.points[0].cashAccumulation).toBe(0)
    expect(model.points[1].cashAccumulation).toBeCloseTo(model.points[1].monthlyCashflow, 6)
  })

  it('preserves canonical scenario ordering for monthly cash flow', () => {
    const flows = [0, 1, 2].map((scenarioId) => buildTheoreticalPerformanceProjection({ properties: [property], settings, scope: 'portfolio', scenarioId, horizonYears: 1, now }).points[0].monthlyCashflow)
    expect(flows[0]).toBeLessThanOrEqual(flows[1])
    expect(flows[1]).toBeLessThanOrEqual(flows[2])
  })

  it('applies rate shock additively only from the configured month', () => {
    const shockSettings = { ...settings, rateShock: 0.007, performanceRateShockStartMonth: '2027-01' }
    const model = buildTheoreticalPerformanceProjection({ properties: [property], settings: shockSettings, scope: 'portfolio', horizonYears: 1, now })
    expect(model.points.find((point) => point.date === '2026-12').rateShockApplied).toBe(0)
    expect(model.points.find((point) => point.date === '2027-01').rateShockApplied).toBeCloseTo(0.007, 10)
    const immediate = buildTheoreticalPerformanceProjection({ properties: [property], settings: { ...settings, rateShock: 0.007 }, scope: 'portfolio', horizonYears: 1, now })
    expect(immediate.points[0].rateShockApplied).toBeCloseTo(0.007, 10)
  })

  it('supports BTL-specific assumptions without contaminating portfolio inputs', () => {
    const scoped = { ...settings, performanceModelOverrides: { p1: { rentGrowthRate: 0.05, appreciationRate: 0.06, rateShock: 0.01, rateShockStartMonth: '2027-02' } } }
    expect(resolvePerformanceAssumptions(scoped, 'portfolio').rentGrowthRate).toBe(0.02)
    expect(resolvePerformanceAssumptions(scoped, 'p1')).toMatchObject({ rentGrowthRate: 0.05, appreciationRate: 0.06, rateShock: 0.01, rateShockStartMonth: '2027-02' })
  })

  it('switches between true underlying company cash flow and extraction-reduced bank cash movement', () => {
    const withExtraction = { ...settings, extractions: [{ id: 'salary', amount: 250, enabled: true, taxDeductible: false }] }
    const trueCompany = buildTheoreticalPerformanceProjection({ properties: [property], settings: withExtraction, scope: 'portfolio', horizonYears: 1, excludeExtractions: true, now })
    const bank = buildTheoreticalPerformanceProjection({ properties: [property], settings: withExtraction, scope: 'portfolio', horizonYears: 1, excludeExtractions: false, now })
    expect(trueCompany.points[0].monthlyCashflow - bank.points[0].monthlyCashflow).toBeCloseTo(250, 5)
  })

  it('aggregates portfolio values while isolating individual BTL scope', () => {
    const portfolio = buildTheoreticalPerformanceProjection({ properties: [property, second], settings, scope: 'portfolio', horizonYears: 1, now })
    const single = buildTheoreticalPerformanceProjection({ properties: [property, second], settings, scope: 'p1', horizonYears: 1, now })
    expect(portfolio.points[0].assetValue).toBeCloseTo(400000, 6)
    expect(single.points[0].assetValue).toBeCloseTo(240000, 6)
    expect(single.points[0].debt).toBeCloseTo(150000, 6)
  })

  it('generates rounded 1/2/5 currency axes and adaptive date labels', () => {
    const axis = niceCurrencyAxis([112300, 241900], 5)
    const normalizedStep = axis.step / (10 ** Math.floor(Math.log10(axis.step)))
    expect([1, 2, 5, 10]).toContain(normalizedStep)
    const oneYear = buildTheoreticalPerformanceProjection({ properties: [property], settings, scope: 'p1', horizonYears: 1, now })
    expect(performanceXAxisTicks(oneYear.points, 1).some((tick) => /[A-Z][a-z]{2} \d{2}/.test(tick.label))).toBe(true)
    const tenYears = buildTheoreticalPerformanceProjection({ properties: [property], settings, scope: 'p1', horizonYears: 10, now })
    expect(performanceXAxisTicks(tenYears.points, 10).every((tick) => /^\d{4}$/.test(tick.label))).toBe(true)
  })
})
