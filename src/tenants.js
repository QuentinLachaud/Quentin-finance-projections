const tenantPropertyFields = {
  name: 'tenantName',
  email: 'tenantEmail',
  phone: 'tenantPhone',
  occupation: 'tenantOccupation',
  moveIn: 'tenantMoveIn',
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

  const tenant = {
    ...(existingIndex >= 0 ? nextTenants[existingIndex] : createTenant(property.id)),
    ...propertyTenantValues(property),
    propertyId: property.id,
    importedFromProperty: true,
  }
  if (existingIndex >= 0) nextTenants[existingIndex] = tenant
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
  if (!start || Number.isNaN(start.getTime())) return { live: true, label: 'Move-in date not set' }
  if (start > now) return { live: false, label: `Starts ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` }
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() - (now.getDate() < start.getDate() ? 1 : 0))
  const years = Math.floor(months / 12)
  const remainder = months % 12
  const parts = [years && `${years} ${years === 1 ? 'year' : 'years'}`, remainder && `${remainder} ${remainder === 1 ? 'month' : 'months'}`].filter(Boolean)
  return { live: true, label: parts.join(' ') || 'Less than a month' }
}
