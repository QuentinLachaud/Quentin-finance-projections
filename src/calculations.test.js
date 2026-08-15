import { describe, expect, it } from 'vitest'
import { assumptions } from './data.js'
import { amortizingPayment, calculatePortfolio, calculateProperty, projectPortfolio } from './calculations.js'

const fixedNow = new Date('2026-08-15T12:00:00')
const costs = { legionella: 2.75, gasCertificate: 8.33, eicr: 2.5, repairs: 50, applianceReserve: 13.33 }
const testProperties = [
  { id: 'one', name: 'BTL1', latestValuation: 261924, loanAmount: 181587, homeReportPurchase: 235000, rent: 1650, baseRate: 0.045, factorsFees: 150, fixedRateMonths: 24, latestRemortgage: '2025-02-28', purchaseDate: '2020-12-19', engineeredCost: 925, active: true, ...costs },
  { id: 'two', name: 'BTL2', latestValuation: 150018, loanAmount: 112307, homeReportPurchase: 145000, rent: 1100, baseRate: 0.045, factorsFees: 90, fixedRateMonths: 24, latestRemortgage: '2025-08-01', purchaseDate: '2025-08-29', engineeredCost: 0, active: true, ...costs },
  { id: 'three', name: 'BTL3', latestValuation: 184000, loanAmount: 138750, homeReportPurchase: 184000, rent: 1100, baseRate: 0.045, factorsFees: 90, fixedRateMonths: 24, latestRemortgage: '2024-11-20', purchaseDate: '2025-08-29', engineeredCost: 0, active: true, ...costs },
]

describe('Quark sheet calculations', () => {
  it('matches the sheet mortgage and headline metrics for BTL1', () => {
    const btl = calculateProperty(testProperties[0], assumptions, fixedNow)
    expect(btl.monthlyPayment).toBeCloseTo(786.88, 1)
    expect(btl.currentLtv).toBeCloseTo(0.693, 2)
    expect(btl.grossYield).toBeCloseTo(0.0843, 3)
    expect(btl.icr).toBeCloseTo(2.097, 2)
  })

  it('recalculates the portfolio when a BTL is disabled', () => {
    const all = calculatePortfolio(testProperties, assumptions, fixedNow)
    const two = calculatePortfolio(testProperties.map((p, i) => ({ ...p, active: i < 2 })), assumptions, fixedNow)
    expect(all.count).toBe(3)
    expect(all.rent).toBe(3850)
    expect(two.count).toBe(2)
    expect(two.rent).toBe(2750)
  })

  it('matches the source Vlad loan repayment and projects cash accumulation', () => {
    expect(amortizingPayment(49551, 0.06, 120)).toBeCloseTo(547, 0)
    const settings = { ...assumptions, vladLoan: true, extraction: true, fullyManaged: false }
    const portfolio = calculatePortfolio(testProperties, settings, fixedNow)
    const projection = projectPortfolio(testProperties, settings, 60, fixedNow)
    expect(portfolio.vladLoanPayment).toBeCloseTo(547, 0)
    expect(projection).toHaveLength(61)
    expect(projection[60].scenarios[2].cashPot).toBeGreaterThan(projection[60].scenarios[0].cashPot)
  })
})
