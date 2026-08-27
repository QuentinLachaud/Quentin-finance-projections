import { describe, expect, it } from 'vitest'
import { projectPortfolio, projectedRentAtMonth } from './calculations.js'

const property = {
  id: 'btl-1',
  name: 'BTL1',
  active: true,
  rent: 1000,
  loanAmount: 0,
  latestValuation: 100000,
  homeReportPurchase: 100000,
  baseRate: 0,
  fixedRateMonths: 24,
  factorsFees: 0,
  legionella: 0,
  gasCertificate: 0,
  eicr: 0,
  repairs: 0,
  applianceReserve: 0,
  mortgageAdmin: 0,
  voidsOverride: '',
}

const settings = {
  accountType: 'company',
  appreciationRate: 0,
  rentGrowthRate: 0.02,
  rateShock: 0,
  cashHeld: 0,
  bufferMonths: 0,
  managementRate: 0,
  fullyManaged: false,
  companyCosts: [],
  extractions: [],
  accountingPeriodMonths: 12,
}

describe('rental growth projections', () => {
  it('compounds annual rent growth without changing month zero', () => {
    expect(projectedRentAtMonth(1000, 0.02, 0)).toBeCloseTo(1000, 8)
    expect(projectedRentAtMonth(1000, 0.02, 12)).toBeCloseTo(1020, 8)
    expect(projectedRentAtMonth(1000, 0.02, 60)).toBeCloseTo(1000 * (1.02 ** 5), 8)
  })

  it('feeds grown rent through projectPortfolio and keeps flat-rent mode flat', () => {
    const growing = projectPortfolio([property], settings, 12, new Date('2026-01-01T12:00:00'))
    const flat = projectPortfolio([property], { ...settings, rentGrowthRate: 0 }, 12, new Date('2026-01-01T12:00:00'))

    expect(growing[0].rent).toBeCloseTo(1000, 8)
    expect(growing[12].rent).toBeCloseTo(1020, 8)
    expect(flat[0].rent).toBeCloseTo(1000, 8)
    expect(flat[12].rent).toBeCloseTo(1000, 8)
    expect(growing[12].scenarios[0].cashPot).toBeGreaterThan(flat[12].scenarios[0].cashPot)
  })

  it('supports negative growth above -100%', () => {
    expect(projectedRentAtMonth(1000, -0.1, 12)).toBeCloseTo(900, 8)
  })
})
