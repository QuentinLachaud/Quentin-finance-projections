import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoansWorkspace from './LoansWorkspace.jsx'

const loans = [
  { id: 'one', propertyId: 'p1', lender: 'Paragon', principalAmount: 100000, loanAmount: 100000, rate: .05, fixedStartDate: '2025-01-01', fixedRateMonths: 24, interestOnly: true },
  { id: 'two', propertyId: 'p1', lender: 'TMW', principalAmount: 50000, loanAmount: 50000, rate: .06, fixedStartDate: '2024-01-01', fixedRateMonths: 24, interestOnly: true },
  { id: 'three', propertyId: '', lender: 'Unlinked', principalAmount: 20000, loanAmount: 20000, rate: .04, interestOnly: true },
]

describe('LoansWorkspace grouping controls', () => {
  it('renders accessible controls, independent loans, property totals and an unlinked group', () => {
    const html = renderToStaticMarkup(<LoansWorkspace loans={loans} properties={[{ id: 'p1', name: 'BTL1', latestValuation: 250000 }]} onSave={() => {}} onDelete={() => {}} />)
    expect(html).toContain('aria-label="Group loans"')
    expect(html).toContain('aria-label="Sort loans"')
    expect(html).toContain('Fixed ending first')
    expect(html).toContain('Rate: high to low')
    expect(html).toContain('Balance: low to high')
    expect(html).toContain('aria-label="BTL1, 2 loans"')
    expect(html).toContain('Manual / unlinked loans')
    expect(html).toContain('£150,000')
    expect(html).toContain('£667')
    expect(html.match(/class="loan-row /g)).toHaveLength(3)
    expect(html.indexOf('<strong>TMW</strong>')).toBeLessThan(html.indexOf('<strong>Paragon</strong>'))
    expect(html).not.toContain('Delete this loan?')
  })
})
