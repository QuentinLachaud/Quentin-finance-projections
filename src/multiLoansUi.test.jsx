import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PropertyLoansEditor from './PropertyLoansEditor.jsx'
import LoansWorkspace, { LoanEditor } from './LoansWorkspace.jsx'
import { normalizeLoan } from './loans.js'

const property = { id: 'btl-1', name: 'BTL1', latestValuation: 250000 }
const loans = [
  normalizeLoan({ id: 'a', propertyId: 'btl-1', lender: 'Paragon', principalAmount: 100000, rate: .05, fixedRateMonths: 24, fixedStartDate: '2026-01-01' }, [property]),
  normalizeLoan({ id: 'b', propertyId: 'btl-1', lender: 'TMW', principalAmount: 50000, rate: .06, fixedRateMonths: 60, fixedStartDate: '2026-03-01' }, [property]),
]

describe('multiple-loan editor', () => {
  it('renders an accessible aggregate and independent expandable loan rows', () => {
    const html = renderToStaticMarkup(<PropertyLoansEditor property={property} loans={loans} onChange={() => {}} onRemove={() => {}} />)
    expect(html).toContain('BTL loans')
    expect(html).toContain('£150,000')
    expect(html).toContain('£667')
    expect(html).toContain('Paragon')
    expect(html).toContain('TMW')
    expect(html).toContain('Add loan')
    expect((html.match(/aria-expanded="false"/g) || []).length).toBe(2)
  })
  it('reuses the complete loan editor with an optional association control', () => {
    const linked = renderToStaticMarkup(<LoanEditor loan={loans[0]} properties={[property]} allowAssociation={false} onSave={() => {}} onDelete={() => {}} />)
    expect(linked).toContain('Loan amount before fee')
    expect(linked).toContain('Interest only')
    expect(linked).toContain('Fee added to loan')
    expect(linked).not.toContain('Associated BTL')
    const standalone = renderToStaticMarkup(<LoanEditor loan={{ ...loans[0], propertyId: '' }} properties={[property]} onSave={() => {}} onDelete={() => {}} />)
    expect(standalone).toContain('Associated BTL')
    expect(standalone).toContain('BTL1')
  })
  it('keeps two loans visible in the standalone workspace', () => {
    const html = renderToStaticMarkup(<LoansWorkspace loans={loans} properties={[property]} onSave={() => {}} onDelete={() => {}} />)
    expect(html).toContain('Paragon')
    expect(html).toContain('TMW')
    expect(html).toContain('£100,000')
    expect(html).toContain('£50,000')
  })
})
