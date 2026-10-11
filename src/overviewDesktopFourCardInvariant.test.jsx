import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import OverviewPortfolioDashboard from './OverviewPortfolioDashboard.jsx'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./overviewCommandCentre.css', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('./OverviewPortfolioDashboard.jsx', import.meta.url), 'utf8')
const start = app.indexOf("{section === 'Overview' && <>")
const end = app.indexOf("{section === 'Properties' && <>", start)
const overview = app.slice(start, end)
const finalLayout = css.slice(css.indexOf('/* Brain Drain 2026-10-11 — exactly three financial cards'))

const portfolio = {
  scenarios: [{ cashflow: 630, tax: 0 }],
  rent: 3850,
  totalEquity: 117813,
  totalValue: 589065,
  totalLoans: 471252,
  weightedRate: 0.0511,
  bufferMonths: 4.5,
  cashHeld: 10000,
  safeCashNeeded: 8000,
  selected: [],
}

describe('single-row desktop Overview KPI contract', () => {
  it('renders exactly three financial cards; second card combines equity, LTV and rate', () => {
    const html = renderToStaticMarkup(<OverviewPortfolioDashboard portfolio={portfolio} settings={{ accountType: 'company', bufferMonths: 6 }} />)
    expect((html.match(/class="overview-summary-card /g) || [])).toHaveLength(3)
    expect([...html.matchAll(/aria-label="([^"]+)\. Open details\."/g)].map(m => m[1].split(':')[0].replaceAll('&amp;', '&')))
      .toEqual(['Monthly Cash Flow', 'Portfolio Position & LTV', 'Safety Buffer'])
    expect(html).not.toContain('overview-summary-financing')
    expect(html).toContain('overview-position-financing')
    expect(html).toContain('>LTV</small><strong>80.0%</strong>')
    expect(html).toContain('>Weighted rate</small><strong>5.11%</strong>')
  })

  it('puts the only Rent Clock in position four before Properties', () => {
    expect(overview).toContain('className="overview-desktop-summary-row"')
    const row = overview.slice(overview.indexOf('className="overview-desktop-summary-row"'),overview.indexOf('className="overview-operating-grid"'))
    expect(row.indexOf('<OverviewPortfolioDashboard')).toBeLessThan(row.indexOf('<aside className="overview-rent-rail"'))
    expect(row).toContain('<RentMonthDial tenants={state.tenants} properties={state.properties} />')
    expect((app.match(/<RentMonthDial /g)||[])).toHaveLength(1)
    expect(overview.indexOf('className="overview-operating-grid"')).toBeGreaterThan(overview.indexOf('</aside>'))
  })

  it('locks desktop grid to four equal columns: three KPIs + one clock with no wrap', () => {
    expect(finalLayout).toMatch(/@media \(min-width: 1181px\)\s*\{[\s\S]*?\.overview-desktop-summary-row \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
    expect(finalLayout).toContain('.overview-desktop-summary-row .overview-summary-dashboard { grid-column: span 3')
    expect(finalLayout).toContain('.overview-desktop-summary-row .overview-summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(finalLayout).toContain('.overview-desktop-summary-row .overview-summary-card { grid-column: span 1')
    expect(finalLayout).toContain('.overview-desktop-summary-row .overview-rent-rail { grid-column: 4; grid-row: 1')
    expect(finalLayout).toContain('.overview-operating-grid { display: block; }')
    expect(dashboard).not.toContain("id: 'financing'")
    expect(css.indexOf('@media (max-width: 760px)',css.indexOf('exactly three financial cards'))).toBeGreaterThan(0)
  })
})
