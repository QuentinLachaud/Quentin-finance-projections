import { describe, expect, it } from 'vitest'
import { buildTheoreticalPerformanceProjection } from './performanceForecast.js'
import {
  applyLoanToPortfolio, applyLoansToProperty, createLoanFromProperty, effectiveLoanAmount,
  loanFinancials, normalizeLoan, normalizeLoans, projectLoan, projectPropertyLoans,
  reconcileLoanPortfolio, removeLoanFromPortfolio, removePropertyFromLoanPortfolio,
  savePropertyLoans, summarizePropertyLoans, withPropertyLoans,
} from './loans.js'
import { calculateProperty, calculatePortfolio, mortgageInterestPayment, mortgageMonthlyPayment } from './calculations.js'
import { calculateRemortgageScenario, compareRemortgageScenarios } from './remortgage.js'
import { actionableNotifications, complianceDiaryItems } from './notifications.js'

const property = { id: 'btl-1', name: 'BTL1', active: true, latestValuation: 250000, purchasePrice: 200000,
  homeReportPurchase: 200000, rent: 1500, loanAmount: 0, baseRate: 0, factorsFees: 0,
  repairs: 0, applianceReserve: 0, legionella: 0, gasCertificate: 0, eicr: 0, mortgageAdmin: 0 }
const loan = (id, principalAmount, rate, extra = {}) => normalizeLoan({ id, propertyId: property.id,
  lender: id, principalAmount, rate, interestOnly: true, fixedRateMonths: 60,
  fixedStartDate: '2026-01-01', feeMode: 'amount', feeValue: 0, addFeeToLoan: false, ...extra }, [property])
const a = loan('a', 100000, .05, { fixedRateMonths: 24 })
const b = loan('b', 50000, .06, { fixedStartDate: '2026-03-01', fixedRateMonths: 60 })
const settings = { accountType: 'company', rateShock: 0, appreciationRate: 0, rentGrowthRate: 0,
  companyCosts: [], extractions: [], bufferMonths: 6, accountingPeriodMonths: 12 }
const close = (actual, expected) => expect(actual).toBeCloseTo(expected, 5)

const state = () => ({ properties: [property, { ...property, id: 'btl-2', name: 'BTL2' }], loans: [a, b], remortgageComparisons: [] })

describe('multiple loans: canonical data and lifecycle', () => {
  it('migrates a legacy loan once and respects an explicitly empty collection', () => {
    expect(normalizeLoans(undefined, [{ ...property, loanAmount: 100000, lender: 'Legacy' }])).toHaveLength(1)
    expect(normalizeLoans([], [{ ...property, loanAmount: 100000, lender: 'Legacy' }])).toEqual([])
    const migrated = reconcileLoanPortfolio({ properties: [property], loans: [a, b] })
    expect(reconcileLoanPortfolio(migrated)).toEqual(migrated)
    expect(migrated.loans.map((item) => item.id)).toEqual(['a', 'b'])
  })
  it('preserves both loans when linking, editing, moving and unlinking', () => {
    const original = state()
    const added = applyLoanToPortfolio(original, loan('c', 10000, .04))
    expect(added.loans.filter((item) => item.propertyId === 'btl-1')).toHaveLength(3)
    const edited = applyLoanToPortfolio(added, { ...added.loans[0], rate: .045 })
    expect(edited.loans.find((item) => item.id === 'b').rate).toBe(.06)
    const moved = applyLoanToPortfolio(edited, { ...edited.loans[0], propertyId: 'btl-2' })
    expect(moved.properties.find((item) => item.id === 'btl-1').loanAmount).toBe(60000)
    expect(moved.properties.find((item) => item.id === 'btl-2').loanAmount).toBe(100000)
    const unlinked = applyLoanToPortfolio(moved, { ...moved.loans[0], propertyId: '' })
    expect(unlinked.loans[0].propertyId).toBe('')
    expect(unlinked.properties.find((item) => item.id === 'btl-2').loanAmount).toBe(0)
    expect(unlinked.loans).toHaveLength(3)
    expect(original.properties[0].loanAmount).toBe(0)
  })
  it('saves staged edits atomically, retains unrelated loans and refuses unrelated deletion', () => {
    const original = state()
    const staged = savePropertyLoans(original, { ...property, rent: 1600 }, [{ ...a, rate: .04 }, b, loan('c', 10000, .03)])
    expect(original.loans).toHaveLength(2)
    expect(staged.loans).toHaveLength(3)
    expect(staged.properties[0].rent).toBe(1600)
    expect(staged.properties[0].loanAmount).toBe(160000)
    expect(() => savePropertyLoans(original, property, [a], ['other'])).toThrow()
    expect(() => savePropertyLoans(original, property, [{ ...a, id: 'b' }, b])).toThrow()
    const removed = savePropertyLoans(staged, property, [b], ['a', 'c'])
    expect(removed.loans.map((item) => item.id)).toEqual(['b'])
    expect(removed.properties[0].loanAmount).toBe(50000)
  })
  it('deletes and unlinks without resurrecting stale property debt', () => {
    const removed = removeLoanFromPortfolio(state(), 'a')
    expect(removed.properties[0].loanAmount).toBe(50000)
    const empty = removeLoanFromPortfolio(removed, 'b')
    expect(empty.properties[0].loanAmount).toBe(0)
    expect(reconcileLoanPortfolio({ properties: empty.properties, loans: empty.loans }).loans).toEqual([])
    const deletedProperty = removePropertyFromLoanPortfolio(state(), 'btl-1')
    expect(deletedProperty.properties).toHaveLength(1)
    expect(deletedProperty.loans.map((item) => item.propertyId)).toEqual(['', ''])
  })
  it('does not overwrite an individual loan from a mixed aggregate', () => {
    const original = state()
    const next = savePropertyLoans(original, { ...property, latestValuation: 300000, lender: 'An aggregate' }, [a, b])
    expect(next.loans).toEqual(original.loans)
    expect(next.properties[0].loanAmount).toBe(150000)
    expect(next.properties[0].lender).not.toBe('An aggregate')
  })
})

describe('multiple loans: exact financial calculations', () => {
  it('sums independent IO loans and applies shocks individually', () => {
    const summary = summarizePropertyLoans(property, [a, b])
    expect(summary.loanAmount).toBe(150000)
    close(summary.monthlyInterestCost, 666.6666666667)
    close(summary.monthlyPayment, 666.6666666667)
    close(summary.rate, .0533333333333333)
    close(summary.currentLtv, .6)
    expect(summary.equity).toBe(100000)
    close(summarizePropertyLoans(property, [a, b], .01).monthlyPayment, 791.6666666667)
    expect(summarizePropertyLoans(property, [a, b], -.2).monthlyPayment).toBe(0)
    expect(summary.remortgageSchedule.map((item) => item.date)).toEqual(['2028-01-01', '2031-03-01'])
  })
  it('capitalises fees exactly once and never treats repayment principal as interest', () => {
    const financed = loan('fee', 100000, .05, { feeValue: 1000, addFeeToLoan: true })
    expect(effectiveLoanAmount(financed)).toBe(101000)
    expect(normalizeLoan(normalizeLoan(financed, [property]), [property]).loanAmount).toBe(101000)
    close(loanFinancials(financed).monthlyInterestCost, 420.8333333333)
    const repaid = loan('repay', 120000, .06, { interestOnly: false, termMonths: 120 })
    const summary = summarizePropertyLoans(property, [a, repaid])
    close(summary.monthlyPayment, loanFinancials(a).monthlyPayment + loanFinancials(repaid).monthlyPayment)
    close(summary.monthlyInterestCost, 416.6666666667 + 600)
    close(summary.principalPayment, summary.monthlyPayment - summary.monthlyInterestCost)
    expect(summary.repaymentMode).toBe('mixed')
    expect(applyLoansToProperty(property, [a, repaid]).mortgageInterestOnly).toBeNull()
  })
  it('supports zero-rate amortisation, separate terms and payoff without negative balances', () => {
    const zero = loan('zero', 1200, 0, { interestOnly: false, termMonths: 12 })
    expect(loanFinancials(zero).monthlyPayment).toBe(100)
    expect(projectLoan(zero, 6).currentBalance).toBeCloseTo(600)
    expect(projectLoan(zero, 12).currentBalance).toBe(0)
    expect(projectLoan(zero, 24).currentBalance).toBe(0)
    const mixed = [zero, loan('slow', 2400, .06, { interestOnly: false, termMonths: 24 })]
    const projected = projectPropertyLoans({ ...property, financeLoans: mixed }, 12)
    expect(projected.loanAmount).toBeCloseTo(projectLoan(mixed[1], 12).currentBalance)
    expect(projected.financeLoans[0].currentBalance).toBe(0)
    expect(projected.financeLoans[1].currentBalance).toBeGreaterThan(0)
  })
  it('applies dated borrowing and repayments without altering unrelated loan schedules', () => {
    const p = { ...property, financeLoans: [a, b] }
    const event = { id: 'release', propertyId: property.id, month: 2, loanDelta: 10000, rate: .04 }
    expect(projectPropertyLoans(p, 2, 0, [event]).loanAmount).toBe(150000)
    expect(projectPropertyLoans(p, 3, 0, [event]).loanAmount).toBe(160000)
    const next = projectPropertyLoans(p, 4, 0, [{ ...event, loanId: 'a', loanDelta: -10000 }])
    expect(next.financeLoans.find((item) => item.id === 'a').currentBalance).toBe(90000)
    expect(next.financeLoans.find((item) => item.id === 'b').currentBalance).toBe(50000)
  })
  it('passes aggregate amounts through property and portfolio cash flow and tax', () => {
    const p = withPropertyLoans([property], [a, b])[0]
    const calculated = calculateProperty(p, settings, new Date('2026-09-01T12:00:00Z'))
    close(calculated.monthlyInterestCost, 666.6666666667)
    close(calculated.monthlyPayment, 666.6666666667)
    expect(calculated.loanAmount).toBe(150000)
    expect(calculated.equity).toBe(100000)
    close(mortgageInterestPayment(p, settings), 666.6666666667)
    close(mortgageMonthlyPayment(p, settings), 666.6666666667)
    const portfolio = calculatePortfolio([p], settings, new Date('2026-09-01T12:00:00Z'))
    expect(portfolio.totalLoans).toBe(150000)
    expect(portfolio.totalEquity).toBe(100000)
    close(portfolio.financeCosts, 666.6666666667)
    close(portfolio.mortgagePayments, 666.6666666667)
    expect(portfolio.scenarios).toHaveLength(3)
    expect(portfolio.scenarios[0].bankCashflow).toBeLessThan(portfolio.scenarios[2].bankCashflow)
    const excluded = calculatePortfolio([{ ...p, active: false }], settings)
    expect(excluded.totalLoans).toBe(0)
    expect(excluded.count).toBe(0)
  })
  it('excludes principal from deductible finance costs for repayment loans', () => {
    const repay = loan('repay', 120000, .06, { interestOnly: false, termMonths: 120, qualifyingFinanceBalance: 60000 })
    const p = withPropertyLoans([property], [repay])[0]
    const result = calculatePortfolio([p], settings, new Date('2026-09-01T12:00:00Z'))
    expect(result.mortgagePayments).toBeGreaterThan(result.financeCosts)
    close(result.financeCosts, 600)
    close(result.qualifyingFinanceCosts, 300)
    expect(result.scenarios[0].bankCashflow).toBeLessThan(result.scenarios[2].bankCashflow)
  })
  it('keeps current refinance balances and actual payments without charging historical fees again', () => {
    const p = withPropertyLoans([property], [a, b])[0]
    const comparison = { id: 'cmp', sourcePropertyId: p.id, left: { loanAmount: 1, rate: 9 }, right: { propertyValue: 250000, loanAmount: 150000, rate: 4, feeMode: 'amount', feeValue: 999, addFeeToLoan: true } }
    const next = reconcileLoanPortfolio({ properties: [p], loans: [a, b], comparisons: [comparison] }).comparisons[0]
    const current = calculateRemortgageScenario(next.left)
    expect(current.effectiveLoan).toBe(150000)
    close(current.monthlyInterest, 666.6666666667)
    close(current.monthlyPayment, 666.6666666667)
    expect(current.upfrontFee).toBe(0)
    expect(next.right).toEqual(comparison.right)
    const diff = compareRemortgageScenarios(next.left, next.right)
    close(diff.loanChange, 999)
  })
  it('emits one reminder per fixed period with stable loan-specific keys', () => {
    const p = withPropertyLoans([property], [a, b])[0]
    const items = complianceDiaryItems([p]).filter((item) => item.type === 'remortgage')
    expect(items).toHaveLength(2)
    expect(items.map((item) => item.dueDate)).toEqual(['2028-01-01', '2031-03-01'])
    expect(new Set(items.map((item) => item.key)).size).toBe(2)
    expect(actionableNotifications({ properties: [p], now: new Date('2027-10-01T12:00:00Z') }).filter((item) => item.type === 'remortgage')).toHaveLength(1)
  })
})


describe('multiple loans: performance forecast contract', () => {
  it('uses both canonical loans when the property still contains a legacy scalar mortgage', () => {
    const model = buildTheoreticalPerformanceProjection({
      properties: [property], loans: [a, b], settings, scope: property.id,
      scenarioId: 0, horizonYears: 1, now: new Date('2026-09-01T12:00:00Z'),
    })
    const today = model.points.find((point) => point.date === model.todayMonth)
    expect(today).toBeDefined()
    close(today.debt, 150000)
    close(today.equity, 100000)
  })
})
