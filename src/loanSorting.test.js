import { describe, expect, it } from 'vitest'
import { groupLoans, loanDisplayBalance, loanFixedExpiry, loanGroupTotals, sortLoans } from './loanSorting.js'

const loan = (id, propertyId, balance, rate, start, months = 24) => ({
  id, propertyId, lender: id, principalAmount: balance, loanAmount: balance,
  rate, fixedStartDate: start, fixedRateMonths: months, feeMode: 'amount',
  feeValue: 0, addFeeToLoan: false, interestOnly: true,
})
const sample = [
  loan('a', 'p1', 100000, .05, '2025-01-01'),
  loan('b', 'p1', 50000, .06, '2024-01-01'),
  loan('c', 'p2', 80000, .04, '2026-01-01'),
  loan('d', '', 20000, .07, ''),
]
const properties = [{ id: 'p1', name: 'BTL1' }, { id: 'p2', name: 'BTL2' }]
const ids = (loans) => loans.map((entry) => entry.id)

describe('loan display grouping and sorting', () => {
  it('sorts actual fixed end dates, with missing dates last in both directions', () => {
    expect(ids(sortLoans(sample))).toEqual(['b', 'a', 'c', 'd'])
    expect(ids(sortLoans(sample, 'expiry-desc'))).toEqual(['c', 'a', 'b', 'd'])
    expect(loanFixedExpiry(sample[0])).toBe('2027-01-01')
    expect(loanFixedExpiry(sample[3])).toBeNull()
  })
  it('handles leap-year month ends and invalid or missing expiry inputs', () => {
    expect(loanFixedExpiry(loan('x', 'p1', 100, .05, '2024-01-31', 1))).toBe('2024-02-29')
    expect(loanFixedExpiry(loan('x', 'p1', 100, .05, '', 24))).toBeNull()
    expect(loanFixedExpiry(loan('x', 'p1', 100, .05, '2025-01-01', 0))).toBeNull()
  })
  it('supports both balance and rate directions without mutating input', () => {
    expect(ids(sortLoans(sample, 'balance-desc'))).toEqual(['a', 'c', 'b', 'd'])
    expect(ids(sortLoans(sample, 'balance-asc'))).toEqual(['d', 'b', 'c', 'a'])
    expect(ids(sortLoans(sample, 'rate-asc'))).toEqual(['c', 'a', 'b', 'd'])
    expect(ids(sortLoans(sample, 'rate-desc'))).toEqual(['d', 'b', 'a', 'c'])
    expect(ids(sample)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('uses effective capitalised balance and does not count fees twice', () => {
    const financed = { ...sample[0], principalAmount: 100000, loanAmount: 103000, feeMode: 'percent', feeValue: 3, addFeeToLoan: true }
    expect(loanDisplayBalance(financed)).toBe(103000)
    expect(loanGroupTotals([financed, sample[1]])).toEqual({
      balance: 153000, monthlyPayment: 103000 * .05 / 12 + 50000 * .06 / 12, count: 2,
    })
  })
  it('retains every loan in its BTL and keeps orphaned or unlinked loans separate', () => {
    const groups = groupLoans([...sample, loan('e', 'missing', 1000, .02, '')], properties)
    expect(groups.map((group) => group.name)).toEqual(['BTL1', 'BTL2', 'Manual / unlinked loans'])
    expect(ids(groups[0].loans)).toEqual(['b', 'a'])
    expect(ids(groups[2].loans)).toEqual(['d', 'e'])
    expect(groups.flatMap((group) => group.loans)).toHaveLength(5)
    expect(groupLoans(sample, properties, 'rate-desc', false)[0].loans.map((item) => item.id)).toEqual(['d', 'b', 'a', 'c'])
  })
  it('has deterministic tie-breaking and safe fallbacks', () => {
    expect(ids(sortLoans([sample[1], sample[0]], 'invalid'))).toEqual(['b', 'a'])
    expect(ids(sortLoans([sample[1], { ...sample[1], id: 'aa' }], 'rate-asc'))).toEqual(['aa', 'b'])
    expect(groupLoans([], properties)).toEqual([])
    expect(sortLoans(null)).toEqual([])
    expect(groupLoans(null, null)).toEqual([])
  })
})
