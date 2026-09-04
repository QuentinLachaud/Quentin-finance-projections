const makeId = () => globalThis.crypto?.randomUUID?.()
  || `loan-${Date.now()}-${Math.random().toString(16).slice(2)}`

const DEFAULT_REPAYMENT_TERM_MONTHS = 300

const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const nonNegative = (value) => Math.max(0, finite(value))
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)
const propertyById = (properties, propertyId) => (properties || []).find((property) => property.id === propertyId) || null
const closeEnough = (left, right) => Math.abs(nonNegative(left) - nonNegative(right)) < 0.005

const feeModeFrom = (value, fallback = 'percent') => value === 'amount'
  ? 'amount'
  : value === 'percent'
    ? 'percent'
    : fallback

const principalFromLoan = (loan) => hasOwn(loan, 'principalAmount')
  ? nonNegative(loan?.principalAmount)
  : nonNegative(loan?.loanAmount)

const productFeeFrom = (principalAmount, feeMode, feeValue) => {
  const principal = nonNegative(principalAmount)
  const value = nonNegative(feeValue)
  return feeModeFrom(feeMode) === 'amount' ? value : principal * value / 100
}

const normalizedTermMonths = (value) => {
  const parsed = Math.round(finite(value, DEFAULT_REPAYMENT_TERM_MONTHS))
  return parsed > 0 ? parsed : DEFAULT_REPAYMENT_TERM_MONTHS
}

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

export const loanProductFeeAmount = (loan) => productFeeFrom(
  principalFromLoan(loan),
  loan?.feeMode,
  loan?.feeValue,
)

export const effectiveLoanAmount = (loan) => {
  const principalAmount = principalFromLoan(loan)
  return principalAmount + (loan?.addFeeToLoan ? productFeeFrom(principalAmount, loan?.feeMode, loan?.feeValue) : 0)
}

export const repaymentMonthlyPayment = (balance, annualRate, termMonths) => {
  const principal = nonNegative(balance)
  const months = normalizedTermMonths(termMonths)
  const monthlyRate = nonNegative(annualRate) / 12
  if (!principal) return 0
  if (!monthlyRate) return principal / months
  return principal * monthlyRate / (1 - ((1 + monthlyRate) ** -months))
}

const repaymentBreakdown = (balance, annualRate, termMonths, fixedRateMonths) => {
  const principal = nonNegative(balance)
  const term = normalizedTermMonths(termMonths)
  const fixedMonths = Math.max(0, Math.round(finite(fixedRateMonths)))
  const monthlyRate = nonNegative(annualRate) / 12
  const monthlyPayment = repaymentMonthlyPayment(principal, annualRate, term)
  const months = Math.min(fixedMonths, term)
  let remainingBalance = principal
  let totalInterestCost = 0

  for (let month = 0; month < months && remainingBalance > 0; month += 1) {
    const interest = remainingBalance * monthlyRate
    const principalPayment = Math.min(remainingBalance, Math.max(0, monthlyPayment - interest))
    totalInterestCost += interest
    remainingBalance = Math.max(0, remainingBalance - principalPayment)
  }

  const monthlyInterestCost = principal * monthlyRate
  return {
    monthlyPayment,
    monthlyInterestCost,
    firstMonthPrincipal: Math.max(0, monthlyPayment - monthlyInterestCost),
    totalInterestCost,
    totalPrincipalRepaid: principal - remainingBalance,
    paymentMonths: months,
  }
}

export const loanCostSummary = (loan) => {
  const balance = effectiveLoanAmount(loan)
  const rate = nonNegative(loan?.rate)
  const months = Math.max(0, Math.round(finite(loan?.fixedRateMonths)))
  const interestOnly = loan?.interestOnly !== false
  const termMonths = normalizedTermMonths(loan?.termMonths)
  const productFee = loanProductFeeAmount(loan)
  const monthlyInterestCost = balance * rate / 12

  if (interestOnly) {
    const totalInterestCost = monthlyInterestCost * months
    return {
      principalAmount: principalFromLoan(loan),
      effectiveBalance: balance,
      interestOnly,
      termMonths,
      monthlyCost: monthlyInterestCost,
      monthlyPayment: monthlyInterestCost,
      monthlyInterestCost,
      firstMonthPrincipal: 0,
      totalPrincipalRepaid: 0,
      totalInterestCost,
      productFee,
      totalCost: totalInterestCost + productFee,
      months,
      paymentMonths: months,
    }
  }

  const repayment = repaymentBreakdown(balance, rate, termMonths, months)
  return {
    principalAmount: principalFromLoan(loan),
    effectiveBalance: balance,
    interestOnly,
    termMonths,
    monthlyCost: repayment.monthlyPayment,
    monthlyPayment: repayment.monthlyPayment,
    monthlyInterestCost: repayment.monthlyInterestCost,
    firstMonthPrincipal: repayment.firstMonthPrincipal,
    totalPrincipalRepaid: repayment.totalPrincipalRepaid,
    totalInterestCost: repayment.totalInterestCost,
    productFee,
    totalCost: repayment.totalInterestCost + productFee,
    months,
    paymentMonths: repayment.paymentMonths,
  }
}

export const normalizePropertyMortgage = (property = {}) => {
  const principalAmount = hasOwn(property, 'mortgagePrincipalAmount')
    ? nonNegative(property.mortgagePrincipalAmount)
    : nonNegative(property.loanAmount)
  const feeMode = feeModeFrom(property.mortgageFeeMode)
  const feeValue = nonNegative(property.mortgageFeeValue)
  const addFeeToLoan = Boolean(property.mortgageFeeAddedToLoan)
  const loanAmount = principalAmount + (addFeeToLoan ? productFeeFrom(principalAmount, feeMode, feeValue) : 0)
  return {
    ...property,
    mortgagePrincipalAmount: principalAmount,
    loanAmount,
    mortgageFeeMode: feeMode,
    mortgageFeeValue: feeValue,
    mortgageFeeAddedToLoan: addFeeToLoan,
    mortgageInterestOnly: property?.mortgageInterestOnly !== false,
    mortgageTermMonths: normalizedTermMonths(property?.mortgageTermMonths),
  }
}

export const updatePropertyMortgageInput = (property, principalAmount) => normalizePropertyMortgage({
  ...property,
  mortgagePrincipalAmount: nonNegative(principalAmount),
})

export const createBlankLoan = () => ({
  id: makeId(),
  propertyId: '',
  lender: '',
  principalAmount: 0,
  loanAmount: 0,
  rate: 0,
  fixedRateMonths: 0,
  fixedStartDate: '',
  feeMode: 'percent',
  feeValue: 0,
  addFeeToLoan: false,
  interestOnly: true,
  termMonths: DEFAULT_REPAYMENT_TERM_MONTHS,
  ltvBand: 0,
})

export const normalizeLoan = (loan, properties = []) => {
  const source = loan || {}
  const property = propertyById(properties, source.propertyId)
  const principalAmount = principalFromLoan(source)
  const feeMode = feeModeFrom(source.feeMode)
  const feeValue = nonNegative(source.feeValue)
  const addFeeToLoan = Boolean(source.addFeeToLoan)
  const loanAmount = principalAmount + (addFeeToLoan ? productFeeFrom(principalAmount, feeMode, feeValue) : 0)
  const fallbackBand = property ? inferLtvBand(loanAmount, property.latestValuation) : 0
  return {
    id: String(source.id || makeId()),
    propertyId: property ? property.id : '',
    lender: String(source.lender || ''),
    principalAmount,
    loanAmount,
    rate: nonNegative(source.rate),
    fixedRateMonths: Math.max(0, Math.round(finite(source.fixedRateMonths))),
    fixedStartDate: String(source.fixedStartDate || ''),
    feeMode,
    feeValue,
    addFeeToLoan,
    interestOnly: source.interestOnly !== false,
    termMonths: normalizedTermMonths(source.termMonths),
    ltvBand: nonNegative(source.ltvBand) || fallbackBand,
  }
}

export const createLoanFromProperty = (property, existingLoan = null) => {
  const existing = existingLoan ? normalizeLoan(existingLoan, [property]) : null
  const propertyValue = nonNegative(property?.latestValuation)
  const feeMode = existing ? existing.feeMode : feeModeFrom(property?.mortgageFeeMode)
  const feeValue = existing ? existing.feeValue : nonNegative(property?.mortgageFeeValue)
  const addFeeToLoan = existing ? existing.addFeeToLoan : Boolean(property?.mortgageFeeAddedToLoan)
  const interestOnly = existing ? existing.interestOnly : property?.mortgageInterestOnly !== false
  const termMonths = existing ? existing.termMonths : normalizedTermMonths(property?.mortgageTermMonths)
  const propertyBalance = nonNegative(property?.loanAmount)
  const propertyHasPrincipal = hasOwn(property, 'mortgagePrincipalAmount')
  const propertyPrincipal = propertyHasPrincipal
    ? nonNegative(property?.mortgagePrincipalAmount)
    : propertyBalance

  let principalAmount = propertyPrincipal
  if (existing) {
    const principalWasEdited = propertyHasPrincipal && !closeEnough(propertyPrincipal, existing.principalAmount)
    const effectiveBalanceWasEdited = !closeEnough(propertyBalance, existing.loanAmount)
    principalAmount = principalWasEdited
      ? propertyPrincipal
      : effectiveBalanceWasEdited
        ? propertyBalance
        : existing.principalAmount
  }

  const raw = {
    id: existing?.id || `loan-${property.id}`,
    propertyId: property.id,
    lender: String(property?.lender || ''),
    principalAmount,
    rate: nonNegative(property?.baseRate),
    fixedRateMonths: Math.max(0, Math.round(finite(property?.fixedRateMonths))),
    fixedStartDate: String(property?.latestRemortgage || ''),
    feeMode,
    feeValue,
    addFeeToLoan,
    interestOnly,
    termMonths,
    ltvBand: existing?.ltvBand || nonNegative(property?.mortgageLtvBand),
  }
  const normalized = normalizeLoan(raw, [property])
  return {
    ...normalized,
    ltvBand: normalized.ltvBand || inferLtvBand(normalized.loanAmount, propertyValue),
  }
}

export const normalizeLoans = (loans, properties = []) => {
  if (Array.isArray(loans)) return loans.map((loan) => normalizeLoan(loan, properties))
  return properties.filter(hasMortgageData).map((property) => createLoanFromProperty(property))
}

export const applyLoanToProperty = (loan, property) => ({
  ...property,
  lender: loan.lender,
  mortgagePrincipalAmount: loan.principalAmount,
  loanAmount: loan.loanAmount,
  baseRate: loan.rate,
  fixedRateMonths: loan.fixedRateMonths,
  latestRemortgage: loan.fixedStartDate,
  mortgageFeeMode: loan.feeMode,
  mortgageFeeValue: loan.feeValue,
  mortgageFeeAddedToLoan: loan.addFeeToLoan,
  mortgageInterestOnly: loan.interestOnly,
  mortgageTermMonths: loan.termMonths,
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

export const reconcileLoanPortfolio = ({ properties = [], loans, comparisons = [] }) => {
  let nextProperties = (Array.isArray(properties) ? properties : []).map((property) => normalizePropertyMortgage(property))
  const normalizedLoans = normalizeLoans(loans, nextProperties)
  let nextComparisons = Array.isArray(comparisons) ? comparisons : []

  for (const loan of normalizedLoans) {
    const linkedProperty = propertyById(nextProperties, loan.propertyId)
    if (!linkedProperty) continue
    const nextProperty = applyLoanToProperty(loan, linkedProperty)
    nextProperties = nextProperties.map((property) => property.id === nextProperty.id ? nextProperty : property)
    nextComparisons = syncLoanToRemortgageComparisons(loan, nextProperty, nextComparisons)
  }

  return { properties: nextProperties, loans: normalizedLoans, comparisons: nextComparisons }
}

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
  if (!existingLoan && !hasMortgageData(property)) return { loans, comparisons, property }

  const loan = createLoanFromProperty(property, existingLoan)
  const nextProperty = applyLoanToProperty(loan, property)
  const nextLoans = existingLoan
    ? loans.map((candidate) => candidate.id === existingLoan.id ? loan : candidate)
    : [...loans, loan]
  return {
    property: nextProperty,
    loans: nextLoans,
    comparisons: syncLoanToRemortgageComparisons(loan, nextProperty, comparisons),
  }
}
