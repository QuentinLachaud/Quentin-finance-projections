export const PROPERTY_EDITOR_CORE_KEYS = [
  'name', 'address', 'postcode', 'latestValuation', 'rent',
]

export const PROPERTY_EDITOR_OPTIONAL_SECTIONS = [
  {
    id: 'purchase',
    title: 'Purchase & property details',
    description: 'Purchase history and physical property details',
    keys: ['flatNumber', 'purchasePrice', 'homeReportPurchase', 'areaSqm', 'bedrooms', 'epc', 'purchaseDate'],
  },
  {
    id: 'financing',
    title: 'Financing',
    description: 'Loan, lender and remortgage information',
    keys: ['loanAmount', 'lender', 'baseRate', 'fixedRateMonths', 'latestRemortgage', 'mortgageNumber', 'qualifyingFinanceBalance'],
  },
  {
    id: 'costs',
    title: 'Running costs',
    description: 'Recurring property costs used by the model',
    keys: ['factorsFees', 'repairs'],
  },
  {
    id: 'tenancy',
    title: 'Tenancy',
    description: 'Current tenant details and tenancy dates',
    keys: ['tenantName', 'tenantEmail', 'tenantPhone', 'tenantOccupation', 'tenantMoveIn', 'tenantMoveOut', 'depositHeld'],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    description: 'Safety and certification expiry dates',
    keys: ['gasExpiry', 'eicrExpiry', 'epcExpiry', 'patExpiry'],
  },
]

const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0
const nonBlank = (value) => typeof value === 'string' ? value.trim().length > 0 : value != null && value !== ''

export const propertyFieldHasValue = (property = {}, key = '') => {
  if (!property || typeof property !== 'object') return false
  const value = property[key]
  if (value == null || value === '') return false
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  if (typeof value === 'string') return value.trim().length > 0
  return Boolean(value)
}

export const propertySectionCompletion = (property = {}, keys = []) =>
  (Array.isArray(keys) ? keys : []).filter((key) => {
    if (key === 'fixedRateMonths' && !propertyHasMortgage(property)) return false
    return propertyFieldHasValue(property, key)
  }).length

export const propertyHasMortgage = (property = {}) =>
  finitePositive(property?.loanAmount)
  || finitePositive(property?.baseRate)
  || nonBlank(property?.lender)
  || nonBlank(property?.latestRemortgage)
  || nonBlank(property?.mortgageNumber)
  || propertyFieldHasValue(property, 'qualifyingFinanceBalance')

const hasNextRemortgageInputs = (property) => nonBlank(property?.latestRemortgage) && finitePositive(property?.fixedRateMonths)

export const propertyMetricSupported = (property = {}, supportKey = '') => {
  if (!supportKey) return true
  const currentValue = finitePositive(property?.latestValuation)
  const loanBalance = finitePositive(property?.loanAmount)
  const rent = finitePositive(property?.rent)
  const baseRate = finitePositive(property?.baseRate)
  const homeReportPurchase = finitePositive(property?.homeReportPurchase)
  const mortgage = propertyHasMortgage(property)
  const nextRemortgage = hasNextRemortgageInputs(property)

  const support = {
    currentValue,
    loanBalance,
    equity: currentValue && (!mortgage || loanBalance),
    ltv: currentValue && loanBalance,
    rent,
    mortgagePayment: loanBalance && baseRate,
    operatingCashflow: rent && (!mortgage || (loanBalance && baseRate)),
    netYield: rent && homeReportPurchase,
    grossYield: rent && homeReportPurchase,
    interestRate: baseRate,
    lender: nonBlank(property?.lender),
    nextRemortgage,
    brokerDate: nextRemortgage,
    purchasePrice: finitePositive(property?.purchasePrice),
    homeReportPurchase,
    expectedRemortgageValue: currentValue && nextRemortgage,
    expectedRemortgageLtv: currentValue && loanBalance && nextRemortgage,
    releasableEquity: currentValue && loanBalance,
    interestCoverage: rent && loanBalance && baseRate,
    annualAppreciation: currentValue,
    voidHistory: nonBlank(property?.purchaseDate),
    address: nonBlank(property?.address) || nonBlank(property?.flatNumber),
    postcode: nonBlank(property?.postcode),
    bedrooms: finitePositive(property?.bedrooms),
    epc: nonBlank(property?.epc),
    area: finitePositive(property?.areaSqm),
    purchaseDate: nonBlank(property?.purchaseDate),
    gasExpiry: nonBlank(property?.gasExpiry),
    eicrExpiry: nonBlank(property?.eicrExpiry),
    patExpiry: nonBlank(property?.patExpiry),
    epcExpiry: nonBlank(property?.epcExpiry),
  }
  return Boolean(support[supportKey])
}

export const supportedPropertyRows = (rows = [], advanced = false, properties = []) => {
  const propertyList = Array.isArray(properties) ? properties : []
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!advanced && row?.[3] === true) return false
    const supportKey = row?.[6]
    if (!supportKey || propertyList.length === 0) return true
    return propertyList.some((property) => propertyMetricSupported(property, supportKey))
  })
}
