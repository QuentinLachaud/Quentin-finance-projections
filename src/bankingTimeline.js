import { aggregateCashFlow } from './banking.js'

// Treat a bank booking date as a calendar date, never as a local-time instant.
const calendarDate = (value) => {
  const date = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ''
  const parsed = new Date(`${date}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : ''
}

const londonToday = (value = new Date()) => {
  if (typeof value === 'string' && calendarDate(value) && value.length === 10) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type) => parts.find((entry) => entry.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const periodIndex = (date, period) => {
  const year = Number(date.slice(0, 4))
  return period === 'year' ? year : year * 12 + Number(date.slice(5, 7)) - 1
}

const periodKey = (index, period) => {
  if (period === 'year') return String(index).padStart(4, '0')
  const year = Math.floor(index / 12)
  return `${String(year).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`
}

export const bankingHistoryBounds = (transactions = [], accountIds) => {
  const selected = accountIds == null ? null : new Set(accountIds)
  const dates = (transactions || [])
    .filter((row) => (!selected || selected.has(row.accountId || row.account_id)) && row.status !== 'pending')
    .map((row) => calendarDate(row.bookedAt || row.booked_at))
    .filter(Boolean)
    .sort()
  return { from: dates[0] || '', to: dates.at(-1) || '' }
}

export const bankingTimelineRange = (transactions = [], options = {}) => {
  const to = londonToday(options.asOf)
  const selected = options.accountIds == null ? null : new Set(options.accountIds)
  const history = (transactions || []).filter((row) => {
    const date = calendarDate(row.bookedAt || row.booked_at)
    return date && (!to || date <= to) && row.status !== 'pending'
      && (!selected || selected.has(row.accountId || row.account_id))
  })
  const bounds = bankingHistoryBounds(history)
  if (!to || !bounds.from) return { from: '', to: to || '', historyStart: '', historyEnd: '' }
  const months = Number(options.range)
  let from = bounds.from
  if (options.range !== 'all' && Number.isInteger(months) && months > 0) {
    const firstMonth = periodIndex(to, 'month') - months + 1
    const windowStart = `${periodKey(firstMonth, 'month')}-01`
    from = bounds.from > windowStart ? bounds.from : windowStart
  }
  return { from, to, historyStart: bounds.from, historyEnd: bounds.to }
}

// The supplied rows have already passed the business/analysis treatment filter.
// Preserve explicit operating overrides even if a stale transfer flag remains.
export const bankingCashFlowSeries = (transactions = [], options = {}) => {
  const { from, to } = options
  if (!calendarDate(from) || !calendarDate(to) || from > to) return []
  const period = options.period === 'year' ? 'year' : 'month'
  const rows = aggregateCashFlow(transactions, { ...options, period, includeTransfers: true })
  const byPeriod = new Map(rows.map((row) => [row.period, row]))
  const first = periodIndex(from, period)
  const last = periodIndex(to, period)
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const key = periodKey(first + offset, period)
    return byPeriod.get(key) || { period: key, inflow: 0, outflow: 0, net: 0, count: 0 }
  })
}

// Preserve the reconstructed balance at a shorter-range boundary instead of
// rebasing the chart to zero or carrying a later balance backwards in time.
export const alignBankingBalanceSeries = (points = [], options = {}) => {
  const from = calendarDate(options.from)
  const to = calendarDate(options.to)
  if (from && to && from > to) return []
  const rows = (points || []).filter((point) => calendarDate(point?.date))
    .slice().sort((a, b) => a.date.localeCompare(b.date))
  const bounded = rows.filter((point) => (!from || point.date >= from) && (!to || point.date <= to))
  if (!from) return bounded
  const previous = rows.filter((point) => point.date <= from).at(-1)
  if (!previous) return bounded
  if (previous.date === from) return bounded
  return [{ ...previous, date: from }, ...bounded]
}
