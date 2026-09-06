import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BankTransactionReview, { BankAnalysisUndo } from './BankTransactionReview.jsx'
import { classifyTransaction, exclusionUndoEntriesFor, performanceTreatmentForTransaction } from './banking.js'
import {
  inferTideStatementAccountRole, inferTideStatementAccountRoleFromHistory, parseTideCsv, tideStatementAccountRoleForAccount,
} from './bankStatementImport.js'

const headers = [
  'Date', 'Transaction ID', 'Transaction description', 'Reference', 'From', 'To',
  'Paid in', 'Paid out', 'Category name', 'Transaction type', 'Status', 'Initiated by', 'Tag 1',
].join(',')

const reviewRow = (extra = {}) => ({
  id: 'interest', accountId: 'current', bookedAt: '2026-09-01', amount: 12.34, currency: 'GBP', status: 'booked',
  category: 'other', isTransfer: false, propertyId: '', performanceTreatment: 'auto', excludeFromPerformance: false,
  description: 'Tide savings interest', accountName: 'Tide Current account', ...extra,
})

describe('passive Banking account routing and reversible exclusion', () => {
  it('classifies positive bank interest as company cash while preserving lender mortgage Direct Debits', () => {
    const csv = [
      headers,
      "2026-09-01 09:00:00,'interest-id,Bank interest paid,,,Tide Bank,12.34,,Bank interest paid,FasterPaymentIn,Cleared,,",
      "2026-09-02 09:00:00,'mortgage-id,PARAGON BANK PLC ref: 123,123,,PARAGON BANK PLC,,732.40,Bank interest paid,DirectDebit,Cleared,,",
    ].join('\n')
    const parsed = parseTideCsv(csv, [{ id: 'p1', name: 'BTL1', lender: 'Paragon' }])
    expect(parsed.transactions[0]).toMatchObject({ category: 'bank_interest', amount: 12.34 })
    expect(performanceTreatmentForTransaction(parsed.transactions[0])).toBe('company')
    expect(classifyTransaction({ amount: 3.5, description: 'Bank interest paid' })).toBe('bank_interest')
    expect(classifyTransaction({ amount: -3.5, description: 'Bank interest paid' })).toBe('bank_admin_fees')
    expect(parsed.transactions[1]).toMatchObject({ category: 'mortgage', propertyId: 'p1', amount: -732.4 })
  })

  it('infers Current from an evidenced Savings transfer and Savings from the equal opposite file', () => {
    const current = {
      fileName: 'transactions.csv',
      transactions: [{ bookedAt: '2026-09-01', amount: -1000, category: 'transfer', isTransfer: true, sourceMetadata: { to: 'Savings account', transactionType: 'FundsTransferOut' } }],
    }
    const savings = {
      fileName: 'second-export.csv',
      transactions: [{ bookedAt: '2026-09-01', amount: 1000, category: 'other', isTransfer: false, sourceMetadata: {} }],
    }
    expect(inferTideStatementAccountRole(current, [current, savings])).toBe('current')
    expect(inferTideStatementAccountRole(savings, [current, savings])).toBe('savings')
    expect(inferTideStatementAccountRole({ fileName: 'unknown.csv', transactions: [] }, [])).toBe('')
  })

  it('recognises persistent current/savings account roles from imported and live account metadata', () => {
    expect(tideStatementAccountRoleForAccount({ accountType: 'CACC', displayName: 'Tide' })).toBe('current')
    expect(tideStatementAccountRoleForAccount({ accountType: 'SVGS', displayName: 'Tide' })).toBe('savings')
    expect(tideStatementAccountRoleForAccount({ externalAccountId: 'manual:tide:savings:user', displayName: 'Tide Savings account' })).toBe('savings')
  })

  it('reuses overlapping stored Tide transaction IDs to route future exports without another account choice', () => {
    const statement = { transactions: [{ transactionKey: 'tide:known-savings' }, { transactionKey: 'tide:new-row' }] }
    const accounts = [
      { id: 'current', accountType: 'current', displayName: 'Tide Current account' },
      { id: 'savings', accountType: 'savings', displayName: 'Tide Savings account' },
    ]
    const existing = [{ account_id: 'savings', transaction_key: 'tide:known-savings' }]
    expect(inferTideStatementAccountRoleFromHistory(statement, existing, accounts)).toBe('savings')
  })

  it('keeps an exact undo payload for exclusion state and exposes a visible Undo action', () => {
    const transaction = reviewRow({ performanceTreatment: 'company', excludeFromPerformance: false })
    expect(exclusionUndoEntriesFor([transaction])).toEqual([{
      transaction,
      patch: { exclude_from_performance: false, performance_treatment: 'company' },
    }])
    const undoHtml = renderToStaticMarkup(<BankAnalysisUndo count={1} onUndo={() => true} />)
    expect(undoHtml).toContain('Transaction excluded from analysis.')
    expect(undoHtml).toContain('Undo')
  })

  it('shows Bank interest as a positive quick category in the focused review', () => {
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[reviewRow()]} properties={[]} onUpdate={() => true} onUpdateMany={() => true} />)
    expect(html).toContain('Quick categories')
    expect(html).toContain('>Bank interest<')
    expect(html).toContain('value="bank_interest"')
  })
})
