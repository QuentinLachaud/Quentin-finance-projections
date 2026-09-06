import { describe, expect, it } from 'vitest'
import {
  authoritativeAccountBalance, reconstructBalanceSeries, transactionExcludedFromAnalysis,
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
