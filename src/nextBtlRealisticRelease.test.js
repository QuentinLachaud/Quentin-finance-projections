import { describe, expect, it } from 'vitest'
import { acquisitionCosts } from './acquisitionEngine.js'
import { cumulativeProjectedCash, projectTimeToNextBtl } from './nextBtlProjection.js'
import { projectPortfolio, propertiesWithProjectedLoanEvents } from './calculations.js'

const property = {
  id: 'p1',
  name: 'BTL1',
  active: true,
  latestValuation: 200000,
  homeReportPurchase: 200000,
  loanAmount: 120000,
  baseRate: .06,
  latestRemortgage: '2026-01-01',
  fixedRateMonths: 12,
  rent: 1500,
  factorsFees: 0,
  legionella: 0,
  gasCertificate: 0,
  eicr: 0,
  repairs: 0,
  applianceReserve: 0,
  voidsOverride: 0,
}

const settings = {
  accountType: 'company',
  cashHeld: 0,
  bufferMonths: 0,
  rateShock: 0,
  appreciationRate: 0,
  fullyManaged: false,
  managementRate: 0,
  companyCosts: [],
  extractions: [],
  accountingPeriodMonths: 12,
  associatedCompanies: 0,
}

const assumptions = {
  jurisdiction: 'scotland',
  ltv: 75,
  adsRate: 0,
  legalFees: 0,
  mortgageFee: 0,
  mortgageFeeAddedToLoan: true,
}

const now = new Date('2026-07-15T12:00:00')
const basePortfolio = {
  cashHeld: 0,
  fixedCosts: 600,
  variableCosts: 0,
}

describe('projectPortfolio loan-event semantics', () => {
  it('does not enlarge the loan until the monthly period after execution', () => {
    const event = { propertyId: 'p1', month: 7, loanDelta: 20000 }
    expect(propertiesWithProjectedLoanEvents([property], [event], 7)[0].loanAmount).toBe(120000)
    expect(propertiesWithProjectedLoanEvents([property], [event], 8)[0].loanAmount).toBe(140000)
  })
})

describe('purchase-triggered Realistic Time to next BTL', () => {
  const common = {
    properties: [property],
    settings,
    portfolio: basePortfolio,
    annualAppreciationRate: 0,
    acquisitionAssumptions: assumptions,
    equityReleaseSelections: { p1: { enabled: true, targetLtv: .70 } },
    preserveBuffer: false,
    maxMonths: 18,
    now,
  }

  it('does NOT refinance merely at the remortgage gate when the release cannot fund the purchase', () => {
    const result = projectTimeToNextBtl({
      ...common,
      targetPriceToday: 500000,
      equityReleaseMode: 'realistic',
      maxMonths: 12,
    })

    expect(result.equityReleaseSchedule[0].eligibleFromMonth).toBe(6)
    expect(result.equityReleaseEvents).toEqual([])
    expect(result.points.every((point) => point.potentialEquityRelease === 0)).toBe(true)

    const baseline = projectPortfolio([property], settings, 12, now)
    for (let month = 0; month <= 12; month += 1) {
      const baselineCash = cumulativeProjectedCash({
        projectionPoint: baseline[month],
        scenarioIndex: 0,
        includeExtraction: false,
        startingCashHeld: 0,
        isCompany: true,
      })
      expect(result.points[month].availableCash).toBeCloseTo(Math.max(0, baselineCash), 7)
    }
  })

  it('waits beyond eligibility and releases only in the month it actually makes the purchase affordable', () => {
    const result = projectTimeToNextBtl({
      ...common,
      targetPriceToday: 100000,
      equityReleaseMode: 'realistic',
    })

    expect(result.equityReleaseSchedule[0].eligibleFromMonth).toBe(6)
    expect(result.equityReleaseEvents).toHaveLength(1)
    const event = result.equityReleaseEvents[0]
    expect(event.month).toBeGreaterThanOrEqual(6)
    expect(result.crossing?.month).toBe(event.month)
    expect(result.points.slice(0, event.month).every((point) => point.potentialEquityRelease === 0)).toBe(true)
    expect(result.points[event.month].potentialEquityRelease).toBeCloseTo(event.release, 7)

    const withoutReleaseCash = result.points[event.month].availableCash - event.release
    expect(withoutReleaseCash).toBeLessThan(result.points[event.month].cashRequired)
    expect(result.points[event.month].availableCash).toBeGreaterThanOrEqual(result.points[event.month].cashRequired)
  })

  it('does not refinance if accumulated cash alone reaches the target first', () => {
    const result = projectTimeToNextBtl({
      ...common,
      targetPriceToday: 15000,
      equityReleaseMode: 'realistic',
    })
    expect(result.crossing).not.toBeNull()
    expect(result.equityReleaseEvents).toEqual([])
    expect(result.points[result.crossing.month].potentialEquityRelease).toBe(0)
  })

  it('applies financing drag only after the purchase-enabling execution month', () => {
    const result = projectTimeToNextBtl({
      ...common,
      targetPriceToday: 100000,
      equityReleaseMode: 'realistic',
    })
    const event = result.equityReleaseEvents[0]
    expect(event).toBeTruthy()

    const baseline = projectPortfolio([property], settings, 18, now)
    const baselineAtEvent = cumulativeProjectedCash({
      projectionPoint: baseline[event.month],
      scenarioIndex: 0,
      startingCashHeld: 0,
      isCompany: true,
    })
    const baselineAfter = cumulativeProjectedCash({
      projectionPoint: baseline[event.month + 1],
      scenarioIndex: 0,
      startingCashHeld: 0,
      isCompany: true,
    })

    expect(result.points[event.month].availableCash - event.release).toBeCloseTo(baselineAtEvent, 7)
    expect(result.points[event.month + 1].availableCash - event.release).toBeLessThan(baselineAfter)
  })

  it('leaves Smooth continuous equity-release behavior unchanged', () => {
    const smooth = projectTimeToNextBtl({
      ...common,
      targetPriceToday: 500000,
      equityReleaseMode: 'smooth',
      maxMonths: 12,
    })
    expect(smooth.points[0].potentialEquityRelease).toBe(20000)
    expect(smooth.points[6].potentialEquityRelease).toBe(20000)
    expect(smooth.equityReleaseEvents).toEqual([])
  })

  it('can execute two eligible releases together when neither can cover the shortfall alone', () => {
    const p2 = {
      ...property,
      id: 'p2',
      name: 'BTL2',
      latestValuation: 200000,
      loanAmount: 125000,
      latestRemortgage: '2026-01-01',
    }
    const two = projectTimeToNextBtl({
      ...common,
      properties: [property, p2],
      targetPriceToday: 170000,
      equityReleaseMode: 'realistic',
      equityReleaseSelections: {
        p1: { enabled: true, targetLtv: .70 },
        p2: { enabled: true, targetLtv: .70 },
      },
    })
    expect(two.equityReleaseEvents.length).toBeGreaterThanOrEqual(1)
    const totalRelease = two.equityReleaseEvents.reduce((sum, event) => sum + event.release, 0)
    const crossing = two.crossing
    expect(crossing).not.toBeNull()
    expect(crossing.potentialEquityRelease).toBeCloseTo(totalRelease, 7)
    expect(two.equityReleaseEvents.every((event) => event.month === crossing.month)).toBe(true)

    const cashWithoutRelease = crossing.availableCash - totalRelease
    const shortfall = crossing.cashRequired - cashWithoutRelease
    expect(totalRelease + 1e-7).toBeGreaterThanOrEqual(shortfall)
  })
})
