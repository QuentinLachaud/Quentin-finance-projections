import { describe, expect, it } from 'vitest'
import { groupLoans, loanGroupTotals } from './loanSorting.js'
const loan = (id, propertyId, balance, rate, date, months = 24) => ({
  id, propertyId, principalAmount: balance, loanAmount: balance, rate,
  fixedStartDate: date, fixedRateMonths: months, interestOnly: true,
  feeMode: 'amount', feeValue: 0, addFeeToLoan: false,
})
const properties = [{ id: 'a', name: 'BTL1' }, { id: 'b', name: 'BTL2' }, { id: 'c', name: 'BTL3' }]
const loans = [
  loan('a1', 'a', 100000, .05, '2025-01-01'),
  loan('a2', 'a', 50000, .06, '2026-01-01'),
  loan('b1', 'b', 200000, .04, '2024-01-01'),
  loan('c1', 'c', 30000, .08, ''),
  loan('u1', '', 900000, .09, '2023-01-01'),
]
const names = (sort, grouped = true) => groupLoans(loans, properties, sort, grouped).map(group => group.name)
describe('grouped loan sorting', () => {
  it('sorts parent cards by aggregate balance in both directions', () => {
    expect(names('balance-desc')).toEqual(['BTL2', 'BTL1', 'BTL3', 'Manual / unlinked loans'])
    expect(names('balance-asc')).toEqual(['BTL3', 'BTL1', 'BTL2', 'Manual / unlinked loans'])
  })
  it('uses balance-weighted group rates rather than the first loan rate', () => {
    expect(names('rate-desc')).toEqual(['BTL3', 'BTL1', 'BTL2', 'Manual / unlinked loans'])
    expect(names('rate-asc')).toEqual(['BTL2', 'BTL1', 'BTL3', 'Manual / unlinked loans'])
  })
  it('sorts earliest and latest fixed endings with missing dates last', () => {
    expect(names('expiry-asc')).toEqual(['BTL2', 'BTL1', 'BTL3', 'Manual / unlinked loans'])
    expect(names('expiry-desc')).toEqual(['BTL1', 'BTL2', 'BTL3', 'Manual / unlinked loans'])
  })
  it('preserves every child, its sort order and aggregate financial totals', () => {
    const groups = groupLoans(loans, properties, 'balance-desc')
    expect(groups[1].loans.map(loan => loan.id)).toEqual(['a1', 'a2'])
    expect(loanGroupTotals(groups[1].loans).balance).toBe(150000)
    expect(groups.flatMap(group => group.loans).map(loan => loan.id).sort()).toEqual(loans.map(loan => loan.id).sort())
    expect(loans.map(loan => loan.id)).toEqual(['a1', 'a2', 'b1', 'c1', 'u1'])
    expect(groupLoans(loans, properties, 'balance-desc', false)[0].loans[0].id).toBe('u1')
  })
  it('keeps deterministic ties, handles zero balances and missing dates', () => {
    const zero = [loan('z2', 'b', 0, .03, ''), loan('z1', 'a', 0, .03, '')]
    expect(groupLoans(zero, properties, 'rate-desc').map(group => group.id)).toEqual(['a', 'b'])
    expect(groupLoans(zero, properties, 'expiry-desc').map(group => group.id)).toEqual(['a', 'b'])
  })
})
