const makeId = () => globalThis.crypto?.randomUUID?.()
  || `loan-${Date.now()}-${Math.random().toString(16).slice(2)}`

const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const nonNegative = (value) => Math.max(0, finite(value))
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)
const propertyById = (properties, propertyId) => (properties || []).find((property) => property.id === propertyId) || null

export const hasMortgageData = (property) => Boolean(
  nonNegative(property?.loanAmount)
  || String(property?.lender || '').trim()
  || nonNegative(property?.baseRate)
  || String(property?.latestRemortgage || '').trim()
  || String(property?.mortgageNumber || '').trim()
)

export const inferLtvBand = (loanAmount, propertyValue) => {
  const value = nonNegative(propertyValue)
  const loan = nonNegative(loanAmount)
  if (!value || !loan) return 0
  const actual = loan / value * 100
  return Math.min(100, Math.max(5, Math.ceil(actual / 5) * 5))
}

export const createBlankLoan = () => ({
  id: makeId(),
  propertyId: '',
  lender: '',
  loanAmount: 0,
  rate: 0,
  fixedRateMonths: 0,
  fixedStartDate: '',
  feeMode: 'percent',
  feeValue: 0,
  addFeeToLoan: false,
  ltvBand: 0,
})

const feeModeFrom = (value, fallback = 'percent') => value === 'amount'
  ? 'amount'
  : value === 'percent'
    ? 'percent'
    : fallback

export const createLoanFromProperty = (property, existingLoan = null) => {
  const existing = existingLoan || {}
  const propertyValue = nonNegative(property?.latestValuation)
  const loanAmount = nonNegative(property?.loanAmount)
  const feeMode = hasOwn(property, 'mortgageFeeMode')
    ? feeModeFrom(property.mortgageFeeMode)
    : feeModeFrom(existing.feeMode)
  const feeValue = hasOwn(property, 'mortgageFeeValue')
    ? nonNegative(property.mortgageFeeValue)
    : nonNegative(existing.feeValue)
  const addFeeToLoan = hasOwn(property, 'mortgageFeeAddedToLoan')
    ? Boolean(property.mortgageFeeAddedToLoan)
    : Boolean(existing.addFeeToLoan)
  const storedBand = hasOwn(property, 'mortgageLtvBand')
    ? nonNegative(property.mortgageLtvBand)
    : nonNegative(existing.ltvBand)

  return {
    id: existing.id || `loan-${property.id}`,
    propertyId: property.id,
    lender: String(property?.lender || ''),
    loanAmount,
    rate: nonNegative(property?.baseRate),
    fixedRateMonths: Math.max(0, Math.round(finite(property?.fixedRateMonths))),
    fixedStartDate: String(property?.latestRemortgage || ''),
    feeMode,
    feeValue,
    addFeeToLoan,
    ltvBand: storedBand || inferLtvBand(loanAmount, propertyValue),
  }
}

export const normalizeLoan = (loan, properties = []) => {
  const source = loan || {}
  const property = propertyById(properties, source.propertyId)
  const fallbackBand = property ? inferLtvBand(source.loanAmount, property.latestValuation) : 0
  return {
    id: String(source.id || makeId()),
    propertyId: property ? property.id : '',
    lender: String(source.lender || ''),
    loanAmount: nonNegative(source.loanAmount),
    rate: nonNegative(source.rate),
    fixedRateMonths: Math.max(0, Math.round(finite(source.fixedRateMonths))),
    fixedStartDate: String(source.fixedStartDate || ''),
    feeMode: feeModeFrom(source.feeMode),
    feeValue: nonNegative(source.feeValue),
    addFeeToLoan: Boolean(source.addFeeToLoan),
    ltvBand: nonNegative(source.ltvBand) || fallbackBand,
  }
}

export const normalizeLoans = (loans, properties = []) => {
  if (Array.isArray(loans)) return loans.map((loan) => normalizeLoan(loan, properties))
  return properties.filter(hasMortgageData).map((property) => createLoanFromProperty(property))
}

export const applyLoanToProperty = (loan, property) => ({
  ...property,
  lender: loan.lender,
  loanAmount: loan.loanAmount,
  baseRate: loan.rate,
  fixedRateMonths: loan.fixedRateMonths,
  latestRemortgage: loan.fixedStartDate,
  mortgageFeeMode: loan.feeMode,
  mortgageFeeValue: loan.feeValue,
  mortgageFeeAddedToLoan: loan.addFeeToLoan,
  mortgageLtvBand: loan.ltvBand,
})

const currentScenarioFromLoan = (comparison, loan, property) => {
  const propertyValue = nonNegative(property?.latestValuation)
  const left = comparison?.left || {}
  return {
    ...left,
    propertyValue,
    loanAmount: loan.loanAmount,
    ltv: propertyValue ? loan.loanAmount / propertyValue * 100 : 0,
    loanBasis: 'loan',
    rate: loan.rate * 100,
  }
}

export const syncLoanToRemortgageComparisons = (loan, property, comparisons = []) => comparisons.map((comparison) => {
  if (!property || comparison.sourcePropertyId !== property.id) return comparison
  return { ...comparison, left: currentScenarioFromLoan(comparison, loan, property) }
})

export const applyLoanToPortfolio = (state, rawLoan) => {
  const properties = Array.isArray(state?.properties) ? state.properties : []
  const comparisons = Array.isArray(state?.remortgageComparisons) ? state.remortgageComparisons : []
  const existingLoans = Array.isArray(state?.loans) ? state.loans : []
  const loan = normalizeLoan(rawLoan, properties)
  const linkedProperty = propertyById(properties, loan.propertyId)

  const deconflictedLoans = linkedProperty
    ? existingLoans.map((candidate) => candidate.id !== loan.id && candidate.propertyId === linkedProperty.id
      ? { ...candidate, propertyId: '' }
      : candidate)
    : existingLoans
  const loans = deconflictedLoans.some((candidate) => candidate.id === loan.id)
    ? deconflictedLoans.map((candidate) => candidate.id === loan.id ? loan : candidate)
    : [...deconflictedLoans, loan]

  if (!linkedProperty) return { ...state, loans }

  const nextProperty = applyLoanToProperty(loan, linkedProperty)
  return {
    ...state,
    loans,
    properties: properties.map((property) => property.id === linkedProperty.id ? nextProperty : property),
    remortgageComparisons: syncLoanToRemortgageComparisons(loan, nextProperty, comparisons),
  }
}

export const syncPropertyMortgage = ({ property, loans = [], comparisons = [] }) => {
  const existingLoan = loans.find((loan) => loan.propertyId === property.id) || null
  if (!existingLoan && !hasMortgageData(property)) return { loans, comparisons }

  const loan = createLoanFromProperty(property, existingLoan)
  const nextLoans = existingLoan
    ? loans.map((candidate) => candidate.id === existingLoan.id ? loan : candidate)
    : [...loans, loan]
  return {
    loans: nextLoans,
    comparisons: syncLoanToRemortgageComparisons(loan, property, comparisons),
  }
}
