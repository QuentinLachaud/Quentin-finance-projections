import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BalanceChart, BankSummary, CashFlowReconciliation } from './BankingVisuals.jsx'

const points = [
  { date: '2026-01-12', balance: 10420 },
  { date: '2026-02-18', balance: 12150 },
  { date: '2026-03-20', balance: 14780 },
  { date: '2026-04-11', balance: 17950 },
]

const cashSummary = {
  operatingCashFlow: 3400,
  companyOnlyCashFlow: -600,
  financingCashFlow: -1200,
  companyFreeCashFlow: 1600,
  ownerFundingNet: 5000,
  capitalMovementNet: -25000,
  capitalMovementCount: 1,
  liabilityMovementNet: 0,
  liabilityMovementCount: 2,
  reviewNet: -200,
  reviewAbsolute: 200,
  reviewCount: 1,
  excludedNet: -100,
  excludedCount: 1,
  internalTransferCount: 2,
  internalTransferAbsolute: 9000,
  rawBankMovement: -18700,
  netBankMovement: -18600,
}

describe('Banking less-is-more visuals', () => {
  it('renders rounded Y-axis labels, month/year X labels and a dedicated hover hit target', () => {
    const html = renderToStaticMarkup(<BalanceChart points={points} />)
    expect(html).toContain('£10K')
    expect(html).toContain('£18K')
    expect(html).toContain('Jan 2026')
    expect(html).toContain('Apr 2026')
    expect(html).toContain('bank-balance-hit-area')
    expect(html).toContain('bank-balance-mobile')
  })

  it('does not present a missing imported-statement balance as a real £0 cash balance', () => {
    const html = renderToStaticMarkup(<BankSummary reportingBalance={null} reportingAccountCount={1} cashSummary={cashSummary} />)
    expect(html).toContain('Cash balance')
    expect(html).toContain('>—<')
    expect(html).toContain('Current balance unavailable from imported statement')
    expect(html).not.toContain('<strong>£0</strong>')
  })

  it('keeps five plain-language reconciliation cards with detail on demand', () => {
    const html = renderToStaticMarkup(<CashFlowReconciliation cashSummary={cashSummary} />)
    expect(html).toContain('Business cash generated')
    expect(html).toContain('Owner funding')
    expect(html).toContain('Other bank movement')
    expect(html).toContain('Net bank movement')
    expect(html).toContain('Show detailed breakdown')
    expect(html).toContain('Capital / acquisition')
    expect(html).toContain('Tenant deposits')
    expect(html).toContain('Confirmed internal transfers')
    expect(html).toContain('Raw statement movement')
    expect(html).toContain('Unreconciled transfer movement')
  })
})
