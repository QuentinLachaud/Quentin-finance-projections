import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoansWorkspace from './LoansWorkspace.jsx'
import { groupLoans, loanGroupTotals } from './loanSorting.js'

const properties = [{ id: 'p1', name: 'BTL1', latestValuation: 250000 }, { id: 'p2', name: 'BTL2', latestValuation: 200000 }]
const loans = [
  { id: 'one', propertyId: 'p1', lender: 'Paragon', principalAmount: 100000, loanAmount: 100000, rate: .05, fixedStartDate: '2025-01-01', fixedRateMonths: 24, interestOnly: true },
  { id: 'two', propertyId: 'p1', lender: 'TMW', principalAmount: 50000, loanAmount: 50000, rate: .06, fixedStartDate: '2024-01-01', fixedRateMonths: 24, interestOnly: true },
  { id: 'three', propertyId: 'p2', lender: 'Second property', principalAmount: 75000, loanAmount: 75000, rate: .04, interestOnly: true },
  { id: 'four', propertyId: '', lender: 'Unlinked', principalAmount: 20000, loanAmount: 20000, rate: .04, interestOnly: true },
]
const render = (items = loans) => renderToStaticMarkup(<LoansWorkspace loans={items} properties={properties} onSave={() => {}} onDelete={() => {}} />)
const card = (html, id) => {
  const match = html.match(new RegExp('<section[^>]*data-loan-group="' + id + '"[^>]*>([\\s\\S]*?)</section>'))
  expect(match).not.toBeNull()
  return match[1]
}

describe('Nested property loan cards', () => {
  it('contains each loan exactly once inside its owning property card', () => {
    const html = render()
    expect(html.match(/class="loan-property-card"/g)).toHaveLength(3)
    const first = card(html, 'p1')
    expect(first).toContain('Paragon')
    expect(first).toContain('TMW')
    expect(first).not.toContain('Second property')
    expect(first).not.toContain('Unlinked')
    expect(card(html, 'p2')).toContain('Second property')
    expect(card(html, 'unlinked')).toContain('Unlinked')
    expect(html.match(/class="loan-row /g)).toHaveLength(4)
  })

  it('preserves accessible independent controls and the expected sort order', () => {
    const html = render()
    const first = card(html, 'p1')
    expect(first).toContain('aria-label="BTL1, 2 loans"')
    expect(first).toContain('aria-controls="loan-group-p1"')
    expect(first).toContain('aria-expanded="true"')
    expect(first).toContain('id="loan-group-p1"')
    expect(first).toContain('£150,000')
    expect(first).toContain('£667')
    expect(first.indexOf('<strong>TMW</strong>')).toBeLessThan(first.indexOf('<strong>Paragon</strong>'))
    expect(html).toContain('aria-label="Group loans"')
    expect(html).toContain('aria-label="Sort loans"')
    expect(html).not.toContain('Delete this loan?')
  })

  it('keeps totals and associations unchanged for multiple loans', () => {
    const before = groupLoans(loans, properties)
    expect(before.find(group => group.id === 'p1').loans.map(loan => loan.id)).toEqual(['two', 'one'])
    expect(loanGroupTotals(before.find(group => group.id === 'p1').loans)).toMatchObject({ balance: 150000, monthlyPayment: 666.6666666666667, count: 2 })
    const html = render(loans.filter(loan => loan.id !== 'two'))
    expect(card(html, 'p1')).not.toContain('TMW')
    expect(card(html, 'p1')).toContain('1 loan')
    expect(card(html, 'p2')).toContain('Second property')
  })
})
