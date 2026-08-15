import { describe, expect, it } from 'vitest'
import { assumptions, seedProperties } from './data.js'
import { amortizingPayment, calculatePortfolio, calculateProperty, projectPortfolio } from './calculations.js'

const fixedNow = new Date('2026-08-15T12:00:00')

describe('Quark sheet calculations', () => {
  it('matches the sheet mortgage and headline metrics for BTL1', () => {
    const btl = calculateProperty(seedProperties[0], assumptions, fixedNow)
    expect(btl.monthlyPayment).toBeCloseTo(786.88, 1)
    expect(btl.currentLtv).toBeCloseTo(0.693, 2)
    expect(btl.grossYield).toBeCloseTo(0.0843, 3)
    expect(btl.icr).toBeCloseTo(2.097, 2)
  })

  it('recalculates the portfolio when a BTL is disabled', () => {
    const all = calculatePortfolio(seedProperties, assumptions, fixedNow)
    const two = calculatePortfolio(seedProperties.map((p, i) => ({ ...p, active: i < 2 })), assumptions, fixedNow)
    expect(all.count).toBe(3)
    expect(all.rent).toBe(3850)
    expect(two.count).toBe(2)
    expect(two.rent).toBe(2750)
  })

  it('matches the source Vlad loan repayment and projects cash accumulation', () => {
    expect(amortizingPayment(49551, 0.06, 120)).toBeCloseTo(547, 0)
    const settings = { ...assumptions, vladLoan: true, extraction: true, fullyManaged: false }
    const portfolio = calculatePortfolio(seedProperties, settings, fixedNow)
    const projection = projectPortfolio(seedProperties, settings, 60, fixedNow)
    expect(portfolio.vladLoanPayment).toBeCloseTo(547, 0)
    expect(projection).toHaveLength(61)
    expect(projection[60].scenarios[2].cashPot).toBeGreaterThan(projection[60].scenarios[0].cashPot)
  })
})
