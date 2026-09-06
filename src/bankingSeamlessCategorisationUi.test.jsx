import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BankTransactionReview from './BankTransactionReview.jsx'

const row = (id, amount, extra = {}) => ({ id, accountId: 'a', bookedAt: '2026-09-01', amount, currency: 'GBP', status: 'booked', category: 'other', isTransfer: false, propertyId: '', performanceTreatment: 'auto', excludeFromPerformance: false, description: 'Amazon purchase', counterparty: 'Amazon', accountName: 'Tide', ...extra })

describe('Banking seamless review and chart UX', () => {
  it('renders quick cash-extraction categorisation and a reviewed-counterparty suggestion', () => {
    const html = renderToStaticMarkup(<BankTransactionReview transactions={[row('new', -45), row('old', -80, { category: 'cash_extraction', categoryOverridden: true })]} properties={[]} tenants={[]} onUpdate={() => true} onUpdateMany={() => true} />)
    expect(html).toContain('Cash extraction')
    expect(html).toContain('Previous matching transaction')
    expect(html).toContain('value="cash_extraction" selected=""')
  })

  it('keeps a compact DLA visibility control and explicit cash-flow hover/focus hit targets', () => {
    const workspace = readFileSync('src/BankWorkspace.jsx', 'utf8')
    expect(workspace).toContain('Include DLA movements')
    expect(workspace).toContain('includeExcluded: false')
    expect(workspace).toContain('includeOwnerFunding: includeDlaInBalance')
    expect(workspace).toContain('bank-cashflow-hit-area')
    expect(workspace).toContain('Net business cash ${currency(row.net)}')
    expect(workspace).toContain('onFocus={() => setHoveredPeriod(row.period)}')
  })
})
