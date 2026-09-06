import { describe, expect, it } from 'vitest'
import {
  authoritativeAccountBalance, latestAccountBalance, latestCashHeldFromAccounts, reconstructBalanceSeries, transactionExcludedFromAnalysis,
} from './banking.js'
import { readFileSync } from 'node:fs'

const tx = (bookedAt, amount, extra = {}) => ({
  accountId: 'tide',
  bookedAt,
  amount,
  currency: 'GBP',
  status: 'booked',
  category: 'other',
  isTransfer: false,
  performanceTreatment: 'auto',
  excludeFromPerformance: false,
  ...extra,
})

describe('Banking balance-truth regression', () => {
  it('uses latest booked imported movement for unanchored manual Tide cash balance without changing analysis semantics', () => {
    const current = { id: 'current', externalAccountId: 'manual:tide:current:user', currency: 'GBP', currentBalance: 0, includeInCash: true }
    const savings = { id: 'savings', externalAccountId: 'manual:tide:savings:user', currency: 'GBP', currentBalance: 0, includeInCash: true }
    const rows = [
      { ...tx('2026-01-01', 1000, { category: 'owner_funding', excludeFromPerformance: true }), accountId: 'current' },
      { ...tx('2026-01-02', -378.07, { category: 'property_acquisition', excludeFromPerformance: true }), accountId: 'current' },
      { ...tx('2026-01-03', 99, { status: 'pending' }), accountId: 'current' },
      { ...tx('2026-01-01', 13170.29, { category: 'owner_funding', excludeFromPerformance: true }), accountId: 'savings' },
    ]
    expect(authoritativeAccountBalance(current, rows)).toBeNull()
    expect(latestAccountBalance(current, rows)).toBe(621.93)
    expect(latestAccountBalance(savings, rows)).toBe(13170.29)
    expect(latestCashHeldFromAccounts([current, savings], rows)).toBe(13792.22)
  })

  it('keeps authoritative balance ahead of cumulative imported movement', () => {
    const live = { id: 'live', externalAccountId: 'gocardless-live', currency: 'GBP', currentBalance: 4321.09, includeInCash: true }
    const rows = [{ ...tx('2026-01-01', 9999), accountId: 'live' }]
    expect(latestAccountBalance(live, rows)).toBe(4321.09)
  })

  it('does not back-solve the legacy manual Tide £0 placeholder into a negative opening balance', () => {
    const account = [{
      id: 'tide',
      externalAccountId: 'manual:tide:legacy',
      currency: 'GBP',
      currentBalance: 0,
      balanceUpdatedAt: '2026-09-01T23:59:59Z',
      includeInCash: true,
    }]
    const rows = [
      tx('2025-02-06', -36265, { category: 'owner_funding', excludeFromPerformance: true }),
      tx('2025-02-07', 25000, { category: 'owner_funding', excludeFromPerformance: true }),
      tx('2025-02-08', 17775, { category: 'owner_funding', excludeFromPerformance: true }),
      tx('2025-02-09', -16525, { category: 'tax_property_duties', excludeFromPerformance: true }),
      tx('2025-02-10', 10000, { category: 'owner_funding', excludeFromPerformance: true }),
      tx('2025-02-11', -1000, { category: 'transfer', isTransfer: true }),
      tx('2025-02-12', 1500, { category: 'rent', propertyId: 'btl1' }),
    ]

    expect(authoritativeAccountBalance(account[0], rows)).toBeNull()
    const series = reconstructBalanceSeries(account, rows, {
      includeExcluded: false,
      includeOwnerFunding: true,
      asOf: '2026-09-01',
    })
    expect(series[0]).toEqual({ date: '2025-02-06', balance: 0 })
    expect(series.find((point) => point.date === '2025-02-11')?.balance).toBe(-1000)
    expect(series.at(-1)).toEqual({ date: '2025-02-12', balance: 500 })
    expect(Math.min(...series.map((point) => point.balance))).toBe(-1000)
  })

  it('distinguishes confirmed transfer pairs from unmatched transfer movement', () => {
    expect(transactionExcludedFromAnalysis(tx('2026-01-01', -500, { category: 'transfer', isTransfer: true }))).toBe(false)
    expect(transactionExcludedFromAnalysis(tx('2026-01-01', -500, { category: 'transfer', isTransfer: true, transferConfirmed: true }))).toBe(true)
    expect(transactionExcludedFromAnalysis(tx('2026-01-01', -500, { performanceTreatment: 'exclude' }))).toBe(true)
    expect(transactionExcludedFromAnalysis(tx('2026-01-01', 1500, { category: 'rent' }))).toBe(false)
  })

  it('anchors a manual statement to its latest observed running balance when one exists', () => {
    const account = [{
      id: 'tide',
      externalAccountId: 'manual:tide:current:user',
      currentBalance: 0,
      currency: 'GBP',
      includeInCash: true,
    }]
    const rows = [
      tx('2026-01-01', 1000, { balanceAfter: 3000 }),
      tx('2026-01-02', -500, { balanceAfter: 2500 }),
    ]
    expect(authoritativeAccountBalance(account[0], rows)).toBe(2500)
    expect(reconstructBalanceSeries(account, rows)).toEqual([
      { date: '2026-01-01', balance: 3000 },
      { date: '2026-01-02', balance: 2500 },
    ])
  })

  it('keeps live connected accounts anchored to their authoritative current balance', () => {
    const account = [{
      id: 'live',
      externalAccountId: 'gocardless-account',
      currentBalance: 6000,
      balanceUpdatedAt: '2026-03-31',
      currency: 'GBP',
      includeInCash: true,
    }]
    const rows = [
      { ...tx('2026-01-10', 20000, { category: 'owner_funding' }), accountId: 'live' },
      { ...tx('2026-01-20', -15000, { category: 'property_acquisition', excludeFromPerformance: true }), accountId: 'live' },
      { ...tx('2026-02-10', 1000, { category: 'rent' }), accountId: 'live' },
    ]
    const series = reconstructBalanceSeries(account, rows, {
      includeExcluded: false,
      includeOwnerFunding: false,
      asOf: '2026-03-31',
    })
    expect(series[0].balance).toBe(0)
    expect(series.find((point) => point.date === '2026-02-10')?.balance).toBe(1000)
  })

  it('prevents future statement imports from persisting a synthetic £0 closing balance', () => {
    const source = readFileSync(new URL('./BankStatementImportSheet.jsx', import.meta.url), 'utf8')
    expect(source).toContain("current_balance: Number.isFinite(Number(closingBalance)) ? Number(closingBalance) : null")
    expect(source).toContain("balance_updated_at: Number.isFinite(Number(closingBalance)) && statementTo ? `${statementTo}T23:59:59Z` : null")
    expect(source).not.toContain("current_balance: Number.isFinite(Number(closingBalance)) ? Number(closingBalance) : 0")
  })
})
