import { describe, expect, it } from 'vitest'
import {
  BANK_CATEGORIES, balanceSeriesWithoutOwnerFundingDates, classifyTransaction, performanceTreatmentForTransaction,
  reviewDraftForTransaction, summarizeCashFlowPipeline,
} from './banking.js'

const tx = (id, amount, extra = {}) => ({ id, accountId: 'a', bookedAt: '2026-08-01', amount, currency: 'GBP', status: 'booked', category: 'other', isTransfer: false, propertyId: '', performanceTreatment: 'auto', ...extra })

describe('Banking seamless categorisation follow-up', () => {
  it('adds cash extraction without treating Amazon as extraction before the user confirms it', () => {
    expect(BANK_CATEGORIES.map(([value]) => value)).toContain('cash_extraction')
    expect(classifyTransaction({ description: 'Cash extraction distribution' })).toBe('cash_extraction')
    expect(classifyTransaction({ description: 'AMAZON UK Marketplace' })).toBe('other')
    expect(performanceTreatmentForTransaction({ category: 'cash_extraction' })).toBe('extraction')
    expect(performanceTreatmentForTransaction({ category: 'payroll' })).toBe('extraction')
  })

  it('keeps extraction outside business-generated cash but inside bank reconciliation', () => {
    const summary = summarizeCashFlowPipeline([
      tx('rent', 1650, { category: 'rent', propertyId: 'p1' }),
      tx('salary', -875, { category: 'payroll' }),
      tx('amazon', -125, { category: 'cash_extraction' }),
    ])
    expect(summary.companyFreeCashFlow).toBe(1650)
    expect(summary.cashExtractionNet).toBe(-1000)
    expect(summary.cashExtractionCount).toBe(2)
    expect(summary.netBankMovement).toBe(650)
  })

  it('removes owner-funding movement dates from the display series while retaining the latest actual balance', () => {
    const series = [{ date: '2026-01-01', balance: 1000 }, { date: '2026-01-10', balance: 21000 }, { date: '2026-01-11', balance: 1200 }, { date: '2026-01-31', balance: 1500 }]
    expect(balanceSeriesWithoutOwnerFundingDates(series, [tx('dla', 20000, { bookedAt: '2026-01-10', category: 'owner_funding' })], ['a'])).toEqual([series[0], series[2], series[3]])
  })

  it('reuses one consistent reviewed exact counterparty as a non-persistent draft suggestion', () => {
    const previous = tx('old', -80, { description: 'Amazon purchase', counterparty: 'Amazon', category: 'cash_extraction', categoryOverridden: true })
    const current = tx('new', -45, { description: 'Amazon purchase', counterparty: 'Amazon' })
    const draft = reviewDraftForTransaction(current, [], [], [current, previous])
    expect(current.category).toBe('other')
    expect(draft).toMatchObject({ category: 'cash_extraction', suggestionReason: 'Previous matching transaction' })
  })
})
