import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.jsx', 'utf8')
const model = readFileSync('src/performance.js', 'utf8')
const ui = readFileSync('src/PerformanceWorkspace.jsx', 'utf8')
const styles = readFileSync('src/styles.css', 'utf8')

describe('Performance integration', () => {
  it('keeps Performance as a portfolio workspace and stores only manual performance adjustments in portfolio JSON', () => {
    expect(app).toContain("['Performance', 'Performance', TrendingUp, 'PORTFOLIO']")
    expect(app).toContain("Performance: {")
    expect(app).toContain("import PerformanceWorkspace from './PerformanceWorkspace.jsx'")
    expect(app).toContain('performanceEvents: normalizePerformanceEvents(portfolioState.performanceEvents, migratedProperties)')
    expect(app).toContain("{section === 'Performance' && <PerformanceWorkspace")
    expect(app).not.toContain("from('performance_")
  })

  it('derives actual graph histories from dated ledgers and snapshots without inventing historical rent or costs', () => {
    expect(model).toContain("sourceType: 'expense'")
    expect(model).toContain("event.sourceField === 'rent'")
    expect(model).toContain('rentBefore:')
    expect(model).toContain('cumulativeNetIncome')
    expect(model).toContain('cumulativeCosts')
    expect(model).toContain('cumulativeAppreciation')
    expect(model).toContain('monthlyRent')
    expect(model).toContain('hasNumber(event.assetValue)')
    expect(model).toContain('No dated income or cost entries are available')
    expect(model).not.toContain('backfillRent')
    expect(ui).toContain('does not backfill current assumptions into the past')
  })

  it('provides explicit graph views, metric toggles, calendar-month ticks and clean currency-axis intervals', () => {
    expect(ui).toContain("label: 'Value & debt'")
    expect(ui).toContain("label: 'Rent'")
    expect(ui).toContain("label: 'Cash'")
    expect(ui).toContain("label: 'Return'")
    expect(ui).toContain('Displayed metrics')
    expect(ui).toContain("month: 'short'")
    expect(ui).toContain('niceCurrencyTicks')
    expect(ui).toContain('axisMoney')
    expect(ui).toContain('performance-switch')
    expect(ui).not.toContain('PerformanceCashChart')
  })

  it('groups dense chart events and exposes hover/focus/tap detail cards with event metadata instead of overlapping expense dots', () => {
    expect(ui).toContain('groupChartEvents')
    expect(ui).toContain('performance-event-popover')
    expect(ui).toContain('onMouseEnter')
    expect(ui).toContain('onFocus')
    expect(ui).toContain('onClick')
    expect(ui).toContain('hover, focus or tap a mark for the value, type, date and source')
    expect(styles).toContain('.performance-event-popover')
    expect(styles).toContain('.performance-event-mark line')
  })

  it('uses a restrained type hierarchy, iOS-like switches, responsive local chart scrolling and the existing shared expense ledger', () => {
    expect(styles).toContain('/* Performance workspace */')
    expect(styles).toContain('.performance-switch > input:checked + span')
    expect(styles).toContain('.performance-metric > b { color: var(--ink); font-size: 23px')
    expect(styles).toContain('.performance-chart { min-width: 680px; }')
    expect(styles).toContain('@media (max-width: 700px)')
    expect(app).toContain("onOpenExpenses={() => setSection('Documents & Expenses')}")
    expect(ui).toContain('Actual income / costs')
  })

})
