import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoansWorkspace from './LoansWorkspace.jsx'

describe('LoansWorkspace compact summary', () => {
  it('shows all requested finance metrics in the one-glance row', () => {
    const html = renderToStaticMarkup(<LoansWorkspace
      loans={[{
        id: 'loan-1', propertyId: 'btl-1', lender: 'Paragon', loanAmount: 181587,
        rate: 0.0484, fixedRateMonths: 60, fixedStartDate: '2025-02-28',
        feeMode: 'percent', feeValue: 3, addFeeToLoan: true, ltvBand: 70,
      }]}
      properties={[{ id: 'btl-1', name: 'BTL1', latestValuation: 261924 }]}
      onSave={() => {}}
      onDelete={() => {}}
    />)

    expect(html).toContain('Paragon')
    expect(html).toContain('BTL1')
    expect(html).toContain('£181,587')
    expect(html).toContain('4.84%')
    expect(html).toContain('60 months')
    expect(html).toContain('Monthly cost')
    expect(html).toContain('£732')
    expect(html).not.toContain('added to loan')
    expect(html).not.toContain('paid upfront')
    expect(html).toContain('70% band')
    expect(html).toContain('69.3% actual')
  })
})
