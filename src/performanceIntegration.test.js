import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('./App.jsx')
const ui = read('./PerformanceWorkspace.jsx')
const forecast = read('./performanceForecast.js')
const styles = read('./styles.css')

describe('Performance v3 history + forecast integration', () => {
  it('keeps Performance on the existing state/user wiring without a backend migration', () => {
    expect(app).toContain("import PerformanceWorkspace from './PerformanceWorkspace.jsx'")
    expect(app).toContain("{section === 'Performance' && <PerformanceWorkspace")
    expect(app).toContain('user={user}')
    expect(ui).toContain("onAssumptionChange?.('performanceUpdates'")
    expect(ui).toContain("onAssumptionChange?.('performanceModelOverrides'")
    expect(ui).toContain("useBankPerformanceData(user?.id)")
    expect(forecast).not.toContain("from('performance_")
  })

  it('reuses canonical scenario cash semantics while adding historical scope and actual Banking cash flow', () => {
    expect(forecast).toContain("import { amortizingPayment, calculatePortfolio } from './calculations.js'")
    expect(forecast).toContain("import { transactionExcludedFromAnalysis } from './banking.js'")
    expect(forecast).toContain('const portfolio = calculatePortfolio(projected, calculationSettings')
    expect(forecast).toContain('scenario.bankCashflow')
    expect(forecast).toContain('scenario.cashflow')
    expect(forecast).toContain('earliestScopeMonth')
    expect(forecast).toContain('buildActualBankCashflowSeries')
    expect(forecast).toContain('transactionExcludedFromAnalysis(transaction)')
  })

  it('allows overlap by authoritative replacement and uses acquisition-style pointer drag reordering', () => {
    for (const token of ['applyPerformanceUpdate', 'rangesOverlap', 'previousMonthKey', 'nextMonthKey']) expect(forecast).toContain(token)
    expect(ui).toContain('writeUpdates(applyPerformanceUpdate')
    expect(ui).toContain('setPointerCapture?.(event.pointerId)')
    expect(ui).toContain('releasePointerCapture?.(event.pointerId)')
    expect(ui).toContain('updateDragShift')
    expect(ui).toContain('--performance-update-y')
    expect(ui).not.toContain('draggable')
    expect(ui).not.toContain('onDrop={() => reorder(entry.id)}')
    expect(ui).toContain('DeleteConfirmDialog')
  })

  it('renders subtle monthly points, local hover values, and an explicit Past/Forecast boundary', () => {
    expect(ui).toContain('performance-v2-points')
    expect(ui).toContain('performance-v2-hover-card')
    expect(ui).toContain('performance-v2-hover-guide')
    expect(ui).toContain('performance-v2-today-marker')
    expect(ui).toContain('performance-v2-era-bands')
    expect(ui).toContain('>PAST</text>')
    expect(ui).toContain('>FORECAST</text>')
    expect(ui).toContain('monthLabel(active.date, true)')
    expect(styles).toContain('.performance-v2-points circle')
    expect(styles).toContain('stroke-dasharray: 2 5')
    expect(styles).toContain('.performance-v2-hover-card')
    expect(styles).toContain('.performance-v2-today-marker')
    expect(styles).toContain('.performance-v2-era-bands .past')
    expect(styles).toContain('.performance-v2-era-bands .future')
  })

  it('uses restrained series styling and materially larger typography than the first revamp', () => {
    expect(styles).toContain('--perf-blue: #536273')
    expect(styles).toContain('--perf-actual: #293640')
    expect(styles).toContain('font-size: 13px')
    expect(styles).toContain('font-size: .9rem')
    expect(styles).toContain('.performance-v2-line.actual-series')
    expect(styles).toContain('stroke-dasharray: 5 4')
    expect(styles).toContain('.performance-v2-update-row.is-dragging')
    expect(styles).toContain('touch-action: none')
  })

  it('defaults both graphs to actual versus estimated and reuses the Overview scenario palette', () => {
    expect(forecast).toContain("export const DEFAULT_PERFORMANCE_SERIES = ['monthlyCashflow', 'actualBankCashflow', 'cashAccumulation', 'actualBankAccumulation']")
    for (const colour of ['#b35c54', '#c78b3e', '#27795c']) {
      expect(app).toContain(colour)
      expect(forecast).toContain(colour)
    }
    expect(ui).toContain('className="scenario"')
    expect(ui).toContain("'--scenario': option.colour")
    expect(styles).toContain('.performance-v2-segmented.scenario button::before')
    expect(styles).toContain('.performance-v2-segmented.scenario button.selected')
    expect(ui).toContain('value={scenarioId}')
    expect(ui).toContain('useState(0)')
  })

  it('keeps chart overflow local and all eight series independently toggleable across two non-mixed charts', () => {
    for (const token of [
      'assetValue', 'equity', 'debt', 'monthlyCashflow', 'actualBankCashflow',
      'cashAccumulation', 'actualBankAccumulation', 'monthlyRent', 'performanceRateShockStartMonth',
      'performanceModelOverrides', 'niceCurrencyAxis', 'performanceXAxisTicks',
    ]) expect(forecast).toContain(token)
    expect(ui).toContain('performance-v2-chart-scroll')
    expect(styles).toContain('.performance-v2-chart-scroll')
    expect(styles).toContain('overflow-x: auto')
    expect(ui).toContain('Exclude extractions')
    expect(forecast).toContain("label: 'Actual bank cash flow'")
    expect(forecast).toContain("label: 'Actual bank accumulated'")
    expect(ui).toContain("const MONTHLY_SERIES_KEYS = ['monthlyCashflow', 'actualBankCashflow', 'monthlyRent']")
    expect(ui).toContain("const CAPITAL_SERIES_KEYS = ['assetValue', 'equity', 'debt', 'cashAccumulation', 'actualBankAccumulation']")
    expect(ui).toContain('visibleSeries={monthlyVisibleSeries}')
    expect(ui).toContain('visibleSeries={capitalVisibleSeries}')
    expect(ui).not.toContain('<PerformanceChart model={chartModel} visibleSeries={visibleSeries}')
    expect(ui).toContain('Monthly performance')
    expect(ui).toContain('Value & accumulated cash')
  })
})
