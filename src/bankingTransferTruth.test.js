import { describe, expect, it } from 'vitest'
import {
  deduplicateTransactions, detectInternalTransfers, reconstructBalanceSeries,
  summarizeCashFlowPipeline, transactionExcludedFromAnalysis,
} from './banking.js'

const tx = (id, amount, extra = {}) => ({
  id, accountId: 'legacy-tide', bookedAt: '2026-01-10', amount, currency: 'GBP', status: 'booked',
  category: 'other', isTransfer: false, categoryOverridden: false, performanceTreatment: 'auto',
  excludeFromPerformance: false, description: id, sourceMetadata: {}, ...extra,
})
const providerId = 'abc123abc123abc123abc123abc123ab'

const legacyPair = () => [
  tx('current-out', -1000, {
    category: 'transfer', isTransfer: true,
    sourceMetadata: { tideTransactionId: providerId, transactionType: 'FundsTransferOut', to: 'Savings account' },
  }),
  tx('saver-in', 1000, {
    description: `'${providerId}`, category: 'rent', categoryOverridden: true, propertyId: 'p2',
  }),
]

describe('Tide transfer truth reconciliation', () => {
  it('pairs legacy same-account Current/Saver legs by provider identity and overrides a wrong manual rent guess', () => {
    const rows = detectInternalTransfers(legacyPair())
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.isTransfer && row.category === 'transfer' && row.transferConfirmed)).toBe(true)
    expect(rows.every((row) => String(row.transferMatch).startsWith('tide:'))).toBe(true)
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(0)
  })

  it('repairs source-factual false transfers without guessing from merchant name', () => {
    const rows = detectInternalTransfers([
      tx('deposit-in', 1000, { description: 'MONRO NC ref: DESPOIT', category: 'rent', categoryOverridden: true, propertyId: 'p2' }),
      tx('deposit-out', -1000, {
        description: 'SafeDeposits Scotland ref: DAN123', counterparty: 'SafeDeposits Scotland',
        category: 'transfer', isTransfer: true, categoryOverridden: true, propertyId: 'p2',
        sourceMetadata: { transactionType: 'FasterPaymentOut', to: 'SafeDeposits Scotland' },
      }),
      tx('benefit', -50, {
        description: 'AMAZON UK Marketplace', category: 'transfer', isTransfer: true, categoryOverridden: true, propertyId: 'p2',
        sourceMetadata: { transactionType: 'CardPaymentOut', tag1: 'Trivial benefit' },
      }),
      tx('purchase', -25000, {
        description: 'Solicitors ref: Purchase Deposit', category: 'owner_funding', categoryOverridden: true, propertyId: 'p2',
        sourceMetadata: { transactionType: 'FasterPaymentOut', reference: 'Purchase Deposit' },
      }),
    ])
    expect(rows[0]).toMatchObject({ category: 'tenant_deposit', isTransfer: false, sourceFactCorrection: true })
    expect(rows[1]).toMatchObject({ category: 'tenant_deposit', isTransfer: false, sourceFactCorrection: true })
    expect(rows[2]).toMatchObject({ category: 'cash_extraction', isTransfer: false, sourceFactCorrection: true })
    expect(rows[3]).toMatchObject({ category: 'property_acquisition', isTransfer: false, sourceFactCorrection: true })
  })

  it('keeps raw movement equal to the ledger sum and never lets a one-sided transfer disappear', () => {
    const [out, incoming] = detectInternalTransfers(legacyPair())
    const unmatched = tx('unmatched', -100, { category: 'transfer', isTransfer: true })
    const excluded = tx('excluded', -360, { category: 'repairs', propertyId: 'p1', excludeFromPerformance: true })
    const rent = tx('rent', 1000, { category: 'rent', propertyId: 'p1' })
    const rows = [out, incoming, unmatched, excluded, rent]
    const summary = summarizeCashFlowPipeline(rows)
    expect(summary.rawBankMovement).toBe(540)
    expect(summary.internalTransferCount).toBe(2)
    expect(summary.internalTransferNet).toBe(0)
    expect(summary.unreconciledTransferCount).toBe(1)
    expect(summary.unreconciledTransferNet).toBe(-100)
    expect(summary.transferAdjustmentNet).toBe(-100)
    expect(summary.netBankMovement).toBe(900)
  })

  it('retains a confirmed transfer leg when the selected period contains only one side of the pair', () => {
    const summary = summarizeCashFlowPipeline([
      tx('boundary', -750, { category: 'transfer', isTransfer: true, transferConfirmed: true }),
    ])
    expect(summary.internalTransferNet).toBe(-750)
    expect(summary.confirmedTransferBoundaryNet).toBe(-750)
    expect(summary.netBankMovement).toBe(-750)
    expect(summary.rawBankMovement).toBe(-750)
  })

  it('only removes confirmed transfers or explicit exclusions from analytical balance movement', () => {
    const confirmed = tx('confirmed', -500, { category: 'transfer', isTransfer: true, transferConfirmed: true })
    const unmatched = tx('unmatched', -500, { category: 'transfer', isTransfer: true, transferConfirmed: false })
    const excluded = tx('excluded', -500, { category: 'repairs', excludeFromPerformance: true })
    expect(transactionExcludedFromAnalysis(confirmed)).toBe(true)
    expect(transactionExcludedFromAnalysis(unmatched)).toBe(false)
    expect(transactionExcludedFromAnalysis(excluded)).toBe(true)
    const series = reconstructBalanceSeries([
      { id: 'legacy-tide', currency: 'GBP', currentBalance: 0, externalAccountId: 'manual:tide:legacy', includeInCash: true },
    ], [confirmed, unmatched, excluded], { includeExcluded: false })
    expect(series.at(-1)?.balance).toBe(-500)
  })

  it('does not dedupe opposite Current/Saver legs that represent a real internal transfer', () => {
    const rows = deduplicateTransactions(legacyPair().map((row, index) => ({ ...row, importId: `import-${index}`, sourceType: 'tide_statement' })))
    expect(rows).toHaveLength(2)
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(0)
  })
})
