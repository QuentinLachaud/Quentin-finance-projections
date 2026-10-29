import { calculatePortfolio } from './calculations.js'

export const LEGACY_COMPANY_ID = 'legacy-company'
export const COMPANY_FINANCIAL_KEYS = Object.freeze([
  'cashHeld', 'companyCosts', 'extractions', 'associatedCompanies',
  'accountingPeriodMonths', 'augmentedProfitDistributions',
  'closeInvestmentHoldingCompany', 'propertyLossBroughtForward',
  'budgetedPropertyCostsTaxDeductible',
])

const companySettingsFrom = (settings = {}) => Object.fromEntries(
  COMPANY_FINANCIAL_KEYS.filter((key) => Object.hasOwn(settings, key))
    .map((key) => [key, settings[key]]),
)

export const createPortfolioCompany = (id, name = 'New company') => ({
  id,
  name: String(name).trim() || 'New company',
  companyNumber: '',
  companyMatchedName: '',
  enabled: true,
  settings: { cashHeld: 0, companyCosts: [], extractions: [], associatedCompanies: 0 },
})

export function normalizeCompanyPortfolio(portfolio = {}) {
  const settings = portfolio.settings || {}
  const previous = Array.isArray(portfolio.companies) ? portfolio.companies : null
  const companies = previous?.length
    ? previous.map((company) => ({
        ...createPortfolioCompany(company.id, company.name),
        ...company,
        enabled: company.enabled !== false,
        settings: {
          ...createPortfolioCompany(company.id).settings,
          ...(company.settings || {}),
        },
      }))
    : [{
        ...createPortfolioCompany(LEGACY_COMPANY_ID, settings.companyName || 'Company 1'),
        companyNumber: settings.companyNumber || '',
        companyMatchedName: settings.companyMatchedName || '',
        settings: { ...createPortfolioCompany(LEGACY_COMPANY_ID).settings, ...companySettingsFrom(settings) },
      }]
  const ids = new Set(companies.map((company) => company.id))
  if (ids.size !== companies.length || companies.some((company) => !company.id)) {
    throw new Error('Company records contain missing or duplicate IDs.')
  }
  const defaultCompanyId = companies[0].id
  const properties = (Array.isArray(portfolio.properties) ? portfolio.properties : []).map((property) => ({
    ...property,
    companyId: property.companyId == null ? defaultCompanyId : property.companyId,
  }))
  if (properties.some((property) => !ids.has(property.companyId))) {
    throw new Error('A BTL references an unknown company. Ownership must be repaired before saving.')
  }
  return { ...portfolio, companies, properties }
}

export const companySettings = (company, globalSettings = {}) => ({
  ...globalSettings,
  ...(company?.settings || {}),
  companyName: company?.name || '',
  companyNumber: company?.companyNumber || '',
  companyMatchedName: company?.companyMatchedName || '',
})

export const companyIsIncluded = (property, companies) =>
  property.active === true && companies.some((company) => company.id === property.companyId && company.enabled !== false)

export const includedCompanyProperties = (properties, companies) =>
  properties.filter((property) => companyIsIncluded(property, companies))

export function setPropertyCompany(portfolio, propertyId, companyId) {
  if (!portfolio.companies.some((company) => company.id === companyId)) {
    throw new Error('Cannot assign a property to an unknown company.')
  }
  return {
    ...portfolio,
    properties: portfolio.properties.map((property) => property.id === propertyId ? { ...property, companyId } : property),
  }
}

export function removeEmptyCompany(portfolio, id) {
  if (portfolio.companies.length <= 1) throw new Error('At least one company must remain.')
  if (portfolio.properties.some((property) => property.companyId === id)) {
    throw new Error('Reassign the company’s properties before removing it.')
  }
  return { ...portfolio, companies: portfolio.companies.filter((company) => company.id !== id) }
}

// Calculate tax, expenses and cash separately for each legal entity. Summing properties
// into one fictional company would produce incorrect Corporation Tax and cash buffers.
export function calculateMultiCompanyPortfolio(properties, companies, globalSettings, now = new Date()) {
  const enabledCompanies = companies.filter((company) => company.enabled !== false)
  const perCompany = enabledCompanies.map((company) => ({
    company,
    portfolio: calculatePortfolio(
      properties.filter((property) => property.companyId === company.id),
      companySettings(company, globalSettings),
      now,
    ),
  }))
  if (perCompany.length === 1) return { ...perCompany[0].portfolio, byCompany: perCompany }
  const empty = calculatePortfolio([], { ...globalSettings, cashHeld: 0, companyCosts: [], extractions: [] }, now)
  if (!perCompany.length) return { ...empty, byCompany: [] }

  const sum = (key) => perCompany.reduce((total, item) => total + (Number(item.portfolio[key]) || 0), 0)
  const numericFields = [
    'rent', 'fixedCosts', 'propertyFixedCosts', 'companyCosts', 'deductibleCompanyCosts',
    'management', 'variableCosts', 'voids', 'problemBudget', 'complianceBudget',
    'financeAdminBudget', 'factorsCosts', 'financeCosts', 'mortgagePayments',
    'qualifyingFinanceCosts', 'nonFinancePropertyCosts', 'extractionTotal',
    'deductibleExtractions', 'appreciation', 'totalValue', 'totalLoans', 'totalEquity',
    'safeCashNeeded', 'cashHeld',
  ]
  const totals = Object.fromEntries(numericFields.map((key) => [key, sum(key)]))
  const scenarios = [0, 1, 2].map((index) => {
    const values = perCompany.map(({ portfolio }) => portfolio.scenarios[index])
    const fields = ['collectedRent', 'voidLoss', 'management', 'problemBudget', 'tax', 'bankCashflow', 'cashflow', 'totalGain', 'taxable']
    return {
      id: index + 1,
      ...Object.fromEntries(fields.map((key) => [key, values.reduce((total, value) => total + (Number(value[key]) || 0), 0)])),
      privateTax: null,
      corporationTax: null, // Never present separate legal entities as one tax return.
    }
  })
  const loans = totals.totalLoans
  const burn = scenarios[0].bankCashflow
  const runningCosts = totals.fixedCosts + totals.variableCosts
  return {
    ...empty,
    ...totals,
    selected: perCompany.flatMap(({ portfolio }) => portfolio.selected),
    count: perCompany.reduce((total, item) => total + item.portfolio.count, 0),
    weightedRate: loans ? perCompany.reduce((total, item) => total + item.portfolio.weightedRate * item.portfolio.totalLoans, 0) / loans : 0,
    scenarios,
    bufferMonths: runningCosts ? totals.cashHeld / runningCosts : 0,
    extraCashNeeded: Math.max(0, totals.safeCashNeeded - totals.cashHeld),
    glideMonths: burn < 0 ? Math.floor(totals.cashHeld / Math.abs(burn)) : Infinity,
    byCompany: perCompany,
  }
}
