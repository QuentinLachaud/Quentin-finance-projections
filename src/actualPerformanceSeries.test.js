import { describe, expect, it } from 'vitest'
import { hasChartValue, overlayActualBankSeries } from './actualPerformanceSeries.js'

const model = {
  todayMonth: '2026-09', todayIndex: 2,
  points: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((date, index) => ({
    date, monthlyCashflow: 500 + index * 10, cashAccumulation: 1000 + index * 500,
    actualBankCashflow: null, actualBankAccumulation: null,
  })),
}

describe('recorded Banking chart boundaries', () => {
  it('does not treat missing values as zero, but preserves genuine zero and negative values', () => {
    for (const value of [null, undefined, '', NaN, Infinity, 'not a number', false, [], {}]) expect(hasChartValue(value)).toBe(false)
    for (const value of [0, -250, 1200, '0']) expect(hasChartValue(value)).toBe(true)
  })
  it('normalizes numeric strings without treating missing or future rows as observations', () => {
    const result = overlayActualBankSeries(model, [{ date: '2026-07', value: '0', accumulated: '0' }, { date: '2026-10', value: 900, accumulated: 900 }])
    expect(result.points[0].actualBankCashflow).toBe(0)
    expect(result.points[0].actualBankAccumulation).toBe(0)
    expect(result.points[3].actualBankCashflow).toBeNull()
  })
  it('ends both actual series at the last recorded month without changing either model forecast', () => {
    const actual = [
      { date: '2026-07', value: 700, accumulated: 700 },
      { date: '2026-08', value: -200, accumulated: 500 },
    ]
    const result = overlayActualBankSeries(model, actual)
    expect(result.points.map((point) => point.actualBankCashflow)).toEqual([700, -200, null, null, null])
    expect(result.points.map((point) => point.actualBankAccumulation)).toEqual([700, 500, null, null, null])
    expect(result.points.map((point) => point.monthlyCashflow)).toEqual(model.points.map((point) => point.monthlyCashflow))
    expect(result.points.map((point) => point.cashAccumulation)).toEqual(model.points.map((point) => point.cashAccumulation))
    expect(result.todayIndex).toBe(2)
    expect(model.points.every((point) => point.actualBankCashflow === null)).toBe(true)
  })
  it('retains real zero months and gaps within recorded history, but never extrapolates the closing balance', () => {
    const actual = [
      { date: '2026-07', value: 100, accumulated: 100 },
      { date: '2026-08', value: 0, accumulated: 100 },
      { date: '2026-09', value: 50, accumulated: 150 },
      { date: '2026-10', value: 999, accumulated: 1149 },
    ]
    const result = overlayActualBankSeries(model, actual)
    expect(result.points.map((point) => point.actualBankCashflow)).toEqual([100, 0, 50, null, null])
    expect(result.points.map((point) => point.actualBankAccumulation)).toEqual([100, 100, 150, null, null])
    expect(overlayActualBankSeries(model, []).points.every((point) => point.actualBankAccumulation === null)).toBe(true)
    const sparse = overlayActualBankSeries(model, [actual[0], actual[2]])
    expect(sparse.points[1].actualBankCashflow).toBeNull()
    expect(sparse.points[1].actualBankAccumulation).toBeNull()
  })
})
