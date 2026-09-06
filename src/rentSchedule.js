const clean = (value) => String(value ?? '').trim()
const isoDate = (value) => clean(value).slice(0, 10)
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export const normalizeRentPaymentDay = (value) => {
  const day = Number(value)
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null
}

export const daysInCalendarMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0, 12).getDate()

const localDateParts = (value) => {
  const match = isoDate(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(year, month - 1, day, 12)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return { year, month, day, key: `${match[1]}-${match[2]}-${match[3]}` }
}

const dateKey = (year, monthIndex, day) => `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export const scheduledRentDayForMonth = (paymentDay, year, monthIndex) => {
  const normalized = normalizeRentPaymentDay(paymentDay)
  if (!normalized) return null
  return Math.min(normalized, daysInCalendarMonth(year, monthIndex))
}

export const scheduledRentDateForMonth = (paymentDay, year, monthIndex) => {
  const day = scheduledRentDayForMonth(paymentDay, year, monthIndex)
  return day ? dateKey(year, monthIndex, day) : ''
}

export const tenantActiveOnScheduledDate = (tenant, scheduledDate) => {
  const scheduled = localDateParts(scheduledDate)
  if (!scheduled) return false
  const moveIn = localDateParts(tenant?.moveIn || tenant?.tenantMoveIn)
  const moveOut = localDateParts(tenant?.moveOut || tenant?.tenantMoveOut)
  if (moveIn && scheduled.key < moveIn.key) return false
  if (moveOut && scheduled.key > moveOut.key) return false
  return true
}

export const formatOrdinalDay = (value) => {
  const day = normalizeRentPaymentDay(value)
  if (!day) return 'Not set'
  const mod100 = day % 100
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th')
  return `${day}${suffix}`
}

export const rentScheduleForMonth = (tenants = [], properties = [], now = new Date()) => {
  const target = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  const year = target.getFullYear()
  const monthIndex = target.getMonth()
  const daysInMonth = daysInCalendarMonth(year, monthIndex)
  const byProperty = new Map((properties || []).map((property) => [String(property?.id || ''), property]))
  const missingTenants = []
  const events = []

  ;(Array.isArray(tenants) ? tenants : []).forEach((tenant) => {
    const property = byProperty.get(String(tenant?.propertyId || ''))
    if (!property || property.active === false) return
    const paymentDay = normalizeRentPaymentDay(tenant?.rentPaymentDay)
    if (!paymentDay) {
      const moveOut = localDateParts(tenant?.moveOut || tenant?.tenantMoveOut)
      if (!moveOut || moveOut.key >= dateKey(year, monthIndex, 1)) missingTenants.push(tenant)
      return
    }
    const dueDay = scheduledRentDayForMonth(paymentDay, year, monthIndex)
    const dueDate = dateKey(year, monthIndex, dueDay)
    if (!tenantActiveOnScheduledDate(tenant, dueDate)) return
    events.push({
      id: `${tenant.id || tenant.name || 'tenant'}:${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      tenantId: tenant.id || '',
      tenantName: clean(tenant.name) || 'Tenant',
      propertyId: String(property.id || ''),
      propertyName: clean(property.name) || 'BTL',
      configuredPaymentDay: paymentDay,
      dueDay,
      dueDate,
      amount: Math.max(0, finite(property.rent)),
    })
  })

  events.sort((left, right) => left.dueDay - right.dueDay || left.propertyName.localeCompare(right.propertyName))
  return {
    year,
    monthIndex,
    monthKey: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    daysInMonth,
    events,
    missingTenants,
    scheduledRent: events.reduce((sum, event) => sum + event.amount, 0),
  }
}
