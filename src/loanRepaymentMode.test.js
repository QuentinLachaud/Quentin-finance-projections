import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assumptions, createBlankProperty } from './data.js'
import { calculatePortfolio, calculateProperty } from './calculations.js'
import { createBlankLoan, loanCostSummary, normalizeLoan, repaymentMonthlyPayment } from './loans.js'

const workspace = readFileSync(new URL('./LoansWorkspace.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

const settings = {
  ...assumptions,
  rateShock: 0,
  accountType: 'company',
  fullyManaged: false,
  companyCosts: [],
  extractions: [],
}

describe('loan repayment mode', () => {
  it('defaults loans and properties to interest-only with a 25-year repayment term available', () => {
    expect(createBlankLoan()).toMatchObject({ interestOnly: true, termMonths: 300 })
    expect(createBlankProperty('BTL')).toMatchObject({ mortgageInterestOnly: true, mortgageTermMonths: 300 })
    expect(normalizeLoan({ loanAmount: 100000 })).toMatchObject({ interestOnly: true, termMonths: 300 })
  })

  it('switches monthly payment from interest-only to principal plus interest', () => {
    const interestOnly = normalizeLoan({ loanAmount: 100000, rate: 0.05, fixedRateMonths: 60 })
    const interestOnlyCosts = loanCostSummary(interestOnly)
    expect(interestOnlyCosts.monthlyPayment).toBeCloseTo(416.6666667)

    const repayment = normalizeLoan({ ...interestOnly, interestOnly: false, termMonths: 300 })
    const costs = loanCostSummary(repayment)
    expect(costs.monthlyPayment).toBeCloseTo(584.5900415, 5)
    expect(costs.monthlyInterestCost).toBeCloseTo(416.6666667)
    expect(costs.firstMonthPrincipal).toBeCloseTo(167.9233748, 5)
    expect(costs.totalPrincipalRepaid).toBeGreaterThan(0)
    expect(costs.totalInterestCost).toBeLessThan(interestOnlyCosts.totalInterestCost)
    expect(repaymentMonthlyPayment(100000, 0.05, 300)).toBeCloseTo(costs.monthlyPayment)
  })

  it('uses the capitalised fee balance before calculating repayment payment', () => {
    const repayment = normalizeLoan({
      loanAmount: 100000,
      rate: 0.05,
      fixedRateMonths: 60,
      feeMode: 'amount',
      feeValue: 1000,
      addFeeToLoan: true,
      interestOnly: false,
      termMonths: 300,
    })
    expect(repayment.loanAmount).toBe(101000)
    expect(loanCostSummary(repayment).monthlyPayment).toBeGreaterThan(repaymentMonthlyPayment(100000, 0.05, 300))
    expect(normalizeLoan({ ...repayment, interestOnly: true }).loanAmount).toBe(101000)
  })

  it('uses full repayment cash payment while tax finance cost remains interest-only', () => {
    const property = {
      ...createBlankProperty('BTL'),
      active: true,
      latestValuation: 150000,
      loanAmount: 100000,
      mortgagePrincipalAmount: 100000,
      baseRate: 0.05,
      rent: 1500,
      mortgageInterestOnly: false,
      mortgageTermMonths: 300,
      factorsFees: 0,
      legionella: 0,
      gasCertificate: 0,
      eicr: 0,
      repairs: 0,
      applianceReserve: 0,
      mortgageAdmin: 0,
      voidsOverride: 0,
    }
    const calculated = calculateProperty(property, settings, new Date('2026-09-04T12:00:00'))
    expect(calculated.monthlyInterestCost).toBeCloseTo(416.6666667)
    expect(calculated.monthlyPayment).toBeCloseTo(584.5900415, 5)

    const portfolio = calculatePortfolio([property], settings, new Date('2026-09-04T12:00:00'))
    expect(portfolio.financeCosts).toBeCloseTo(416.6666667)
    expect(portfolio.mortgagePayments).toBeCloseTo(584.5900415, 5)
    expect(portfolio.propertyFixedCosts).toBeCloseTo(584.5900415, 5)
    expect(portfolio.scenarios[2].bankCashflow).toBeCloseTo(1500 - 584.5900415 - portfolio.scenarios[2].tax, 4)
  })

  it('exposes repayment controls and removes the obsolete all-interest-only help claim', () => {
    expect(workspace).toContain('<b>Interest only</b>')
    expect(workspace).toContain('checked={loan.interestOnly !== false}')
    expect(workspace).toContain('loan.interestOnly === false')
    expect(workspace).toContain('Remaining mortgage term')
    expect(workspace).toContain('Monthly payment')
    expect(app).not.toContain('The current BTL model is interest-only.')
    expect(app).toContain('Interest-only loans show interest; repayment loans include scheduled principal over the remaining mortgage term.')
  })
})
