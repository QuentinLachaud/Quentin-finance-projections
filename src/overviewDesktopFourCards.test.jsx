import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import OverviewPortfolioDashboard from './OverviewPortfolioDashboard.jsx'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./overviewCommandCentre.css', import.meta.url), 'utf8')
const start = app.indexOf("{section === 'Overview' && <>")
const end = app.indexOf("{section === 'Properties' && <>", start)
const overview = app.slice(start, end)

const portfolio = {
  scenarios: [{ cashflow: 369, tax: 0 }],
  rent: 3850,
  totalEquity: 117469,
  totalValue: 588000,
  totalLoans: 470531,
  weightedRate: 0.0587,
  bufferMonths: 4.2,
  extraCashNeeded: 0,
  cashHeld: 10000,
  safeCashNeeded: 8000,
  selected: [],
}
const settings = { accountType: 'company', bufferMonths: 6 }

describe('reference desktop Overview layout', () => {
  it('keeps one clock ahead of full-width Properties and scenarios', () => {
    const row = overview.indexOf('className="overview-desktop-summary-row"')
    const dashboard = overview.indexOf('<OverviewPortfolioDashboard ')
    const clock = overview.indexOf('<RentMonthDial ')
    const properties = overview.indexOf('className="overview-operating-grid"')
    const scenarios = overview.indexOf('<OverviewScenarioStrip ')
    expect(row).toBeGreaterThanOrEqual(0)
    expect(row).toBeLessThan(dashboard)
    expect(dashboard).toBeLessThan(clock)
    expect(clock).toBeLessThan(properties)
    expect(properties).toBeLessThan(scenarios)
    expect((app.match(/<RentMonthDial /g) || [])).toHaveLength(1)
  })

  it('renders all four phone KPIs, with an independent desktop equity/LTV subrow', () => {
    const html = renderToStaticMarkup(<OverviewPortfolioDashboard portfolio={portfolio} settings={settings} />)
    expect((html.match(/class="overview-summary-card /g) || [])).toHaveLength(4)
    expect(html).toContain('Monthly Cash Flow')
    expect(html).toContain('Portfolio Position')
    expect(html).toContain('Portfolio LTV')
    expect(html).toContain('Safety Buffer')
    expect(html).toContain('overview-position-desktop-label')
    expect(html).toContain('overview-position-financing')
    expect(html).toContain('>LTV</span><strong>80.0%</strong>')
    expect(html).toContain('>Weighted rate</span><strong>5.87%</strong>')
  })

  it('sets four equal-width desktop columns with three centered KPI cards and a matching clock', () => {
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(css).toContain('grid-column: span 3')
    expect(css).toContain('justify-content: center;')
    expect(css).toContain('align-items: center;')
    expect(css).toContain('.overview-summary-financing { display: none; }')
    expect(css).toContain('.overview-rent-rail { grid-column: 4; }')
    expect(css).toContain('.overview-operating-grid { display: block;')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('.overview-summary-financing { display: block; }')
    expect(css).toContain('.overview-position-desktop-label,\n.overview-position-financing { display: none; }')
  })
})
