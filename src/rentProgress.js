import { rentScheduleForMonth } from './rentSchedule.js'

// Use UTC calendar-day arithmetic: local milliseconds vary across DST transitions.
const DAY_MS = 86_400_000
const pad = (number) => String(number).padStart(2, '0')
const isoDay = (date) => [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-')
const dayIndex = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

/**
 * The most recent scheduled rent date and next scheduled rent date across
 * active tenancies. A due date is a schedule, not evidence of payment.
 * Search adjacent months and up to one year for future move-ins / ending leases.
 */
export function rentCycleForDate(tenants = [], properties = [], now = new Date()) {
  const today = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const todayKey = isoDay(today)
  const dates = new Set()
  for (let offset = -12; offset <= 12; offset += 1) {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1, 12)
    for (const event of rentScheduleForMonth(tenants, properties, month).events) {
      dates.add(event.dueDate)
    }
  }
  const ordered = [...dates].sort()
  const previousDueDate = ordered.filter((day) => day < todayKey).at(-1) || null
  const nextDueDate = ordered.find((day) => day >= todayKey) || null
  const daysUntil = nextDueDate ? dayIndex(nextDueDate) - dayIndex(todayKey) : null
  const elapsed = previousDueDate ? dayIndex(todayKey) - dayIndex(previousDueDate) : 0
  const length = previousDueDate && nextDueDate
    ? dayIndex(nextDueDate) - dayIndex(previousDueDate)
    : 0
  const progress = nextDueDate === todayKey
    ? 1
    : length > 0 ? Math.min(1, Math.max(0, elapsed / length)) : 0

  return { previousDueDate, nextDueDate, daysUntil, progress }
}

export function formatRentCycleDate(iso) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
    .format(new Date(year, month - 1, day, 12))
}
