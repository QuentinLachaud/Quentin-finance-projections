import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BankTransactionLedger } from './BankTransactionReview.jsx'

const row = (id, amount, extra = {}) => ({
  id, accountId: 'a', bookedAt: '2026-08-27', amount, currency: 'GBP', status: 'booked',
  category: 'rent', propertyId: 'p1', performanceTreatment: 'auto', excludeFromPerformance: false,
  description: id, accountName: 'Tide', ...extra,
})

describe('Banking compact transaction ledger', () => {
  it('keeps category/property context, amount, exclusion and edit controls in one compact ledger row', () => {
    const html = renderToStaticMarkup(<BankTransactionLedger
      rows={[row('Scott Reoch ref:', 1500)]}
      properties={[{ id: 'p1', name: 'BTL1' }]}
      onEdit={() => true}
      onToggleExcluded={() => true}
    />)
    expect(html).toContain('bank-review-ledger-row')
    expect(html).toContain('bank-review-ledger-tags')
    expect(html).toContain('Rent')
    expect(html).toContain('BTL1')
    expect(html).toContain('aria-label="Exclude Scott Reoch ref: from analysis"')
    expect(html).toContain('aria-label="Edit Scott Reoch ref:"')
    expect(html).toContain('bank-review-row-edit')
  })

  it('shows excluded state without removing the imported transaction from the ledger', () => {
    const html = renderToStaticMarkup(<BankTransactionLedger
      rows={[row('Large acquisition', -36265, { category: 'property_acquisition', excludeFromPerformance: true })]}
      properties={[{ id: 'p1', name: 'BTL1' }]}
      onEdit={() => true}
      onToggleExcluded={() => true}
    />)
    expect(html).toContain('bank-review-ledger-row excluded')
    expect(html).toContain('Large acquisition')
    expect(html).toContain('checked=""')
    expect(html).toContain('Excluded')
  })
})
