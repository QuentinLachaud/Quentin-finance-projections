import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('./App.jsx')
const ui = read('./PerformanceWorkspace.jsx')
const forecast = read('./performanceForecast.js')
const styles = read('./styles.css')

describe('Performance v2 integration', () => {
  it('keeps Performance wired through the existing portfolio state without a backend migration', () => {
    expect(app).toContain("import PerformanceWorkspace from './PerformanceWorkspace.jsx'")
    expect(app).toContain("{section === 'Performance' && <PerformanceWorkspace")
    expect(ui).toContain("onAssumptionChange?.('performanceUpdates'")
    expect(ui).toContain("onAssumptionChange?.('performanceModelOverrides'")
    expect(forecast).toContain('settings.performanceUpdates')
    expect(forecast).not.toContain("from('performance_")
  })

  it('reuses canonical calculatePortfolio scenario cash semantics instead of duplicating them', () => {
    expect(forecast).toContain("import { amortizingPayment, calculatePortfolio } from './calculations.js'")
    expect(forecast).toContain('const portfolio = calculatePortfolio(projected, calculationSettings')
    expect(forecast).toContain('scenario.bankCashflow')
    expect(forecast).toContain('scenario.cashflow')
    expect(forecast).toContain("{ id: 0, label: 'Conservative'")
    expect(forecast).toContain("{ id: 1, label: 'No voids'")
    expect(forecast).toContain("{ id: 2, label: 'No repairs or voids'")
  })

  it('supports explicit update ranges, overlap validation, editing, deletion confirmation and drag reordering', () => {
    for (const token of ['normalizePerformanceUpdate', 'validatePerformanceUpdate', 'activePerformanceUpdate', 'rangesOverlap']) expect(forecast).toContain(token)
    expect(ui).toContain('draggable')
    expect(ui).toContain('onDrop={() => reorder(entry.id)}')
    expect(ui).toContain('role="alertdialog"')
    expect(ui).toContain('Delete this {update.kind} update?')
    expect(ui).toContain('Edit ${entry.kind} update')
  })

  it('offers all requested toggles, scoped assumptions, additive delayed rate shock and adaptive axes', () => {
    for (const token of ['assetValue', 'equity', 'debt', 'monthlyCashflow', 'cashAccumulation', 'monthlyRent', 'performanceRateShockStartMonth', 'performanceModelOverrides', 'niceCurrencyAxis', 'performanceXAxisTicks']) expect(forecast).toContain(token)
    expect(ui).toContain('Exclude extractions')
    expect(ui).toContain('Shows true company cash flow')
    expect(ui).toContain('Additive to current mortgage rate')
    expect(ui).toContain('Use portfolio inputs')
  })

  it('keeps horizontal overflow local and preserves clear iOS-like visual affordances', () => {
    for (const token of ['.performance-v2-chart-scroll', 'overflow-x: auto', '.performance-v2-switch', '.performance-v2-segmented', '.performance-v2-modal-backdrop', '@media (max-width: 560px)']) expect(styles).toContain(token)
    expect(styles).toContain('min-height: 40px')
    expect(styles).toContain('--perf-blue: #0a84ff')
  })
})
