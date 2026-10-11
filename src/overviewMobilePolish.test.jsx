import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import OverviewPortfolioDashboard from './OverviewPortfolioDashboard.jsx'
import RentMonthDial from './RentMonthDial.jsx'

const commands = readFileSync(new URL('./overviewCommandCentre.css', import.meta.url), 'utf8')
const rentStyles = readFileSync(new URL('./RentMonthDial.css', import.meta.url), 'utf8')
const rentSource = readFileSync(new URL('./RentMonthDial.jsx', import.meta.url), 'utf8')

const portfolio = {
  scenarios: [{ cashflow: 690 }],
  rent: 2750,
  totalEquity: 118469,
  totalValue: 412780,
  totalLoans: 294311,
  weightedRate: .0579,
  bufferMonths: 7,
  cashHeld: 14000,
  safeCashNeeded: 12000,
  extraCashNeeded: 0,
  selected: [],
}

describe('phone overview: useful at a glance without desktop regressions', () => {
  it('renders accessible KPI buttons and a mobile buffer comparison using the existing target', () => {
    const html = renderToStaticMarkup(
      <OverviewPortfolioDashboard portfolio={portfolio} settings={{ accountType: 'company', bufferMonths: 6 }} />,
    )
    expect((html.match(/class="overview-summary-card /g) || [])).toHaveLength(3)
    expect(html).toContain('Equity &amp; LTV')
    expect(html).toContain('Safety buffer')
    expect(html).toContain('Target 6.0 mo')
    expect(html).toContain('On target')
    expect(html).toContain('width:100%')
    expect(html).toContain('aria-label="Safety Buffer: 7.0 months. Open details."')
  })

  it('shows a shortfall visibly and uses the actual ratio for its progress bar', () => {
    const html = renderToStaticMarkup(
      <OverviewPortfolioDashboard portfolio={{ ...portfolio, cashHeld: 6000, safeCashNeeded: 12000, bufferMonths: 3, extraCashNeeded: 6000 }} settings={{ accountType: 'company', bufferMonths: 6 }} />,
    )
    expect(html).toContain('Below target')
    expect(html).toContain('width:50%')
    expect(html).toContain('3.0 months')
  })

  it('does not remove the three-card desktop layout and scopes the compact UI to phones', () => {
    expect(commands).toContain('@media (min-width: 1181px)')
    expect(commands).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(commands).toContain('/* 2026-10-11: mobile-first portfolio overview polish.')
    expect(commands).toMatch(/@media \(max-width: 760px\)[\s\S]*?overview-buffer-mobile-status/)
    expect(commands).toContain('@media (max-width: 360px)')
  })

  it('centres only the next rent countdown, with no stacked current-day content', () => {
    const html = renderToStaticMarkup(<RentMonthDial tenants={[]} properties={[]} />)
    expect(html).toContain('No rent due')
    expect(html).toContain('Last rent')
    expect(html).toContain('Next rent')
    expect(html).not.toContain('rent-progress-eyebrow')
    expect(html).not.toContain('rent-progress-month')
    expect(html).not.toContain('rent-progress-divider')
    expect(rentSource).toContain("cycle.daysUntil === 1 ? 'day to rent' : 'days to rent'")
    expect(rentStyles).toContain('.rent-progress-centre .rent-progress-count')
    expect(rentStyles).toContain('inset: 14%')
  })
})
