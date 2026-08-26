import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NEXT_BTL_MAX_MONTHS,
  buildNextBtlProjection,
  cumulativeProjectedCash,
  formatDurationMonths,
  formatProjectionMonth,
  projectTimeToNextBtl,
  startingSurplusCash,
  targetPriceAtMonth,
} from './nextBtlProjection.js'

const scotlandCashOnly = { jurisdiction: 'scotland', ltv: 75, adsRate: 0, legalFees: 0, mortgageFee: 0, mortgageFeeAddedToLoan: true }

const projectionPoints = (months, { startingCash = 8000, bankPerMonth = 5000, totalPerMonth = 6500 } = {}) => Array.from({ length: months + 1 }, (_, month) => ({
  month,
  scenarios: [0, 1, 2].map(() => ({ cashPot: startingCash + bankPerMonth * month, cashflow: totalPerMonth * month })),
}))

describe('Time-to-BTL primitives', () => {
  it('compounds target BTL appreciation and lands exactly on the annual rate at month 12', () => {
    expect(targetPriceAtMonth(180000, .0325, 0)).toBe(180000)
    expect(targetPriceAtMonth(180000, .0325, 12)).toBeCloseTo(185850, 8)
    expect(targetPriceAtMonth(180000, 0, 120)).toBe(180000)
  })

  it('calculates deployable cash above an exact six-month operating buffer', () => {
    expect(startingSurplusCash({ cashHeld: 5000, monthlyOperatingCosts: 1000, preserveBuffer: true })).toBe(0)
    expect(startingSurplusCash({ cashHeld: 6000, monthlyOperatingCosts: 1000, preserveBuffer: true })).toBe(0)
    expect(startingSurplusCash({ cashHeld: 8000, monthlyOperatingCosts: 1000, preserveBuffer: true })).toBe(2000)
    expect(startingSurplusCash({ cashHeld: 8000, monthlyOperatingCosts: 1000, preserveBuffer: false })).toBe(8000)
  })

  it('uses retained bank cash or company+extraction cash without counting starting cash twice', () => {
    const point = { scenarios: [{ cashPot: 10500, cashflow: 800 }] }
    expect(cumulativeProjectedCash({ projectionPoint: point, scenarioIndex: 0, includeExtraction: false, startingCashHeld: 10000, isCompany: true })).toBe(500)
    expect(cumulativeProjectedCash({ projectionPoint: point, scenarioIndex: 0, includeExtraction: true, startingCashHeld: 10000, isCompany: true })).toBe(800)
    expect(cumulativeProjectedCash({ projectionPoint: point, scenarioIndex: 0, includeExtraction: true, startingCashHeld: 10000, isCompany: false })).toBe(500)
  })

  it('formats human durations and calendar months deterministically', () => {
    expect(formatDurationMonths(31)).toBe('2 years 7 months')
    expect(formatDurationMonths(12)).toBe('1 year')
    expect(formatDurationMonths(1)).toBe('1 month')
    expect(formatProjectionMonth(new Date('2029-03-01T12:00:00'))).toBe('March 2029')
  })
})

describe('pure Time-to-BTL crossing model', () => {
  it('finds a known exact crossing month from cumulative cash', () => {
    const result = buildNextBtlProjection({
      targetPriceToday: 100000,
      annualAppreciationRate: 0,
      acquisitionAssumptions: scotlandCashOnly,
      startingSurplus: 0,
      cumulativeCashByMonth: Array.from({ length: 13 }, (_, month) => month * 5000),
      startDate: new Date('2026-01-15T12:00:00'),
      maxMonths: 12,
    })
    expect(result.status).toBe('reached')
    expect(result.crossing.month).toBe(5)
    expect(result.crossing.cashRequired).toBe(25000)
    expect(result.crossing.buyingPower).toBeGreaterThanOrEqual(100000)
  })

  it('reports Ready now when month-zero surplus already funds the acquisition', () => {
    const result = buildNextBtlProjection({ targetPriceToday: 100000, annualAppreciationRate: 0, acquisitionAssumptions: scotlandCashOnly, startingSurplus: 25000, cumulativeCashByMonth: [0], maxMonths: 0 })
    expect(result.status).toBe('ready')
    expect(result.crossing.month).toBe(0)
  })

  it('returns a finite not-reached result when appreciation outruns zero accumulation', () => {
    const result = buildNextBtlProjection({
      targetPriceToday: 180000,
      annualAppreciationRate: .2,
      acquisitionAssumptions: scotlandCashOnly,
      startingSurplus: 0,
      cumulativeCashByMonth: Array(DEFAULT_NEXT_BTL_MAX_MONTHS + 1).fill(0),
      maxMonths: DEFAULT_NEXT_BTL_MAX_MONTHS,
    })
    expect(result.status).toBe('not-reached')
    expect(result.crossing).toBeNull()
    expect(result.points).toHaveLength(601)
    for (const point of [result.points[0], result.points[120], result.points[600]]) {
      for (const key of ['availableCash','targetPrice','cashRequired','buyingPower']) expect(Number.isFinite(point[key])).toBe(true)
    }
  })

  it('recalculates canonical cash required as appreciation crosses a Scottish LBTT band', () => {
    const result = buildNextBtlProjection({
      targetPriceToday: 145000,
      annualAppreciationRate: .1,
      acquisitionAssumptions: { ...scotlandCashOnly, ltv: 100 },
      cumulativeCashByMonth: Array(13).fill(0),
      maxMonths: 12,
    })
    expect(result.points[0].cashRequired).toBe(0)
    expect(result.points[12].targetPrice).toBeCloseTo(159500, 6)
    expect(result.points[12].cashRequired).toBeGreaterThan(0)
  })
})

describe('portfolio adapter semantics', () => {
  const portfolio = { cashHeld: 8000, fixedCosts: 600, variableCosts: 400 }
  const settings = { accountType: 'company', cashHeld: 8000 }

  it('preserves six months first and then accumulates the selected retained-bank scenario', () => {
    const result = projectTimeToNextBtl({
      settings,
      portfolio,
      projectionPoints: projectionPoints(12),
      targetPriceToday: 100000,
      annualAppreciationRate: 0,
      acquisitionAssumptions: scotlandCashOnly,
      preserveBuffer: true,
      includeExtraction: false,
      maxMonths: 12,
      now: new Date('2026-01-15T12:00:00'),
    })
    expect(result.reserveCash).toBe(6000)
    expect(result.startingSurplus).toBe(2000)
    expect(result.crossing.month).toBe(5)
    expect(result.points[1].availableCash).toBe(7000)
  })

  it('uses company+extraction cumulative cash only when explicitly enabled', () => {
    const retained = projectTimeToNextBtl({ settings, portfolio, projectionPoints: projectionPoints(12), targetPriceToday: 100000, annualAppreciationRate: 0, acquisitionAssumptions: scotlandCashOnly, includeExtraction: false, preserveBuffer: true, maxMonths: 12 })
    const included = projectTimeToNextBtl({ settings, portfolio, projectionPoints: projectionPoints(12), targetPriceToday: 100000, annualAppreciationRate: 0, acquisitionAssumptions: scotlandCashOnly, includeExtraction: true, preserveBuffer: true, maxMonths: 12 })
    expect(retained.points[1].availableCash).toBe(7000)
    expect(included.points[1].availableCash).toBe(8500)
    expect(included.crossing.month).toBeLessThan(retained.crossing.month)
  })

  it('ignores extraction inclusion for private mode', () => {
    const privateSettings = { ...settings, accountType: 'private' }
    const result = projectTimeToNextBtl({ settings: privateSettings, portfolio, projectionPoints: projectionPoints(2), targetPriceToday: 100000, annualAppreciationRate: 0, acquisitionAssumptions: scotlandCashOnly, includeExtraction: true, preserveBuffer: false, maxMonths: 2 })
    expect(result.includeExtraction).toBe(false)
    expect(result.points[1].availableCash).toBe(13000)
  })
})
