const DAY_MS = 24 * 60 * 60 * 1000
export const COMPLIANCE_NOTICE_DAYS = 14
export const REMORTGAGE_NOTICE_MONTHS = 3
export const DEFAULT_SNOOZE_DAYS = 7

const pad = (value) => String(value).padStart(2, '0')

export const dateOnly = (value) => {
  if (!value) return ''
  if (typeof value === 'string') {
    const match = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/London',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const parseDateOnly = (value) => {
  const normalized = dateOnly(value)
  if (!normalized) return null
  const [year, month, day] = normalized.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

export const addDaysDateOnly = (value, days) => {
  const date = parseDateOnly(value)
  if (!date || !Number.isFinite(Number(days))) return ''
  date.setUTCDate(date.getUTCDate() + Number(days))
  return dateOnly(date)
}

export const addMonthsDateOnly = (value, months) => {
  const date = parseDateOnly(value)
  if (!date || !Number.isFinite(Number(months))) return ''
  const sourceDay = date.getUTCDate()
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months), 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(sourceDay, lastDay))
  return dateOnly(first)
}

const compareDateOnly = (left, right) => String(left).localeCompare(String(right))

export const daysBetweenDateOnly = (from, to) => {
  const start = parseDateOnly(from)
  const end = parseDateOnly(to)
  if (!start || !end) return null
  return Math.round((end.getTime() - start.getTime()) / DAY_MS)
}

const derivedRemortgageDate = (property = {}) => {
  const calculated = dateOnly(property.nextRemortgage)
  if (calculated) return calculated
  const latest = dateOnly(property.latestRemortgage)
  const months = Number(property.fixedRateMonths)
  return latest && Number.isFinite(months) && months >= 0 ? addMonthsDateOnly(latest, months) : ''
}

const complianceDefinitions = [
  ['gas', 'Gas certificate', 'gasExpiry'],
  ['eicr', 'EICR', 'eicrExpiry'],
  ['pat', 'PAT testing', 'patExpiry'],
  ['epc', 'EPC', 'epcExpiry'],
]

export const complianceDiaryItems = (properties = []) => (Array.isArray(properties) ? properties : [])
  .filter((property) => property?.active !== false)
  .flatMap((property) => {
    const propertyId = String(property.id || property.name || '')
    const propertyName = String(property.name || 'Property')
    const nextRemortgage = derivedRemortgageDate(property)
    const brokerDate = dateOnly(property.brokerDate) || (nextRemortgage ? addMonthsDateOnly(nextRemortgage, -REMORTGAGE_NOTICE_MONTHS) : '')
    const remortgage = nextRemortgage && brokerDate ? [{
      key: `${propertyId}|remortgage|${nextRemortgage}`,
      type: 'remortgage',
      propertyId,
      propertyName,
      label: 'Call broker',
      dueDate: nextRemortgage,
      notifyFrom: brokerDate,
      displayDate: brokerDate,
    }] : []
    const compliance = complianceDefinitions.flatMap(([type, label, field]) => {
      const dueDate = dateOnly(property[field])
      if (!dueDate) return []
      return [{
        key: `${propertyId}|${type}|${dueDate}`,
        type,
        propertyId,
        propertyName,
        label,
        dueDate,
        notifyFrom: addDaysDateOnly(dueDate, -COMPLIANCE_NOTICE_DAYS),
        displayDate: dueDate,
      }]
    })
    return [...remortgage, ...compliance]
  })
  .sort((left, right) => compareDateOnly(left.displayDate, right.displayDate) || left.propertyName.localeCompare(right.propertyName))

export const normalizeNotificationPreferences = (value = {}) => ({
  dismissed: value?.dismissed && typeof value.dismissed === 'object' && !Array.isArray(value.dismissed) ? { ...value.dismissed } : {},
  snoozedUntil: value?.snoozedUntil && typeof value.snoozedUntil === 'object' && !Array.isArray(value.snoozedUntil) ? { ...value.snoozedUntil } : {},
})

const isSuppressed = (event, preferences, today) => {
  if (preferences.dismissed[event.key]) return true
  const snoozedUntil = dateOnly(preferences.snoozedUntil[event.key])
  return Boolean(snoozedUntil && compareDateOnly(today, snoozedUntil) < 0)
}

export const actionableNotifications = ({ properties = [], preferences = {}, enabled = true, now = new Date() } = {}) => {
  if (!enabled) return []
  const today = dateOnly(now)
  if (!today) return []
  const normalized = normalizeNotificationPreferences(preferences)
  return complianceDiaryItems(properties)
    .filter((event) => compareDateOnly(today, event.notifyFrom) >= 0 && compareDateOnly(today, event.dueDate) <= 0)
    .filter((event) => !isSuppressed(event, normalized, today))
    .map((event) => ({ ...event, daysUntil: daysBetweenDateOnly(today, event.dueDate) }))
    .sort((left, right) => compareDateOnly(left.dueDate, right.dueDate) || left.propertyName.localeCompare(right.propertyName))
}

export const dismissNotification = (preferences, event, now = new Date()) => {
  const normalized = normalizeNotificationPreferences(preferences)
  const dismissed = { ...normalized.dismissed, [event.key]: new Date(now).toISOString() }
  const snoozedUntil = { ...normalized.snoozedUntil }
  delete snoozedUntil[event.key]
  return { dismissed, snoozedUntil }
}

export const snoozeNotification = (preferences, event, now = new Date(), days = DEFAULT_SNOOZE_DAYS) => {
  const normalized = normalizeNotificationPreferences(preferences)
  const today = dateOnly(now)
  const requested = addDaysDateOnly(today, days)
  const until = compareDateOnly(requested, event.dueDate) > 0 ? event.dueDate : requested
  const dismissed = { ...normalized.dismissed }
  delete dismissed[event.key]
  return { dismissed, snoozedUntil: { ...normalized.snoozedUntil, [event.key]: until } }
}

export const notificationCycleKey = (preferences, event) => {
  const normalized = normalizeNotificationPreferences(preferences)
  return dateOnly(normalized.snoozedUntil[event.key]) || 'initial'
}

export const notificationDateLabel = (value) => {
  const date = parseDateOnly(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export const pushPayloadForNotification = (event) => {
  const due = notificationDateLabel(event.dueDate)
  const remortgage = event.type === 'remortgage'
  return {
    title: remortgage ? `${event.propertyName}: remortgage window open` : `${event.propertyName}: ${event.label} due soon`,
    body: remortgage ? `You can start locking a replacement rate now. Current fix date: ${due}.` : `${event.label} is due ${due}.`,
    tag: `btl-reminder:${event.key}`,
    data: { url: '/?notifications=1' },
  }
}
