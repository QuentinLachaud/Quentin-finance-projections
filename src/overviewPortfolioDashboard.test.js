import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf8')
const dashboard = readFileSync(fileURLToPath(new URL('./OverviewPortfolioDashboard.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const commandCentre = readFileSync(fileURLToPath(new URL('./overviewCommandCentre.css', import.meta.url)), 'utf8')

const cssMarker = '/* Brain Drain 2026-08-26 19:42 BST — iOS-native Portfolio Overview dashboard */'
const cssStart = styles.indexOf(cssMarker)
const css = cssStart >= 0 ? styles.slice(cssStart) : ''
const overviewStart = app.indexOf("{section === 'Overview' && <>")
const propertiesHeading = app.indexOf('<section className="properties-heading overview-properties-heading">', overviewStart)
const overviewLead = overviewStart >= 0 && propertiesHeading >= 0 ? app.slice(overviewStart, propertiesHeading) : ''

describe('iOS-native Portfolio Overview dashboard', () => {
  it('keeps the overview summary component available', () => {
    expect(app).toContain('<OverviewPortfolioDashboard portfolio={portfolio} settings={state.settings} />')
  })

  it('replaces the old lead metrics/buffer area without changing the Properties boundary', () => {
    expect(app).toContain("import OverviewPortfolioDashboard from './OverviewPortfolioDashboard.jsx'")
    expect(overviewLead).toContain('<OverviewPortfolioDashboard portfolio={portfolio} settings={state.settings} />')
    expect(overviewLead).not.toContain('<section className="metrics-grid">')
    expect(overviewLead).not.toContain('overview-buffer-only')
    expect(overviewLead).not.toContain('mobile-buffer-disclosure')
    expect(app).not.toContain('const [mobileBufferExpanded, setMobileBufferExpanded]')
    expect(propertiesHeading).toBeGreaterThan(overviewStart)
  })

  it('orders the command centre as KPIs, property/clock operations, then scenarios', () => {
    const overviewEnd = app.indexOf("{section === 'Properties' && <>", overviewStart)
    const overview = app.slice(overviewStart, overviewEnd)
    const dashboardAt = overview.indexOf('<OverviewPortfolioDashboard portfolio={portfolio} settings={state.settings} />')
    const propertiesAt = overview.indexOf('className="overview-operating-grid"')
    const clockAt = overview.indexOf('<aside className="overview-rent-rail"')
    const scenariosAt = overview.indexOf('<OverviewScenarioStrip scenarios={portfolio.scenarios}')

    expect(dashboardAt).toBeGreaterThanOrEqual(0)
    expect(propertiesAt).toBeGreaterThan(dashboardAt)
    expect(clockAt).toBeGreaterThan(propertiesAt)
    expect(scenariosAt).toBeGreaterThan(clockAt)
    expect(overview).not.toContain('<section className="panel scenarios-panel overview-cashflow-panel">')
    expect(app).toContain('<details className="overview-scenario-details"')
    expect(app).toContain('onOpenProjections={() => setSection(\'Projections\')}')
  })

  it('shows the four approved summary concepts using existing calculated fields', () => {
    expect(dashboard).toContain("title: 'Monthly Cash Flow'")
    expect(dashboard).toContain("title: 'Portfolio Position'")
    expect(dashboard).toContain("title: 'Portfolio LTV'")
    expect(dashboard).toContain("title: 'Safety Buffer'")
    expect(dashboard).toContain('value: currency(scenario.cashflow)')
    expect(dashboard).toContain('value: currency(portfolio.totalEquity)')
    expect(dashboard).toContain('value: percent(portfolioLtv, 1)')
    expect(dashboard).toContain('`${finite(portfolio.bufferMonths).toFixed(1)} months`')
  })

  it('explains cash flow from the existing scenario and portfolio breakdown rather than duplicating calculations', () => {
    expect(dashboard).toContain('scenario.voidLoss')
    expect(dashboard).toContain('portfolio.propertyFixedCosts')
    expect(dashboard).toContain('scenario.management')
    expect(dashboard).toContain('scenario.problemBudget')
    expect(dashboard).toContain('portfolio.companyCosts')
    expect(dashboard).toContain('scenario.tax')
    expect(dashboard).toContain('scenario.bankCashflow')
    expect(dashboard).toContain('portfolio.extractionTotal')
    expect(dashboard).toContain("'Company + extraction cash'")
  })

  it('uses existing property position, financing and buffer fields in drill-down content', () => {
    expect(dashboard).toContain('property.latestValuation')
    expect(dashboard).toContain('property.loanAmount')
    expect(dashboard).toContain('property.equity')
    expect(dashboard).toContain('property.currentRate')
    expect(dashboard).toContain('portfolio.cashHeld')
    expect(dashboard).toContain('portfolio.safeCashNeeded')
    expect(dashboard).toContain('portfolio.fixedCosts')
    expect(dashboard).toContain('portfolio.variableCosts')
    expect(dashboard).toContain('portfolio.extraCashNeeded')
  })

  it('makes every card directly interactive and exposes one accessible reusable dialog', () => {
    expect(dashboard).toContain('aria-haspopup="dialog"')
    expect(dashboard).toContain('aria-expanded={activeInsight === card.id}')
    expect(dashboard).toContain('onClick={(event) => openInsight(card.id, event)}')
    expect(dashboard).toContain('role="dialog"')
    expect(dashboard).toContain('aria-modal="true"')
    expect(dashboard).toContain('aria-labelledby={`overview-insight-${activeCard.id}-title`}')
  })

  it('dismisses outside, by Escape and close control, while restoring focus and scroll state', () => {
    expect(dashboard).toContain('if (event.target === event.currentTarget) closeInsight()')
    expect(dashboard).toContain("if (event.key === 'Escape') closeInsight()")
    expect(dashboard).toContain('onClick={closeInsight}><X')
    expect(dashboard).toContain("document.body.style.overflow = 'hidden'")
    expect(dashboard).toContain("document.documentElement.style.overflow = 'hidden'")
    expect(dashboard).toContain('source?.focus?.({ preventScroll: true })')
  })

  it('morphs from the source card and reverses into its live card geometry on close', () => {
    expect(dashboard).toContain('source.getBoundingClientRect()')
    expect(dashboard).toContain('panel.getBoundingClientRect()')
    expect(dashboard).toContain('source?.getBoundingClientRect?.() || sourceRectRef.current')
    expect(dashboard).toContain('typeof panel.animate !== \'function\'')
    expect(dashboard).toContain('panel.animate([')
    expect(dashboard).toContain('translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})')
    expect(dashboard).toContain('prefersReducedMotion()')
  })

  it('uses compact responsive command-centre metrics while retaining accessible sheets', () => {
    expect(cssStart).toBeGreaterThanOrEqual(0)
    expect(css).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif')
    expect(commandCentre).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
    expect(commandCentre).toContain('.overview-summary-cashflow { grid-column: span 2;')
    expect(commandCentre).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(commandCentre).toContain('.overview-rent-rail { order: -1; width: 100%; }')
    expect(css).toContain('place-items: end center')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(commandCentre).toContain('@media (prefers-reduced-motion: reduce)')
  })


})

