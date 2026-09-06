const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const dateValue = (value) => {
  const parsed = Date.parse(`${String(value || '').slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(parsed) ? parsed : 0
}

const niceStep = (rawStep) => {
  const safe = Math.max(Number.EPSILON, Math.abs(finite(rawStep)))
  const magnitude = 10 ** Math.floor(Math.log10(safe))
  const fraction = safe / magnitude
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return niceFraction * magnitude
}

export const balanceAxis = (points = [], targetTickCount = 5) => {
  const values = (points || []).map((point) => finite(point?.balance))
  if (!values.length) return { min: 0, max: 1, step: 1, ticks: [0, 1] }
  let dataMin = Math.min(...values)
  let dataMax = Math.max(...values)
  if (dataMin === dataMax) {
    const padding = Math.max(Math.abs(dataMin) * 0.08, 100)
    dataMin -= padding
    dataMax += padding
  }
  const target = Math.max(3, Math.trunc(finite(targetTickCount) || 5))
  const step = niceStep((dataMax - dataMin) / Math.max(1, target - 1))
  const min = Math.floor(dataMin / step) * step
  const max = Math.ceil(dataMax / step) * step
  const ticks = []
  for (let value = min; value <= max + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(10)))
    if (ticks.length > 12) break
  }
  return { min, max: Math.max(max, min + step), step, ticks }
}

export const formatAxisMoney = (value) => {
  const amount = finite(value)
  const sign = amount < 0 ? '-' : ''
  const absolute = Math.abs(amount)
  if (absolute >= 1_000_000) {
    const scaled = absolute / 1_000_000
    return `${sign}£${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}M`
  }
  if (absolute >= 1_000) {
    const scaled = absolute / 1_000
    return `${sign}£${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}K`
  }
  return `${sign}£${Math.round(absolute)}`
}

const asUtcDate = (value) => {
  const source = String(value || '').slice(0, 10)
  const parsed = new Date(`${source}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const BUSINESS_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const formatBusinessMonth = (value) => {
  const date = asUtcDate(value)
  return date ? `${BUSINESS_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}` : ''
}

export const formatBalanceDate = (value) => {
  const date = asUtcDate(value)
  return date ? `${date.getUTCDate()} ${BUSINESS_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}` : ''
}

export const balanceMonthTicks = (points = [], maxTicks = 6) => {
  const valid = (points || []).filter((point) => asUtcDate(point?.date))
  if (!valid.length) return []
  const first = asUtcDate(valid[0].date)
  const last = asUtcDate(valid.at(-1).date)
  const months = []
  let cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1, 12))
  const endMonth = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1, 12))
  while (cursor <= endMonth) {
    const rawDate = cursor < first ? first : cursor
    months.push({ date: rawDate.toISOString().slice(0, 10), label: formatBusinessMonth(rawDate.toISOString().slice(0, 10)) })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12))
    if (months.length > 600) break
  }
  if (!months.length) return [{ date: valid[0].date, label: formatBusinessMonth(valid[0].date) }]
  const count = Math.min(Math.max(1, Math.trunc(finite(maxTicks) || 6)), months.length)
  if (count === months.length) return months
  const chosen = new Map()
  for (let index = 0; index < count; index += 1) {
    const monthIndex = Math.round(index * (months.length - 1) / Math.max(1, count - 1))
    chosen.set(monthIndex, months[monthIndex])
  }
  return [...chosen.values()]
}

export const balanceCoordinates = (points = [], axis, geometry) => {
  if (!points.length) return []
  const { width, height, pad } = geometry
  const firstDate = dateValue(points[0]?.date)
  const lastDate = dateValue(points.at(-1)?.date)
  const timeSpan = Math.max(1, lastDate - firstDate)
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const valueSpan = Math.max(Number.EPSILON, finite(axis?.max) - finite(axis?.min))
  return points.map((point, index) => {
    const pointDate = dateValue(point?.date)
    const timeRatio = lastDate === firstDate
      ? index / Math.max(1, points.length - 1)
      : (pointDate - firstDate) / timeSpan
    return {
      ...point,
      x: pad.left + Math.max(0, Math.min(1, timeRatio)) * plotWidth,
      y: pad.top + (finite(axis?.max) - finite(point?.balance)) / valueSpan * plotHeight,
    }
  })
}

export const xForBalanceDate = (date, points = [], geometry) => {
  if (!points.length) return geometry?.pad?.left || 0
  const firstDate = dateValue(points[0]?.date)
  const lastDate = dateValue(points.at(-1)?.date)
  const target = dateValue(date)
  const ratio = lastDate === firstDate ? 0 : (target - firstDate) / Math.max(1, lastDate - firstDate)
  return geometry.pad.left + Math.max(0, Math.min(1, ratio)) * (geometry.width - geometry.pad.left - geometry.pad.right)
}

export const nearestBalancePoint = (coordinates = [], x = 0) => {
  if (!coordinates.length) return null
  return coordinates.reduce((nearest, point) => (
    nearest == null || Math.abs(finite(point.x) - finite(x)) < Math.abs(finite(nearest.x) - finite(x)) ? point : nearest
  ), null)
}

export const formatCashPeriod = (period) => {
  const source = String(period || '')
  if (/^\d{4}-\d{2}$/.test(source)) return formatBusinessMonth(`${source}-01`)
  return source
}
