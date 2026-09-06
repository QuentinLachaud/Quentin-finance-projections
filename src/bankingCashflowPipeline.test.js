import { describe, expect, it } from 'vitest'
import {
  bankTransactionStatePatch, reviewDraftForTransaction, reviewPatchFromDraft, reviewPropagationPatch,
  reviewTransactionsForDisplay, similarTransactionsFor, similarTransactionsNeedingReviewFor, sortTransactionsForReview,
  summarizeCashFlowPipeline, transactionNeedsReview, transactionWithReviewDraft, trueCashFlowTransactions,
} from './banking.js'

const tx = (overrides = {}) => ({
  id: crypto.randomUUID(), accountId: 'a', bookedAt: '2026-08-01', amount: 0,
  status: 'booked', category: 'other', isTransfer: false, performanceTreatment: 'auto',
  excludeFromPerformance: false, ...overrides,
})

describe('true cash-flow pipeline', () => {
  it('keeps owner funding, capital purchases and tenant deposits out of business-generated cash while reconciling real bank movement', () => {
    const rows = [
      tx({ amount: 3000, category: 'rent', propertyId: 'p1' }),
      tx({ amount: -900, category: 'mortgage', propertyId: 'p1' }),
      tx({ amount: -100, category: 'tax_property_duties' }),
      tx({ amount: 5000, category: 'owner_funding' }),
      tx({ amount: -1200, category: 'owner_funding' }),
      tx({ amount: -50000, category: 'property_acquisition', propertyId: 'p2' }),
      tx({ amount: 1100, category: 'tenant_deposit', propertyId: 'p1' }),
      tx({ amount: -1100, category: 'tenant_deposit', propertyId: 'p1' }),
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
    expect(summary.capitalMovementNet).toBe(-50000)
    expect(summary.capitalMovementCount).toBe(1)
    expect(summary.liabilityMovementNet).toBe(0)
    expect(summary.liabilityMovementCount).toBe(2)
    expect(summary.netBankMovement).toBe(-44200)
    expect(trueCashFlowTransactions(rows).map((row) => row.category)).toEqual(['rent', 'mortgage', 'tax_property_duties'])
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

  it('keeps a just-resolved active row pinned so Apply to similar remains available', () => {
    const properties = [{ id: 'p1', name: 'BTL1' }]
    const source = tx({ id: 'source', amount: 1100, category: 'rent', propertyId: 'p1', counterparty: 'Tenant One', description: 'Tenant One ref:' })
    const peer = tx({ id: 'peer', amount: 1100, counterparty: 'Tenant One', description: 'Tenant One ref:' })
    expect(reviewTransactionsForDisplay([peer, source], properties, { activeReviewId: 'source' }).map((row) => row.id)).toEqual(['source', 'peer'])
    expect(reviewTransactionsForDisplay([peer, source], properties).map((row) => row.id)).toEqual(['peer'])
  })

  it('propagates the latest reviewed state only to unresolved exact matches', () => {
    const properties = [{ id: 'p1', name: 'BTL1' }]
    const source = tx({ id: 'source', amount: 1100, category: 'rent', propertyId: 'p1', counterparty: 'Tenant One', description: 'Tenant One ref:' })
    const unresolved = tx({ id: 'unresolved', amount: 1100, counterparty: 'Tenant One', description: 'Tenant One ref:' })
    const alreadyReviewed = tx({ id: 'reviewed', amount: 1100, category: 'rent', propertyId: 'p1', counterparty: 'Tenant One', description: 'Tenant One ref:' })
    expect(similarTransactionsNeedingReviewFor(source, [source, unresolved, alreadyReviewed], properties).map((row) => row.id)).toEqual(['unresolved'])
    expect(reviewPropagationPatch(source)).toEqual({
      category: 'rent', category_overridden: true, is_transfer: false, property_id: 'p1',
      performance_treatment: 'auto', exclude_from_performance: false,
    })
  })

  it('maps database review patches into immediate optimistic transaction state', () => {
    expect(bankTransactionStatePatch({
      category: 'repairs', category_overridden: true, is_transfer: false, property_id: 'p2',
      performance_treatment: 'operating', exclude_from_performance: true,
    })).toEqual({
      category: 'repairs', categoryOverridden: true, isTransfer: false, propertyId: 'p2',
      performanceTreatment: 'operating', excludeFromPerformance: true,
    })
  })

  it('builds a non-persistent review draft with a unique property suggestion and only becomes saveable once review is resolved', () => {
    const properties = [
      { id: 'p1', name: 'BTL1', lender: 'Paragon' },
      { id: 'p2', name: 'BTL2', lender: 'The Mortgage Works' },
    ]
    const source = tx({ id: 'mortgage', amount: -900, category: 'mortgage', description: 'Paragon mortgage', propertyId: '' })
    const draft = reviewDraftForTransaction(source, properties)
    expect(draft.propertyId).toBe('p1')
    expect(source.propertyId).toBe('')
    expect(transactionNeedsReview(transactionWithReviewDraft(source, draft), properties)).toBe(false)
    expect(reviewPatchFromDraft(draft)).toMatchObject({ category: 'mortgage', property_id: 'p1', category_overridden: true })
  })

  it('keeps Other rows gated until the user explicitly chooses a cash-flow treatment', () => {
    const source = tx({ id: 'other', amount: -40, category: 'other', description: 'Unclear payment' })
    const draft = reviewDraftForTransaction(source, [])
    expect(transactionNeedsReview(transactionWithReviewDraft(source, draft), [])).toBe(true)
    expect(transactionNeedsReview(transactionWithReviewDraft(source, { ...draft, performanceTreatment: 'company' }), [])).toBe(false)
  })

})
