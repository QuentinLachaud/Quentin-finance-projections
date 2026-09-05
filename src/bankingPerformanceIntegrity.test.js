import { describe, expect, it } from 'vitest'
import {
  canonicalTransactionKey, classifyTransaction, deduplicateTransactions,
  performanceTreatmentForTransaction, suggestPropertyId, transactionNeedsReview,
} from './banking.js'
import { buildPerformanceModel } from './performance.js'

const property = {
  id: 'p1', name: 'BTL1', postcode: 'G1 1AA', lender: 'Paragon',
  purchaseDate: '2025-01-01', purchasePrice: 200000, latestValuation: 220000,
  mortgagePrincipalAmount: 150000, loanAmount: 150000, rent: 1100,
  operatingCashflow: 300, mortgageInterestOnly: true, baseRate: 0.04,
}
const bank = (overrides = {}) => ({
  id: crypto.randomUUID(), accountId: 'a', transactionKey: crypto.randomUUID(),
  bookedAt: '2026-01-10', amount: 1000, currency: 'GBP', description: 'Transaction',
  status: 'booked', category: 'other', sourceType: 'gocardless', propertyId: '',
  performanceTreatment: 'auto', excludeFromPerformance: false, isTransfer: false, ...overrides,
})

describe('banking and Performance integrity', () => {
  it('separates DLA direction from property operating cash', () => {
    const injection = bank({ amount: 5000, description: 'Directors loan', category: classifyTransaction({ amount: 5000, description: 'Directors loan' }) })
    const repayment = bank({ amount: -1200, description: 'Directors loan repayment', category: classifyTransaction({ amount: -1200, description: 'Directors loan repayment' }) })
    expect(injection.category).toBe('dla_injected')
    expect(repayment.category).toBe('dla_repaid')
    expect(performanceTreatmentForTransaction(injection)).toBe('investor')
    expect(performanceTreatmentForTransaction(repayment)).toBe('investor')
  })

  it('prefers live GoCardless data over the same imported statement row without deleting audit history', () => {
    const base = bank({ bookedAt: '2026-01-10', amount: 1100, description: 'Monthly rent BTL1', category: 'rent', propertyId: 'p1' })
    const imported = { ...base, id: 'statement', transactionKey: 'statement-row', sourceType: 'tide_statement' }
    const live = { ...base, id: 'live', transactionKey: 'live-row', sourceType: 'gocardless' }
    expect(canonicalTransactionKey(imported)).toBe(canonicalTransactionKey(live))
    expect(deduplicateTransactions([imported, live]).map((row) => row.id)).toEqual(['live'])
  })

  it('suggests a property from unique name/postcode/lender evidence and leaves uncertain rows in review', () => {
    const properties = [property, { ...property, id: 'p2', name: 'BTL2', postcode: 'G2 2BB', lender: 'The Mortgage Works' }]
    expect(suggestPropertyId({ description: 'PARAGON mortgage', category: 'mortgage' }, properties)).toBe('p1')
    expect(transactionNeedsReview(bank({ category: 'rent', description: 'Tenant payment', propertyId: '' }), properties)).toBe(true)
  })

  it('uses bank operating rows once, does not double-count matching Documents & Expenses rows, and reports DLA separately', () => {
    const transactions = [
      bank({ id: 'rent-bank', bookedAt: '2025-06-01', amount: 6000, description: 'Rent BTL1', category: 'rent', propertyId: 'p1' }),
      bank({ id: 'repair-bank', bookedAt: '2025-07-01', amount: -750, description: 'Repair BTL1', category: 'repairs', propertyId: 'p1' }),
      bank({ id: 'dla-in', bookedAt: '2025-05-01', amount: 5000, description: 'Director loan', category: 'dla_injected' }),
      bank({ id: 'dla-out', bookedAt: '2025-08-01', amount: -1000, description: 'Director loan repayment', category: 'dla_repaid' }),
    ]
    const expenses = [
      { id: 'rent-doc', date: '2025-06-01', property: 'BTL1', amount: 6000, description: 'Rent' },
      { id: 'repair-doc', date: '2025-07-01', property: 'BTL1', amount: -750, description: 'Repair' },
    ]
    const model = buildPerformanceModel({
      properties: [property], expenses, bankTransactions: transactions,
      bankAccounts: [{ id: 'a', currency: 'GBP', currentBalance: 12000, includeInCash: true }],
      scope: 'p1', now: new Date('2026-01-01T12:00:00Z'),
    })
    expect(model.metrics.operatingNetIncome).toBe(5250)
    expect(model.metrics.actualCashEntries).toBe(2)
    expect(model.metrics.bankBackedCashEntries).toBe(2)
    expect(model.metrics.dlaInjected).toBe(5000)
    expect(model.metrics.dlaRepaid).toBe(1000)
    expect(model.metrics.netDlaFunding).toBe(4000)
    expect(model.metrics.companyCash).toBe(12000)
    expect(model.events.filter((event) => event.sourceType === 'bank')).toHaveLength(2)
    expect(model.events.some((event) => event.sourceType === 'expense')).toBe(false)
  })

  it('never lets an excluded bank transaction affect property return', () => {
    const model = buildPerformanceModel({
      properties: [property],
      bankTransactions: [bank({ amount: 9999, category: 'rent', propertyId: 'p1', excludeFromPerformance: true })],
      scope: 'p1', now: new Date('2026-01-01T12:00:00Z'),
    })
    expect(model.metrics.bankBackedCashEntries).toBe(0)
    expect(model.metrics.operatingNetIncome).toBe(0)
  })
})
