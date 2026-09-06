import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { reconciliationTransactionsForBucket } from './banking.js'
import { CashFlowReconciliation, ReconciliationTransactionList } from './BankingVisuals.jsx'

const tx = (id, amount, category, extra = {}) => ({
  id, accountId: 'a', bookedAt: '2026-09-01', amount, currency: 'GBP', status: 'booked',
  category, isTransfer: false, propertyId: '', performanceTreatment: 'auto', excludeFromPerformance: false,
  description: id, ...extra,
})

const rows = [
  tx('rent', 1650, 'rent', { propertyId: 'p1' }),
  tx('mortgage', -700, 'mortgage', { propertyId: 'p1' }),
  tx('owner', 5000, 'owner_funding'),
  tx('extract', -875, 'cash_extraction'),
  tx('capital', -20000, 'property_acquisition', { propertyId: 'p1' }),
  tx('deposit', -1100, 'tenant_deposit', { propertyId: 'p1' }),
  tx('review', -25, 'other'),
  tx('excluded', -40, 'repairs', { propertyId: 'p1', excludeFromPerformance: true }),
  tx('transfer', -1000, 'transfer', { isTransfer: true }),
  tx('pending', 99, 'rent', { propertyId: 'p1', status: 'pending' }),
]

const summary = {
  companyFreeCashFlow: 950,
  ownerFundingNet: 5000,
  cashExtractionNet: -875,
  capitalMovementNet: -20000,
  capitalMovementCount: 1,
  liabilityMovementNet: -1100,
  liabilityMovementCount: 1,
  reviewNet: -25,
  reviewCount: 1,
  excludedNet: -40,
  excludedCount: 1,
  operatingCashFlow: 1650,
  companyOnlyCashFlow: 0,
  financingCashFlow: -700,
  cashExtractionCount: 1,
  internalTransferCount: 1,
  internalTransferAbsolute: 1000,
  rawBankMovement: -16090,
  netBankMovement: -16050,
}

describe('Banking reconciliation drill-down and exclusion UX', () => {
  it('selects the exact transactions represented by each top-level reconciliation card', () => {
    expect(reconciliationTransactionsForBucket(rows, 'business').map((row) => row.id)).toEqual(['rent', 'mortgage'])
    expect(reconciliationTransactionsForBucket(rows, 'owner').map((row) => row.id)).toEqual(['owner'])
    expect(reconciliationTransactionsForBucket(rows, 'extraction').map((row) => row.id)).toEqual(['extract'])
    expect(reconciliationTransactionsForBucket(rows, 'other').map((row) => row.id)).toEqual(['capital', 'deposit', 'review'])
    expect(reconciliationTransactionsForBucket(rows, 'net').map((row) => row.id)).toEqual(['rent', 'mortgage', 'owner', 'extract', 'capital', 'deposit', 'review'])
    expect(reconciliationTransactionsForBucket(rows, 'excluded').map((row) => row.id)).toEqual(['excluded'])
  })

  it('renders every reconciliation card as an explicit transaction drill-down control', () => {
    const html = renderToStaticMarkup(<CashFlowReconciliation cashSummary={summary} transactions={rows} properties={[{ id: 'p1', name: 'BTL1' }]} onToggleExcluded={() => true} />)
    for (const label of ['Business cash generated', 'Owner funding', 'Cash extracted', 'Other bank movement', 'Net bank movement']) {
      expect(html).toContain(`aria-label=\"View transactions for ${label}\"`)
    }
    expect((html.match(/bank-reconcile-card/g) || [])).toHaveLength(5)
  })

  it('renders a direct exclusion switch for each drilled-down transaction without deleting bank movement', () => {
    const html = renderToStaticMarkup(<ReconciliationTransactionList title="Other bank movement" transactions={[rows[4], rows[7]]} properties={[{ id: 'p1', name: 'BTL1' }]} onToggleExcluded={() => true} />)
    expect(html).toContain('aria-label="Exclude capital from analysis"')
    expect(html).toContain('aria-label="Exclude excluded from analysis"')
    expect(html).toContain('BTL1')
    expect(html).toContain('checked=""')
  })
})
