const tenantPropertyFields = {
  name: 'tenantName',
  email: 'tenantEmail',
  phone: 'tenantPhone',
  occupation: 'tenantOccupation',
  moveIn: 'tenantMoveIn',
  moveOut: 'tenantMoveOut',
  depositHeld: 'depositHeld',
}

const propertyTenantValues = (property) => Object.fromEntries(
  Object.entries(tenantPropertyFields).map(([tenantKey, propertyKey]) => [tenantKey, property[propertyKey] || '']),
)

export const hasPropertyTenant = (property) => Object.values(propertyTenantValues(property)).some((value) => String(value).trim())

export const createTenant = (propertyId = '') => ({
  id: crypto.randomUUID(),
  propertyId,
  name: '',
  email: '',
  phone: '',
  occupation: '',
  moveIn: '',
  moveOut: '',
  depositHeld: '',
  importedFromProperty: false,
})

export const tenantBelongsToProperty = (tenant, properties) => Boolean(tenant.propertyId)
  && properties.some((property) => property.id === tenant.propertyId)

export const removeTenantsForProperty = (tenants, propertyId) => tenants.filter((tenant) => tenant.propertyId !== propertyId)

export const importPropertyTenants = (properties, tenants = []) => {
  const propertyIds = new Set(properties.map((property) => property.id))
  const next = Array.isArray(tenants) ? tenants
    .filter((tenant) => propertyIds.has(tenant.propertyId))
    .map((tenant) => ({ ...createTenant(), ...tenant })) : []
  for (const property of properties) {
    if (!hasPropertyTenant(property)) continue
    const linked = next.find((tenant) => tenant.id === property.tenantId)
      || next.find((tenant) => tenant.importedFromProperty && tenant.propertyId === property.id)
    if (linked) {
      if (!property.tenantId) property.tenantId = linked.id
      continue
    }
    const tenant = {
      ...createTenant(property.id),
      ...propertyTenantValues(property),
      importedFromProperty: true,
    }
    property.tenantId = tenant.id
    next.push(tenant)
  }
  return next
}

export const syncPropertyTenant = (property, tenants) => {
  const nextTenants = [...tenants]
  const existingIndex = nextTenants.findIndex((tenant) => tenant.id === property.tenantId)
  if (!hasPropertyTenant(property)) {
    if (existingIndex >= 0 && nextTenants[existingIndex].importedFromProperty) nextTenants.splice(existingIndex, 1)
    return { property: { ...property, tenantId: '' }, tenants: nextTenants }
  }

  const existingTenant = existingIndex >= 0 ? nextTenants[existingIndex] : null
  const startsReplacementTenancy = Boolean(existingTenant?.moveOut)
    && !property.tenantMoveOut
    && property.tenantMoveIn !== existingTenant.moveIn
  const tenant = {
    ...(existingTenant && !startsReplacementTenancy ? existingTenant : createTenant(property.id)),
    ...propertyTenantValues(property),
    propertyId: property.id,
    importedFromProperty: true,
  }
  if (existingIndex >= 0 && !startsReplacementTenancy) nextTenants[existingIndex] = tenant
  else nextTenants.push(tenant)
  return { property: { ...property, tenantId: tenant.id }, tenants: nextTenants }
}

export const applyTenantToProperty = (tenant, property) => {
  if (!tenant.importedFromProperty || tenant.propertyId !== property.id) return property
  return Object.entries(tenantPropertyFields).reduce((next, [tenantKey, propertyKey]) => ({
    ...next,
    [propertyKey]: tenant[tenantKey] || '',
  }), { ...property, tenantId: tenant.id })
}

const dateAtNoon = (value) => value ? new Date(`${value}T12:00:00`) : null

export const tenantTenure = (tenant, now = new Date()) => {
  const start = dateAtNoon(tenant.moveIn)
  const end = dateAtNoon(tenant.moveOut)
  if (end && !Number.isNaN(end.getTime()) && end <= now) return { live: false, archived: true, label: `Moved out ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` }
  if (!start || Number.isNaN(start.getTime())) return { live: true, archived: false, label: 'Move-in date not set' }
  if (start > now) return { live: false, archived: false, label: `Starts ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` }
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() - (now.getDate() < start.getDate() ? 1 : 0))
  const years = Math.floor(months / 12)
  const remainder = months % 12
  const parts = [years && `${years} ${years === 1 ? 'year' : 'years'}`, remainder && `${remainder} ${remainder === 1 ? 'month' : 'months'}`].filter(Boolean)
  return { live: true, archived: false, label: parts.join(' ') || 'Less than a month' }
}

const DAY_MS = 24 * 60 * 60 * 1000
const validDate = (value) => {
  const date = dateAtNoon(value)
  return date && !Number.isNaN(date.getTime()) ? date : null
}

export const propertyVoidHistory = (property, tenants, now = new Date()) => {
  const ownedFrom = validDate(property.purchaseDate)
  const ownedUntil = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  if (!ownedFrom || ownedFrom >= ownedUntil) return { voidDays: 0, ownedDays: 0, voidRate: 0 }

  const intervals = tenants
    .filter((tenant) => tenant.propertyId === property.id)
    .map((tenant) => {
      const start = validDate(tenant.moveIn)
      const end = validDate(tenant.moveOut) || ownedUntil
      return start ? [new Date(Math.max(ownedFrom, start)), new Date(Math.min(ownedUntil, end))] : null
    })
    .filter((interval) => interval && interval[0] < interval[1])
    .sort((a, b) => a[0] - b[0])

  const merged = []
  for (const interval of intervals) {
    const previous = merged.at(-1)
    if (previous && interval[0] <= previous[1]) previous[1] = new Date(Math.max(previous[1], interval[1]))
    else merged.push(interval)
  }
  const ownedDays = Math.max(0, Math.round((ownedUntil - ownedFrom) / DAY_MS))
  const occupiedDays = merged.reduce((total, [start, end]) => total + Math.round((end - start) / DAY_MS), 0)
  const voidDays = Math.max(0, ownedDays - occupiedDays)
  return { voidDays, ownedDays, voidRate: ownedDays ? voidDays / ownedDays : 0 }
}
