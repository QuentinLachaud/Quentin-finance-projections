import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('./OverviewPortfolioDashboard.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./overviewCommandCentre.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8')
const rentClock = readFileSync(new URL('./RentMonthDial.jsx', import.meta.url), 'utf8')

const start = app.indexOf("{section === 'Overview' && <>")
const end = app.indexOf("{section === 'Properties' && <>", start)
const overview = app.slice(start, end)
const propertyStart = app.indexOf('function OverviewPropertyRow(')
const propertyEnd = app.indexOf('function ModelInputFields(', propertyStart)
const propertyRow = app.slice(propertyStart, propertyEnd)

describe('reversible Overview command centre', () => {
  it('isolates the new styling and preserves all financial calculations', () => {
    expect(main).toContain("import './overviewCommandCentre.css'")
    expect(overview).toContain('<OverviewPortfolioDashboard portfolio={portfolio} settings={state.settings} />')
    expect(dashboard).toContain('value: currency(scenario.cashflow)')
    expect(dashboard).toContain('value: currency(portfolio.totalEquity)')
    expect(dashboard).toContain('percent(portfolioLtv, 1)')
    expect(dashboard).toContain('portfolio.safeCashNeeded')
    expect(dashboard).toContain('portfolio.weightedRate')
    expect(app).toContain('? calculateMultiCompanyPortfolio(propertiesWithLoans, state.companies, state.settings)')
  })

  it('orders the four top cards, expanded scenarios, then Properties without duplicating the clock', () => {
    const dashboardAt = overview.indexOf('<OverviewPortfolioDashboard ')
    const propertiesAt = overview.indexOf('className="overview-operating-grid"')
    const clockAt = overview.indexOf('<RentMonthDial ')
    const scenariosAt = overview.indexOf('<OverviewScenarioStrip ')
    expect(dashboardAt).toBeGreaterThanOrEqual(0)
    expect(clockAt).toBeGreaterThan(dashboardAt)
    expect(scenariosAt).toBeGreaterThan(clockAt)
    expect(propertiesAt).toBeGreaterThan(scenariosAt)
    expect(overview.indexOf('</aside>')).toBeLessThan(scenariosAt)
    expect((app.match(/<RentMonthDial /g) || [])).toHaveLength(1)
    expect(rentClock).toContain('rent-progress-fill')
    expect(rentClock).toContain('formatRentCycleDate(cycle.previousDueDate)')
    expect(rentClock).toContain('formatRentCycleDate(cycle.nextDueDate)')
  })

  it('keeps cash flow and next fix visible while preserving expanded property controls', () => {
    expect(propertyRow).toContain('label="Cash flow / mo"')
    expect(propertyRow).toContain('label="Next fix"')
    expect(propertyRow).toContain('propertyMetricSupported(property, \'operatingCashflow\')')
    expect(propertyRow).toContain('propertyMetricSupported(property, \'nextRemortgage\')')
    expect(propertyRow).toContain('<span>Rent / mo</span>')
    expect(propertyRow).toContain('<span>Net yield</span>')
    expect(propertyRow).toContain('<PropertyFinancingSummary property={property} variant="row" />')
    expect(propertyRow).toContain('onClick={() => onEdit(property.id)}')
    expect(overview).toContain('onToggle={toggleProperty}')
  })

  it('summarises three scenarios with detail expanded by default and a projections shortcut', () => {
    expect(app).toContain('function OverviewScenarioStrip(')
    expect(app).toContain('overview-scenario-kpis')
    expect(app).toContain('scenarios.map((scenario, index)')
    expect(app).toContain('<details className="overview-scenario-details" id="overview-scenario-details" open>')
    expect(app).toContain('<ScenarioTable scenarios={scenarios} count={count} accountType={accountType} variant="overview" />')
    expect(overview).toContain("onOpenProjections={() => setSection('Projections')}")
    expect(app).toContain("isPrivate ? 'After estimated property income tax' : 'Before personal tax on extraction'")
    expect(overview).not.toContain('className="panel scenarios-panel overview-cashflow-panel"')
  })

  it('uses four desktop top-row items and a stacked phone clock', () => {
    expect(css).toContain('.overview-desktop-summary-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(css).toContain('.overview-desktop-summary-row .overview-summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('.overview-desktop-summary-row .overview-rent-rail { order: 1; width: 100%; }')
    expect(css).toContain('.overview-desktop-summary-row .overview-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(css).toContain('.overview-rent-rail .rent-progress-widget { flex-direction: row; max-width: none; }')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
