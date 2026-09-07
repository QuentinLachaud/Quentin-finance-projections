import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CashFlowChart } from './BankWorkspace.jsx'
import { BalanceChart } from './BankingVisuals.jsx'

describe('Banking timeline rendering', () => {
  it('renders every historical cash-flow period on mobile as well as desktop', () => {
    const rows = Array.from({ length: 20 }, (_, index) => {
      const year = 2025 + Math.floor((index + 1) / 12)
      const month = (index + 1) % 12 + 1
      return { period: `${year}-${String(month).padStart(2, '0')}`, inflow: 100, outflow: 0, net: 100, count: 1 }
    })
    const html = renderToStaticMarkup(<CashFlowChart rows={rows} />)
    expect(html).toContain('Feb 2025')
    expect(html).toContain('Sep 2026')
    expect(html.match(/class="bank-mobile-period"/g)).toHaveLength(20)
    expect(html.match(/class="bank-cashflow-hit-area"/g)).toHaveLength(20)
  })

  it('renders a real one-point balance history rather than claiming it is empty', () => {
    const html = renderToStaticMarkup(<BalanceChart points={[{ date: '2025-02-01', balance: 0 }]} />)
    expect(html).toContain('Feb 2025')
    expect(html).toContain('bank-balance-mobile')
    expect(html).not.toContain('Balance history will appear after transactions are synced')
  })
})
