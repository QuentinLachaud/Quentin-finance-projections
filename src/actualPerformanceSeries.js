export const hasChartValue = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return false
  if (typeof value === 'string' && !value.trim()) return false
  return Number.isFinite(Number(value))
}

export function overlayActualBankSeries(model, actualSeries = []) {
  const todayMonth = model.todayMonth || model.points?.[model.todayIndex]?.date || ''
  const validMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))
  const byMonth = new Map((Array.isArray(actualSeries) ? actualSeries : [])
    .filter((point) => validMonth(point?.date) && point.date <= todayMonth)
    .map((point) => [point.date, point]))
  return {
    ...model,
    points: (model.points || []).map((point) => {
      const actual = point.date <= todayMonth ? byMonth.get(point.date) : null
      return {
        ...point,
        actualBankCashflow: hasChartValue(actual?.value) ? Number(actual.value) : null,
        actualBankAccumulation: hasChartValue(actual?.accumulated) ? Number(actual.accumulated) : null,
      }
    }),
  }
}
