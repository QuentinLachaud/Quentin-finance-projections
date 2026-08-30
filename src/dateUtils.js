const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:$|T)/

const validDate = (date) => date instanceof Date && !Number.isNaN(date.getTime())

export const calendarDate = (value) => {
  if (validDate(value)) return new Date(value.getTime())
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

  // Calendar fields are date-only facts. Preserve an explicit YYYY-MM-DD prefix
  // rather than allowing timezone conversion of an ISO timestamp to shift the day.
  const datePrefix = raw.match(DATE_PREFIX)?.[1]
  const parsed = datePrefix ? new Date(`${datePrefix}T12:00:00`) : new Date(raw)
  return validDate(parsed) ? parsed : null
}

export const dateInputValue = (value) => {
  if (value == null) return ''
  const raw = value instanceof Date ? '' : String(value).trim()
  const datePrefix = raw.match(DATE_PREFIX)?.[1]
  if (datePrefix) return datePrefix

  const date = calendarDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const shortDate = (value) => {
  const date = calendarDate(value)
  return date
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : '—'
}
