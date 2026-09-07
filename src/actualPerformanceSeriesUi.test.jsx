import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PerformanceWorkspace, { PerformanceChart } from './PerformanceWorkspace.jsx'
import { overlayActualBankSeries } from './actualPerformanceSeries.js'

const source = readFileSync(new URL('./PerformanceWorkspace.jsx', import.meta.url), 'utf8')
const chartSource = source.split('export function PerformanceChart(')[1].split('function UpdateModal(')[0]
const model = {
  todayMonth: '2026-09', todayIndex: 2,
  points: ['2026-07', '2026-08', '2026-09', '2026-10'].map((date) => ({
    date, monthlyCashflow: 500, cashAccumulation: 1000,
    actualBankCashflow: null, actualBankAccumulation: null,
  })),
}
const renderChart = (actual) => renderToStaticMarkup(<PerformanceChart
  model={overlayActualBankSeries(model, actual)}
  visibleSeries={['actualBankCashflow', 'actualBankAccumulation']}
  scope="portfolio"
/>)

describe('Performance actual-series rendering', () => {
  it('uses null-safe checks consistently for paths, axes, readouts and markers', () => {
    expect(source).toContain('overlayActualBankSeries(model, actualBankSeries)')
    expect(chartSource).toContain('hasChartValue(point[item.key])')
    expect(chartSource).toContain('hasChartValue(value)')
    expect(chartSource).toContain('hasChartValue(active[item.key])')
    expect(chartSource).not.toContain('Number.isFinite(Number(active[item.key]))')
    expect(chartSource).not.toContain('Number.isFinite(Number(point[item.key]))')
    expect(chartSource).not.toContain('Number.isFinite(Number(value))')
  })
  it('does not draw missing values as zero, and stops actual paths at recorded history', () => {
    const empty = renderChart([])
    expect(empty).not.toContain('actual-series')
    const html = renderChart([
      { date: '2026-07', value: 0, accumulated: 0 },
      { date: '2026-08', value: -50, accumulated: -50 },
      { date: '2026-10', value: 999, accumulated: 999 },
    ])
    const paths = [...html.matchAll(/class="performance-v2-line actual-series[^"]*" d="([^"]*)"/g)]
    expect(paths).toHaveLength(2)
    expect(paths.every((match) => !match[1].includes('NaN') && !match[1].includes('Infinity'))).toBe(true)
    expect(paths.every((match) => (match[1].match(/[ML]/g) || []).length === 2)).toBe(true)
  })
  it('preserves the existing chart controls and model forecast presentation', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[]} settings={{}} onAssumptionChange={() => {}} />)
    for (const label of ['Actual bank cash flow', 'Actual bank accumulated', 'Model cash flow', 'Cash accumulated']) {
      expect(html).toContain(label)
    }
    expect(chartSource).toContain('forecast-segment')
    expect(chartSource).toContain('actual-series')
    expect(chartSource).toContain('pathFor(item, todayIndex, points.length - 1)')
  })
})
