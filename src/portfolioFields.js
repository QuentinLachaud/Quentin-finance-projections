export const formatPropertyAddress = (...parts) => parts
  .map((part) => String(part ?? '').trim())
  .filter(Boolean)
  .join(', ')

export const shouldSelectZeroInput = (input) => input?.type === 'number'
  && input.value !== ''
  && Number(input.value) === 0

const rate = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`

export const formatRateComposition = (baseRate, effectiveRate) => {
  const base = Number(baseRate || 0)
  const effective = Number(effectiveRate || 0)
  const shock = effective - base
  if (Math.abs(shock) < 0.0000001) return rate(base)
  return `${rate(base)} ${shock > 0 ? '+' : '−'} ${rate(Math.abs(shock))} = ${rate(effective)}`
}

export const propertyOperatingCashflow = (property = {}, settings = {}) => {
  const rent = Number(property.rent || 0)
  const fixedCosts = Number(property.fixedCosts || 0)
  const variableCosts = Number(property.variableCosts || 0)
  const management = settings.fullyManaged ? rent * Number(settings.managementRate || 0) : 0
  return rent - fixedCosts - variableCosts - management
}

export const visiblePropertyRows = (rows, advanced = false) =>
  rows.filter((row) => advanced || row[3] !== true)

export const includedPortfolioProperties = (properties = []) =>
  properties.filter((property) => property?.active === true)

export const tenantsForIncludedProperties = (tenants = [], properties = []) => {
  const includedIds = new Set(includedPortfolioProperties(properties).map((property) => property.id))
  return tenants.filter((tenant) => includedIds.has(tenant.propertyId))
}
