import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BankTransactionReview from './BankTransactionReview.jsx'

const row = (id, amount, description, extra = {}) => ({
  id, accountId: 'a', bookedAt: '2026-09-01', amount, currency: 'GBP', status: 'booked',
  category: 'other', isTransfer: false, propertyId: '', performanceTreatment: 'auto',
  excludeFromPerformance: false, description, accountName: 'Tide', ...extra,
})

describe('BankTransactionReview focused inbox UX', () => {
  it('shows one focused largest unresolved transaction with explicit completion controls and a small next-up preview', () => {
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[
      row('small', -20, 'Small unresolved'), row('large', -5000, 'Large unresolved'),
    ]} properties={[]} onUpdate={() => true} onUpdateMany={() => true} />)
    expect(html).toContain('Review transactions')
    expect(html).toContain('Save &amp; next')
    expect(html).toContain('Skip')
    expect(html).toContain('Next up')
    expect(html.indexOf('Large unresolved')).toBeLessThan(html.indexOf('Small unresolved'))
    expect((html.match(/bank-review-focus/g) || [])).toHaveLength(1)
  })

  it('requires no review for already classified DLA and transfer rows', () => {
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[
      row('dla', 10000, 'Director loan', { category: 'dla_injected' }),
      row('transfer', -5000, 'Savings account', { category: 'transfer', isTransfer: true }),
    ]} properties={[]} onUpdate={() => true} onUpdateMany={() => true} />)
    expect(html).toContain('All caught up. No transactions need review.')
  })

  it('presents exact unresolved matches as one clearly labelled batch option', () => {
    const sameParty = { counterparty: 'Tenant One' }
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[
      row('source', 1100, 'Tenant One ref:', sameParty),
      row('peer', 1100, 'Tenant One ref:', sameParty),
      row('reviewed', 1100, 'Tenant One ref:', { ...sameParty, category: 'rent', propertyId: 'p1' }),
    ]} properties={[{ id: 'p1', name: 'BTL1' }]} onUpdate={() => true} onUpdateMany={() => true} />)
    expect(html).toContain('Also apply to 1 matching transaction')
    expect(html).toContain('Exact counterparty match · unresolved rows only')
    expect(html).not.toContain('Also apply to 2 matching transactions')
  })

  it('preselects a uniquely suggested property in the review draft without mutating the source row', () => {
    const source = row('mortgage', -900, 'Paragon monthly mortgage', { category: 'mortgage' })
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[source]} properties={[
      { id: 'p1', name: 'BTL1', lender: 'Paragon' }, { id: 'p2', name: 'BTL2', lender: 'The Mortgage Works' },
    ]} onUpdate={() => true} onUpdateMany={() => true} />)
    expect(source.propertyId).toBe('')
    expect(html).toContain('Suggested from transaction details')
    expect(html).toContain('value="p1" selected=""')
  })
})
