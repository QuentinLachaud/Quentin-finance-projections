import { describe, expect, it } from 'vitest'
import {
  activePerformanceUpdate,
  applyPerformanceUpdate,
  buildActualBankCashflowSeries,
  buildTheoreticalPerformanceProjection,
  niceCurrencyAxis,
  normalizePerformanceUpdates,
  performanceAnchorForProperty,
  performanceXAxisTicks,
  resolvePerformanceAssumptions,
  validatePerformanceUpdate,
} from './performanceForecast.js'

const property = {
  id: 'p1', name: 'BTL1', active: true, purchaseDate: '2020-01-15', latestValuation: 240000, purchasePrice: 200000,
  rent: 1200, loanAmount: 150000, mortgageInterestOnly: true, mortgageTermMonths: 300,
  baseRate: 0.04, factorsFees: 0, repairs: 65, applianceReserve: 0, legionella: 0,
  gasCertificate: 0, eicr: 0, fixedRateMonths: 60,
}
const second = {
  ...property, id: 'p2', name: 'BTL2', purchaseDate: '2025-02-10',
  latestValuation: 160000, purchasePrice: 150000, rent: 900, loanAmount: 100000,
}
const settings = {
  accountType: 'company', rentGrowthRate: 0.02, appreciationRate: 0.03, rateShock: 0,
  managementRate: 0, fullyManaged: false, companyCosts: [], extractions: [], bufferMonths: 6,
  associatedCompanies: 0, accountingPeriodMonths: 12,
}
const now = new Date('2026-09-06T12:00:00Z')

describe('Performance history + forecast model', () => {
  it('uses current inclusive update ranges as anchors but ignores expired history for today', () => {
    const updates = [
      { id: 'old', kind: 'rent', propertyId: 'p1', value: 1000, startMonth: '2023-08', endMonth: '2025-12', order: 0 },
      { id: 'current', kind: 'rent', propertyId: 'p1', value: 1350, startMonth: '2026-01', endMonth: '2026-09', order: 1 },
      { id: 'value', kind: 'valuation', propertyId: 'p1', value: 255000, startMonth: '2026-09', endMonth: '', order: 2 },
    ]
    expect(activePerformanceUpdate(updates, 'p1', 'rent', '2026-09')?.id).toBe('current')
    expect(activePerformanceUpdate(updates, 'p1', 'rent', '2026-10')).toBeNull()
    expect(performanceAnchorForProperty(property, updates, '2026-09')).toMatchObject({
      rent: 1350, value: 255000, rentSource: 'update', valueSource: 'update',
    })
  })

  it('lets a new update override overlap by trimming/splitting the older range automatically', () => {
    const updates = [
      { id: 'old', kind: 'valuation', propertyId: 'p1', value: 225000, startMonth: '2025-02', endMonth: '', order: 0 },
    ]
    const incoming = {
      id: 'new', kind: 'valuation', propertyId: 'p1', value: 261954,
      startMonth: '2026-07', endMonth: '', order: 1,
    }
    expect(validatePerformanceUpdate(incoming, updates, [property])).toBe('')
    const applied = applyPerformanceUpdate(updates, incoming, [property])
    expect(applied).toHaveLength(2)
    expect(applied.find((entry) => entry.id.startsWith('old:before:new'))).toMatchObject({
      startMonth: '2025-02', endMonth: '2026-06', value: 225000,
    })
    expect(applied.find((entry) => entry.id === 'new')).toMatchObject({
      startMonth: '2026-07', endMonth: '', value: 261954,
    })

    const bounded = applyPerformanceUpdate([
      { id: 'wide', kind: 'rent', propertyId: 'p1', value: 1000, startMonth: '2025-01', endMonth: '2026-12', order: 0 },
    ], {
      id: 'middle', kind: 'rent', propertyId: 'p1', value: 1100, startMonth: '2026-04', endMonth: '2026-06', order: 1,
    }, [property])
    expect(bounded.map((entry) => [entry.startMonth, entry.endMonth, entry.value])).toEqual([
      ['2025-01', '2026-03', 1000],
      ['2026-07', '2026-12', 1000],
      ['2026-04', '2026-06', 1100],
    ])
  })

  it('starts at the earliest purchase, keeps today exact, and compounds only the future from today', () => {
    const model = buildTheoreticalPerformanceProjection({
      properties: [property], settings, scope: 'p1', scenarioId: 0, horizonYears: 1, now,
    })
    expect(model.startMonth).toBe('2020-01')
    expect(model.points[0].date).toBe('2020-01')
    expect(model.points[0].assetValue).toBeCloseTo(200000, 6)

    const today = model.points.find((point) => point.date === '2026-09')
    const oneYear = model.points.find((point) => point.date === '2027-09')
    expect(today.assetValue).toBeCloseTo(240000, 6)
    expect(today.monthlyRent).toBeCloseTo(1200, 6)
    expect(today.cashAccumulation).toBe(0)
    expect(oneYear.assetValue).toBeCloseTo(240000 * 1.03, 4)
    expect(oneYear.monthlyRent).toBeCloseTo(1200 * 1.02, 4)
    expect(oneYear.cashAccumulation).toBeGreaterThan(0)
  })

  it('uses recorded historical valuation/rent ranges instead of inventing interpolation', () => {
    const recorded = {
      ...settings,
      performanceUpdates: [
        { id: 'rent-old', kind: 'rent', propertyId: 'p1', value: 900, startMonth: '2020-01', endMonth: '2023-12', order: 0 },
        { id: 'value-old', kind: 'valuation', propertyId: 'p1', value: 215000, startMonth: '2022-01', endMonth: '2024-12', order: 1 },
      ],
    }
    const model = buildTheoreticalPerformanceProjection({ properties: [property], settings: recorded, scope: 'p1', horizonYears: 1, now })
    expect(model.points.find((point) => point.date === '2021-06').monthlyRent).toBe(900)
    expect(model.points.find((point) => point.date === '2023-06').assetValue).toBe(215000)
    expect(model.points.find((point) => point.date === '2025-06').assetValue).toBe(200000)
  })

  it('preserves canonical scenario ordering at today', () => {
    const flows = [0, 1, 2].map((scenarioId) => {
      const model = buildTheoreticalPerformanceProjection({ properties: [property], settings, scope: 'portfolio', scenarioId, horizonYears: 1, now })
      return model.points[model.todayIndex].monthlyCashflow
    })
    expect(flows[0]).toBeLessThanOrEqual(flows[1])
    expect(flows[1]).toBeLessThanOrEqual(flows[2])
  })

  it('applies rate shock additively only from the configured future month', () => {
    const shockSettings = { ...settings, rateShock: 0.007, performanceRateShockStartMonth: '2027-01' }
    const model = buildTheoreticalPerformanceProjection({ properties: [property], settings: shockSettings, scope: 'portfolio', horizonYears: 1, now })
    expect(model.points.find((point) => point.date === '2026-12').rateShockApplied).toBe(0)
    expect(model.points.find((point) => point.date === '2027-01').rateShockApplied).toBeCloseTo(0.007, 10)
    expect(model.points.find((point) => point.date === '2025-01').rateShockApplied).toBe(0)
  })

  it('supports BTL-specific assumptions without contaminating portfolio inputs', () => {
    const scoped = {
      ...settings,
      performanceModelOverrides: {
        p1: { rentGrowthRate: 0.05, appreciationRate: 0.06, rateShock: 0.01, rateShockStartMonth: '2027-02' },
      },
    }
    expect(resolvePerformanceAssumptions(scoped, 'portfolio').rentGrowthRate).toBe(0.02)
    expect(resolvePerformanceAssumptions(scoped, 'p1')).toMatchObject({
      rentGrowthRate: 0.05, appreciationRate: 0.06, rateShock: 0.01, rateShockStartMonth: '2027-02',
    })
  })

  it('switches theoretical portfolio cash flow between extraction-excluded and bank-movement semantics', () => {
    const withExtraction = { ...settings, extractions: [{ id: 'salary', amount: 250, enabled: true, taxDeductible: false }] }
    const trueCompany = buildTheoreticalPerformanceProjection({
      properties: [property], settings: withExtraction, scope: 'portfolio', horizonYears: 1, excludeExtractions: true, now,
    })
    const bank = buildTheoreticalPerformanceProjection({
      properties: [property], settings: withExtraction, scope: 'portfolio', horizonYears: 1, excludeExtractions: false, now,
    })
    expect(trueCompany.points[trueCompany.todayIndex].monthlyCashflow - bank.points[bank.todayIndex].monthlyCashflow).toBeCloseTo(250, 5)
  })

  it('aggregates portfolio history from the first property purchase while isolating BTL scope', () => {
    const portfolio = buildTheoreticalPerformanceProjection({ properties: [property, second], settings, scope: 'portfolio', horizonYears: 1, now })
    const single = buildTheoreticalPerformanceProjection({ properties: [property, second], settings, scope: 'p2', horizonYears: 1, now })
    expect(portfolio.startMonth).toBe('2020-01')
    expect(single.startMonth).toBe('2025-02')
    expect(portfolio.points[portfolio.todayIndex].assetValue).toBeCloseTo(400000, 6)
    expect(single.points[single.todayIndex].assetValue).toBeCloseTo(160000, 6)
  })

  it('builds actual monthly Banking cash flow using Banking analysis exclusions and property assignment', () => {
    const transactions = [
      { id: 'a', bookedAt: '2026-07-02', amount: 1000, status: 'booked', propertyId: 'p1', category: 'rent' },
      { id: 'b', bookedAt: '2026-07-08', amount: -300, status: 'booked', propertyId: 'p1', category: 'repairs' },
      { id: 'c', bookedAt: '2026-08-01', amount: 500, status: 'booked', propertyId: 'p2', category: 'rent' },
      { id: 'x', bookedAt: '2026-08-02', amount: -500, status: 'booked', propertyId: 'p2', category: 'transfer', isTransfer: true, transferConfirmed: true },
      { id: 'e', bookedAt: '2026-08-03', amount: -50, status: 'booked', excludeFromPerformance: true, category: 'other' },
      { id: 'p', bookedAt: '2026-08-04', amount: 999, status: 'pending', category: 'rent' },
    ]
    expect(buildActualBankCashflowSeries({ transactions, scope: 'portfolio' })).toEqual([
      { date: '2026-07', value: 700 },
      { date: '2026-08', value: 500 },
    ])
    expect(buildActualBankCashflowSeries({ transactions, scope: 'p1' })).toEqual([
      { date: '2026-07', value: 700 },
    ])
  })

  it('generates rounded currency axes and adaptive date labels across historical + forecast spans', () => {
    const axis = niceCurrencyAxis([112300, 241900], 5)
    const normalizedStep = axis.step / (10 ** Math.floor(Math.log10(axis.step)))
    expect([1, 2, 5, 10]).toContain(normalizedStep)
    const oneYear = buildTheoreticalPerformanceProjection({ properties: [{ ...property, purchaseDate: '2026-01-01' }], settings, scope: 'p1', horizonYears: 1, now })
    expect(performanceXAxisTicks(oneYear.points).some((tick) => /[A-Z][a-z]{2} \d{2}/.test(tick.label))).toBe(true)
    const tenYears = buildTheoreticalPerformanceProjection({ properties: [property], settings, scope: 'p1', horizonYears: 10, now })
    expect(performanceXAxisTicks(tenYears.points).every((tick) => /^\d{4}$/.test(tick.label))).toBe(true)
  })

  it('keeps persisted display order deterministic after automatic overlap resolution', () => {
    const updates = [{ id: 'a', kind: 'rent', propertyId: 'p1', value: 1100, startMonth: '2026-01', endMonth: '2026-06', order: 8 }]
    expect(validatePerformanceUpdate({ id: 'b', kind: 'rent', propertyId: 'p1', value: -1, startMonth: '2026-07', endMonth: '2026-08' }, updates, [property])).toContain('above £0')
    expect(normalizePerformanceUpdates(updates, [property])[0].order).toBe(0)
  })
})
