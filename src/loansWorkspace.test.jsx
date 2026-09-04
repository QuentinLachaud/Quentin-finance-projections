import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoansWorkspace from './LoansWorkspace.jsx'

describe('LoansWorkspace compact summary', () => {
  it('shows the effective capitalised balance and monthly cost in the collapsed one-glance row', () => {
    const html = renderToStaticMarkup(<LoansWorkspace
      loans={[{
        id: 'loan-1', propertyId: 'btl-1', lender: 'Paragon', principalAmount: 181587, loanAmount: 187034.61,
        rate: 0.0484, fixedRateMonths: 60, fixedStartDate: '2025-02-28',
        feeMode: 'percent', feeValue: 3, addFeeToLoan: true, ltvBand: 75,
      }]}
      properties={[{ id: 'btl-1', name: 'BTL1', latestValuation: 261924 }]}
      onSave={() => {}}
      onDelete={() => {}}
    />)

    expect(html).toContain('Paragon')
    expect(html).toContain('BTL1')
    expect(html).toContain('Loan balance')
    expect(html).toContain('£187,035')
    expect(html).toContain('4.84%')
    expect(html).toContain('60 months')
    expect(html).toContain('Monthly payment')
    expect(html).toContain('£754')
    expect(html).toContain('75% band')
    expect(html).toContain('71.4% actual')
  })
})
