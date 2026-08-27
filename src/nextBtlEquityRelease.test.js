import { describe, expect, it } from 'vitest'
import { buildNextBtlProjection, projectTimeToNextBtl } from './nextBtlProjection.js'

const cashOnlyPurchase = { jurisdiction: 'scotland', ltv: 75, adsRate: 0, legalFees: 0, mortgageFee: 0, mortgageFeeAddedToLoan: true }
const property = { id: 'btl1', name: 'BTL1', latestValuation: 200000, loanAmount: 120000 }
const portfolio = { cashHeld: 11000, fixedCosts: 600, variableCosts: 400 }
const flatProjection = (months, cashHeld = 11000) => Array.from({ length: months + 1 }, (_, month) => ({
  month,
  scenarios: [0, 1, 2].map(() => ({ cashPot: cashHeld, cashflow: 0 })),
}))

describe('Time to next BTL potential equity-release integration', () => {
  it('preserves baseline deployable cash when no BTL is selected', () => {
    const result = projectTimeToNextBtl({
      properties: [property],
      settings: { accountType: 'company', cashHeld: 11000, appreciationRate: .05 },
      portfolio,
      projectionPoints: flatProjection(1),
      targetPriceToday: 100000,
      annualAppreciationRate: 0,
      acquisitionAssumptions: cashOnlyPurchase,
      preserveBuffer: true,
      equityReleaseSelections: {},
      maxMonths: 1,
    })
    expect(result.startingSurplus).toBe(5000)
    expect(result.equityReleaseNow).toBe(0)
    expect(result.equityReleaseSelectedCount).toBe(0)
    expect(result.points[0].availableCash).toBe(5000)
    expect(result.points[0].potentialEquityRelease).toBe(0)
  })

  it('can make an otherwise unaffordable month-zero target Ready now', () => {
    const baseline = projectTimeToNextBtl({
      properties: [property], settings: { accountType: 'company', cashHeld: 11000, appreciationRate: .03 }, portfolio,
      projectionPoints: flatProjection(0), targetPriceToday: 100000, annualAppreciationRate: 0,
      acquisitionAssumptions: cashOnlyPurchase, preserveBuffer: true, maxMonths: 0,
    })
    const released = projectTimeToNextBtl({
      properties: [property], settings: { accountType: 'company', cashHeld: 11000, appreciationRate: .03 }, portfolio,
      projectionPoints: flatProjection(0), targetPriceToday: 100000, annualAppreciationRate: 0,
      acquisitionAssumptions: cashOnlyPurchase, preserveBuffer: true, maxMonths: 0,
      equityReleaseSelections: { btl1: { enabled: true, targetLtv: .70 } },
    })
    expect(baseline.status).toBe('not-reached')
    expect(released.status).toBe('ready')
    expect(released.equityReleaseNow).toBe(20000)
    expect(released.points[0].availableCash).toBe(25000)
    expect(released.startingSurplus).toBe(5000)
    expect(released.reserveCash).toBe(6000)
  })

  it('treats release as month-specific capacity rather than cumulatively double-counting it', () => {
    const result = buildNextBtlProjection({
      targetPriceToday: 1000000,
      annualAppreciationRate: 0,
      acquisitionAssumptions: cashOnlyPurchase,
      startingSurplus: 0,
      cumulativeCashByMonth: [0, 1000, 2000],
      potentialEquityReleaseByMonth: [10000, 11000, 12000],
      maxMonths: 2,
    })
    expect(result.points.map((point) => point.availableCash)).toEqual([10000, 12000, 14000])
  })

  it('allows release to appear later as Portfolio appreciation lowers effective LTV', () => {
    const highDebt = { ...property, loanAmount: 150000 }
    const result = projectTimeToNextBtl({
      properties: [highDebt],
      settings: { accountType: 'company', cashHeld: 0, appreciationRate: .10 },
      portfolio: { cashHeld: 0, fixedCosts: 0, variableCosts: 0 },
      projectionPoints: flatProjection(12, 0),
      targetPriceToday: 1000000,
      annualAppreciationRate: 0,
      acquisitionAssumptions: cashOnlyPurchase,
      preserveBuffer: false,
      equityReleaseSelections: { btl1: { enabled: true, targetLtv: .70 } },
      maxMonths: 12,
    })
    expect(result.points[0].potentialEquityRelease).toBe(0)
    expect(result.points[12].potentialEquityRelease).toBeCloseTo(4000, 7)
  })

  it('uses Portfolio appreciation for owned BTLs independently of target-BTL appreciation', () => {
    const result = projectTimeToNextBtl({
      properties: [property],
      settings: { accountType: 'company', cashHeld: 0, appreciationRate: .05 },
      portfolio: { cashHeld: 0, fixedCosts: 0, variableCosts: 0 },
      projectionPoints: flatProjection(12, 0),
      targetPriceToday: 500000,
      annualAppreciationRate: .20,
      acquisitionAssumptions: cashOnlyPurchase,
      preserveBuffer: false,
      equityReleaseSelections: { btl1: { enabled: true, targetLtv: .70 } },
      maxMonths: 12,
    })
    expect(result.points[12].potentialEquityRelease).toBeCloseTo(27000, 7)
    expect(result.points[12].targetPrice).toBeCloseTo(600000, 7)
  })

  it('supports custom per-property LTVs and sums multiple selected BTLs', () => {
    const second = { id: 'btl2', name: 'BTL2', latestValuation: 100000, loanAmount: 50000 }
    const result = projectTimeToNextBtl({
      properties: [property, second],
      settings: { accountType: 'company', cashHeld: 0, appreciationRate: 0 },
      portfolio: { cashHeld: 0, fixedCosts: 0, variableCosts: 0 },
      projectionPoints: flatProjection(0, 0),
      targetPriceToday: 1000000,
      annualAppreciationRate: 0,
      acquisitionAssumptions: cashOnlyPurchase,
      preserveBuffer: false,
      equityReleaseSelections: {
        btl1: { enabled: true, targetLtv: .75 },
        btl2: { enabled: true, targetLtv: .70 },
      },
      maxMonths: 0,
    })
    expect(result.equityReleaseSelectedCount).toBe(2)
    expect(result.equityReleaseNow).toBe(50000)
    expect(result.points[0].potentialEquityRelease).toBe(50000)
    expect(result.points[0].availableCash).toBe(50000)
  })
})
