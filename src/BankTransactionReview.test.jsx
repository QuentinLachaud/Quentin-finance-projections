import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BankTransactionReview from './BankTransactionReview.jsx'

const row = (id, amount, description, extra = {}) => ({
  id, accountId: 'a', bookedAt: '2026-09-01', amount, currency: 'GBP', status: 'booked',
  category: 'other', isTransfer: false, propertyId: '', performanceTreatment: 'auto',
  excludeFromPerformance: false, description, accountName: 'Tide', ...extra,
})

describe('BankTransactionReview minimal-input UX', () => {
  it('renders the largest unresolved movement first and keeps advanced overrides hidden initially', () => {
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[
      row('small', -20, 'Small unresolved'), row('large', -5000, 'Large unresolved'),
    ]} properties={[]} onUpdate={() => {}} onUpdateMany={() => {}} />)
    expect(html.indexOf('Large unresolved')).toBeLessThan(html.indexOf('Small unresolved'))
    expect(html).toContain('Largest first')
    expect(html).toContain('Advanced')
    expect(html).not.toContain('<span>Performance</span>')
  })

  it('requires no review for already classified DLA and transfer rows', () => {
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[
      row('dla', 10000, 'Director loan', { category: 'dla_injected' }),
      row('transfer', -5000, 'Savings account', { category: 'transfer', isTransfer: true }),
    ]} properties={[]} onUpdate={() => {}} onUpdateMany={() => {}} />)
    expect(html).toContain('No transactions need review.')
  })

  it('counts only unresolved exact matches for Apply to similar', () => {
    const sameParty = { counterparty: 'Tenant One' }
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[
      row('source', 1100, 'Tenant One ref:', sameParty),
      row('peer', 1100, 'Tenant One ref:', sameParty),
      row('reviewed', 1100, 'Tenant One ref:', { ...sameParty, category: 'rent', propertyId: 'p1' }),
    ]} properties={[{ id: 'p1', name: 'BTL1' }]} onUpdate={() => true} onUpdateMany={() => true} />)
    expect(html).toContain('Apply to 1 similar')
    expect(html).not.toContain('Apply to 2 similar')
  })

})
