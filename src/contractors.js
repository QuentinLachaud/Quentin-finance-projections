const makeId = (prefix = 'contractor') => globalThis.crypto?.randomUUID?.()
  || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const cleanText = (value) => String(value || '').trim()
const finiteInt = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export const COMMON_TRADES = [
  'Electrician',
  'Gas Engineer',
  'Handyman',
  'Plumber',
  'Joiner / Carpenter',
  'Builder',
  'Roofer',
  'Painter / Decorator',
  'Locksmith',
  'Heating Engineer',
  'Appliance Engineer',
  'Cleaner',
  'Gardener',
  'Pest Control',
  'Property Manager / Letting Agent',
  'Other',
]

export const CONTRACTOR_TAG_ICON_OPTIONS = [
  ['flame', 'Flame'],
  ['zap', 'Electrical'],
  ['plug', 'Plug'],
  ['droplets', 'Water'],
  ['wrench', 'Repair'],
  ['hammer', 'Install'],
  ['hard-hat', 'Building'],
  ['paintbrush', 'Decorating'],
  ['key-round', 'Keys'],
  ['shield-check', 'Compliance'],
]

export const DEFAULT_CONTRACTOR_TAGS = [
  { id: 'gas', label: 'GAS', iconKey: 'flame', system: true },
  { id: 'eicr', label: 'EICR', iconKey: 'zap', system: true },
  { id: 'pat', label: 'PAT', iconKey: 'plug', system: true },
  { id: 'legionella', label: 'Legionella', iconKey: 'droplets', system: true },
  { id: 'repair', label: 'Repair', iconKey: 'wrench', system: true },
  { id: 'install', label: 'Install', iconKey: 'hammer', system: true },
]

const allowedIconKeys = new Set(CONTRACTOR_TAG_ICON_OPTIONS.map(([key]) => key))
const systemTagIds = new Set(DEFAULT_CONTRACTOR_TAGS.map((tag) => tag.id))

export const normalizeContractorTags = (tags) => {
  const custom = Array.isArray(tags) ? tags : []
  const normalizedCustom = custom
    .filter((tag) => tag && !systemTagIds.has(String(tag.id || '')))
    .map((tag) => ({
      id: cleanText(tag.id) || makeId('tag'),
      label: cleanText(tag.label),
      iconKey: allowedIconKeys.has(tag.iconKey) ? tag.iconKey : 'wrench',
      system: false,
    }))
    .filter((tag) => tag.label)

  const seen = new Set()
  return [...DEFAULT_CONTRACTOR_TAGS, ...normalizedCustom].filter((tag) => {
    const idKey = tag.id.toLowerCase()
    const labelKey = tag.label.toLowerCase()
    const duplicate = seen.has(idKey) || seen.has(`label:${labelKey}`)
    seen.add(idKey)
    seen.add(`label:${labelKey}`)
    return !duplicate
  })
}

export const createCustomContractorTag = (label, iconKey = 'wrench') => ({
  id: makeId('tag'),
  label: cleanText(label),
  iconKey: allowedIconKeys.has(iconKey) ? iconKey : 'wrench',
  system: false,
})

export const createBlankContractor = () => ({
  id: makeId(),
  firstName: '',
  lastName: '',
  companyName: '',
  phone: '',
  email: '',
  trade: '',
  tagIds: [],
  propertyIds: [],
  lastJobMonth: 0,
  lastJobYear: 0,
  notes: '',
})

export const normalizeContractor = (contractor, properties = [], tags = DEFAULT_CONTRACTOR_TAGS) => {
  const source = contractor || {}
  const validPropertyIds = new Set((properties || []).map((property) => String(property.id)))
  const validTagIds = new Set(normalizeContractorTags(tags).map((tag) => tag.id))
  const month = Math.min(12, Math.max(0, finiteInt(source.lastJobMonth)))
  const year = Math.max(0, finiteInt(source.lastJobYear))

  return {
    id: cleanText(source.id) || makeId(),
    firstName: cleanText(source.firstName),
    lastName: cleanText(source.lastName),
    companyName: cleanText(source.companyName),
    phone: cleanText(source.phone),
    email: cleanText(source.email),
    trade: COMMON_TRADES.includes(source.trade) ? source.trade : cleanText(source.trade),
    tagIds: [...new Set((Array.isArray(source.tagIds) ? source.tagIds : []).map(String).filter((id) => validTagIds.has(id)))],
    propertyIds: [...new Set((Array.isArray(source.propertyIds) ? source.propertyIds : []).map(String).filter((id) => validPropertyIds.has(id)))],
    lastJobMonth: month,
    lastJobYear: year,
    notes: String(source.notes || ''),
  }
}

export const normalizeContractors = (contractors, properties = [], tags = DEFAULT_CONTRACTOR_TAGS) => (
  Array.isArray(contractors) ? contractors.map((contractor) => normalizeContractor(contractor, properties, tags)) : []
)

export const contractorDisplayName = (contractor) => (
  [contractor?.firstName, contractor?.lastName].map(cleanText).filter(Boolean).join(' ') || 'Unnamed contractor'
)

export const contractorLastJobKey = (contractor) => {
  const month = finiteInt(contractor?.lastJobMonth)
  const year = finiteInt(contractor?.lastJobYear)
  if (!year || month < 1 || month > 12) return null
  return year * 12 + month
}

export const sortContractors = (contractors, sort = 'last-desc') => [...(contractors || [])].sort((left, right) => {
  if (sort === 'name-asc') return contractorDisplayName(left).localeCompare(contractorDisplayName(right), undefined, { sensitivity: 'base' })

  const leftKey = contractorLastJobKey(left)
  const rightKey = contractorLastJobKey(right)
  if (leftKey == null && rightKey != null) return 1
  if (leftKey != null && rightKey == null) return -1
  if (leftKey != null && rightKey != null && leftKey !== rightKey) return sort === 'last-asc' ? leftKey - rightKey : rightKey - leftKey
  return contractorDisplayName(left).localeCompare(contractorDisplayName(right), undefined, { sensitivity: 'base' })
})

export const filterContractors = (contractors, { propertyId = 'all', trade = 'all', sort = 'last-desc' } = {}) => {
  const filtered = (contractors || []).filter((contractor) => {
    const propertyMatch = propertyId === 'all'
      || (propertyId === 'unassigned' ? !(contractor.propertyIds || []).length : (contractor.propertyIds || []).includes(propertyId))
    const tradeMatch = trade === 'all' || contractor.trade === trade
    return propertyMatch && tradeMatch
  })
  return sortContractors(filtered, sort)
}
