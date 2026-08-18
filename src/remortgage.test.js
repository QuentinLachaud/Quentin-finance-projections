import { describe, expect, it } from 'vitest'
import {
  calculateRemortgageScenario,
  compareRemortgageScenarios,
  createRemortgageComparison,
  createRemortgageScenario,
  roundedLtv,
  updateRemortgageScenario,
} from './remortgage.js'

describe('remortgage simulator', () => {
  it('links loan amount and LTV in both directions', () => {
    const base = createRemortgageScenario({ propertyValue: 200000, loanAmount: 150000, rate: 5 })
    expect(base.ltv).toBeCloseTo(75)

    const byLtv = updateRemortgageScenario(base, 'ltv', 70)
    expect(byLtv.loanAmount).toBeCloseTo(140000)

    const byLoan = updateRemortgageScenario(byLtv, 'loanAmount', 130000)
    expect(byLoan.ltv).toBeCloseTo(65)
  })

  it('keeps the last loan basis when property value changes', () => {
    const byLtv = updateRemortgageScenario(
      createRemortgageScenario({ propertyValue: 200000, loanAmount: 150000 }),
      'ltv',
      70,
    )
    const resized = updateRemortgageScenario(byLtv, 'propertyValue', 220000)
    expect(resized.loanAmount).toBeCloseTo(154000)
    expect(resized.ltv).toBeCloseTo(70)
  })

  it('adds a percentage fee to the loan when selected', () => {
    const result = calculateRemortgageScenario({
      propertyValue: 200000,
      loanAmount: 150000,
      rate: 5,
      feeMode: 'percent',
      feeValue: 2,
      addFeeToLoan: true,
    })
    expect(result.fee).toBeCloseTo(3000)
    expect(result.effectiveLoan).toBeCloseTo(153000)
    expect(result.resultingLtv).toBeCloseTo(76.5)
    expect(result.monthlyInterest).toBeCloseTo(637.5)
    expect(result.upfrontFee).toBe(0)
  })

  it('keeps an upfront fee out of the mortgage balance', () => {
    const result = calculateRemortgageScenario({
      propertyValue: 200000,
      loanAmount: 150000,
      rate: 5,
      feeMode: 'amount',
      feeValue: 1995,
      addFeeToLoan: false,
    })
    expect(result.effectiveLoan).toBe(150000)
    expect(result.upfrontFee).toBe(1995)
    expect(result.monthlyInterest).toBeCloseTo(625)
  })

  it('shows positive monthly cash-flow change when option B is cheaper', () => {
    const comparison = compareRemortgageScenarios(
      createRemortgageScenario({ propertyValue: 200000, loanAmount: 150000, rate: 6 }),
      createRemortgageScenario({ propertyValue: 200000, loanAmount: 150000, rate: 5 }),
    )
    expect(comparison.monthlyCashFlowChange).toBeCloseTo(125)
    expect(comparison.annualCashFlowChange).toBeCloseTo(1500)
  })

  it('reports positive equity release when option B increases borrowing', () => {
    const comparison = compareRemortgageScenarios(
      createRemortgageScenario({ propertyValue: 200000, loanAmount: 120000, rate: 5 }),
      createRemortgageScenario({ propertyValue: 200000, loanAmount: 140000, rate: 5 }),
    )
    expect(comparison.equityRelease).toBeCloseTo(20000)
    expect(comparison.equityChange).toBeCloseTo(-20000)
  })

  it('rounds displayed LTV to the nearest whole percentage point', () => {
    expect(roundedLtv(69.49)).toBe(69)
    expect(roundedLtv(69.5)).toBe(70)
    expect(roundedLtv(75.9)).toBe(76)
  })

  it('initializes an existing property from its valuation, loan and base rate', () => {
    const comparison = createRemortgageComparison({
      id: 'one',
      name: 'BTL1',
      latestValuation: 250000,
      loanAmount: 175000,
      baseRate: 0.0484,
    })
    expect(comparison.sourcePropertyId).toBe('one')
    expect(comparison.left.propertyValue).toBe(250000)
    expect(comparison.left.loanAmount).toBe(175000)
    expect(comparison.left.rate).toBeCloseTo(4.84)
    expect(comparison.right).toEqual(comparison.left)
  })
})
