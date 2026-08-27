import { describe, expect, it } from 'vitest'
import { projectPortfolio, propertiesWithProjectedLoanEvents } from './calculations.js'
import { projectTimeToNextBtl } from './nextBtlProjection.js'

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

describe('projectPortfolio loan-event semantics', () => {
  it('does not enlarge the loan until the monthly period after the release event', () => {
    const event = { propertyId: 'p1', month: 6, loanDelta: 20000 }
    expect(propertiesWithProjectedLoanEvents([property], [event], 6)[0].loanAmount).toBe(120000)
    expect(propertiesWithProjectedLoanEvents([property], [event], 7)[0].loanAmount).toBe(140000)
  })

  it('leaves the event-month accumulated cash unchanged but lowers cash afterward', () => {
    const now = new Date('2026-07-15T12:00:00')
    const baseline = projectPortfolio([property], settings, 8, now)
    const withReleaseDebt = projectPortfolio([property], settings, 8, now, {
      loanEvents: [{ propertyId: 'p1', month: 6, loanDelta: 20000 }],
    })
    expect(withReleaseDebt[6].scenarios[0].cashPot).toBeCloseTo(baseline[6].scenarios[0].cashPot, 8)
    expect(withReleaseDebt[7].scenarios[0].cashPot).toBeLessThan(baseline[7].scenarios[0].cashPot)
  })
})

describe('Time-to-next-BTL realistic release mode', () => {
  const common = {
    properties: [property],
    settings,
    portfolio: {
      cashHeld: 0,
      fixedCosts: 600,
      variableCosts: 0,
    },
    targetPriceToday: 500000,
    annualAppreciationRate: 0,
    acquisitionAssumptions: assumptions,
    equityReleaseSelections: { p1: { enabled: true, targetLtv: .70 } },
    preserveBuffer: false,
    maxMonths: 12,
    now: new Date('2026-07-15T12:00:00'),
  }

  it('preserves current Smooth availability while Realistic gates release to remortgage month', () => {
    const smooth = projectTimeToNextBtl({ ...common, equityReleaseMode: 'smooth' })
    const realistic = projectTimeToNextBtl({ ...common, equityReleaseMode: 'realistic' })

    expect(smooth.points[0].potentialEquityRelease).toBe(20000)
    expect(realistic.points[0].potentialEquityRelease).toBe(0)
    expect(realistic.points[5].potentialEquityRelease).toBe(0)
    expect(realistic.points[6].potentialEquityRelease).toBe(20000)
    expect(realistic.equityReleaseEvents).toHaveLength(1)
    expect(realistic.equityReleaseEvents[0]).toMatchObject({ propertyName: 'BTL1', month: 6, release: 20000 })
  })

  it('has weaker retained cash after release because the existing loan is larger', () => {
    const realistic = projectTimeToNextBtl({ ...common, equityReleaseMode: 'realistic' })
    const noDebtDragProjection = projectPortfolio([property], settings, 12, common.now)
    const unrealisticallyFreeDebt = projectTimeToNextBtl({
      ...common,
      equityReleaseMode: 'realistic',
      projectionPoints: noDebtDragProjection,
    })

    // Realistic mode intentionally regenerates projection points with loan events,
    // so supplied smooth points must not bypass the financing drag.
    expect(realistic.points[7].availableCash).toBeLessThan(realistic.points[6].availableCash + 20000 + 2000)
    expect(realistic.equityReleaseMode).toBe('realistic')
    expect(unrealisticallyFreeDebt.points[7].availableCash).toBe(realistic.points[7].availableCash)
  })
})
