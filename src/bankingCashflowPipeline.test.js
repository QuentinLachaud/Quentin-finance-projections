import { describe, expect, it } from 'vitest'
import {
  similarTransactionsFor, sortTransactionsForReview, summarizeCashFlowPipeline,
  trueCashFlowTransactions,
} from './banking.js'

const tx = (overrides = {}) => ({
  id: crypto.randomUUID(), accountId: 'a', bookedAt: '2026-08-01', amount: 0,
  status: 'booked', category: 'other', isTransfer: false, performanceTreatment: 'auto',
  excludeFromPerformance: false, ...overrides,
})

describe('true cash-flow pipeline', () => {
  it('keeps DLA in bank movement and owner funding but out of generated company cash flow', () => {
    const rows = [
      tx({ amount: 3000, category: 'rent', propertyId: 'p1' }),
      tx({ amount: -900, category: 'mortgage', propertyId: 'p1' }),
      tx({ amount: -100, category: 'tax' }),
      tx({ amount: 5000, category: 'dla_injected' }),
      tx({ amount: -1200, category: 'dla_repaid' }),
    ]
    const summary = summarizeCashFlowPipeline(rows)
    expect(summary.operatingCashFlow).toBe(3000)
    expect(summary.financingCashFlow).toBe(-900)
    expect(summary.companyOnlyCashFlow).toBe(-100)
    expect(summary.companyFreeCashFlow).toBe(2000)
    expect(summary.dlaInjected).toBe(5000)
    expect(summary.dlaRepaid).toBe(1200)
    expect(summary.netDlaFunding).toBe(3800)
    expect(summary.ownerFundingNet).toBe(3800)
    expect(summary.netBankMovement).toBe(5800)
    expect(trueCashFlowTransactions(rows).map((row) => row.category)).toEqual(['rent', 'mortgage', 'tax'])
  })

  it('excludes internal transfers and isolates unresolved movement instead of calling it true cash flow', () => {
    const summary = summarizeCashFlowPipeline([
      tx({ amount: 1000, category: 'rent', propertyId: 'p1' }),
      tx({ amount: -7500, category: 'transfer', isTransfer: true }),
      tx({ amount: -2500, category: 'other' }),
    ])
    expect(summary.companyFreeCashFlow).toBe(1000)
    expect(summary.internalTransferCount).toBe(1)
    expect(summary.internalTransferAbsolute).toBe(7500)
    expect(summary.reviewNet).toBe(-2500)
    expect(summary.reviewAbsolute).toBe(2500)
    expect(summary.reviewCount).toBe(1)
    expect(summary.netBankMovement).toBe(-1500)
  })
})

describe('minimal review workflow', () => {
  it('sorts unresolved rows by absolute amount descending by default', () => {
    const rows = sortTransactionsForReview([
      tx({ id: 'small', amount: -40, bookedAt: '2026-09-01' }),
      tx({ id: 'large', amount: 9000, bookedAt: '2026-01-01' }),
      tx({ id: 'middle', amount: -750, bookedAt: '2026-08-01' }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['large', 'middle', 'small'])
    expect(sortTransactionsForReview(rows, 'newest').map((row) => row.id)).toEqual(['small', 'middle', 'large'])
  })

  it('groups only strong exact counterparties for explicit apply-to-similar actions', () => {
    const source = tx({ id: 'rent-1', amount: 1100, counterparty: 'Joaquim de Faria', description: 'Joaquim de Faria ref:' })
    const same = tx({ id: 'rent-2', amount: 1100, counterparty: 'Joaquim de Faria', description: 'Joaquim de Faria ref:' })
    const different = tx({ id: 'rent-3', amount: 1100, counterparty: 'Another Tenant', description: 'Another Tenant ref:' })
    expect(similarTransactionsFor(source, [source, same, different]).map((row) => row.id)).toEqual(['rent-2'])
  })
})
