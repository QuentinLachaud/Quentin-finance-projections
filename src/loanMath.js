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
const feeModeFrom = (value, fallback = 'percent') => value === 'amount' ? 'amount' : value === 'percent' ? 'percent' : fallback
const principalFromLoan = (loan) => hasOwn(loan, 'principalAmount') ? nonNegative(loan?.principalAmount) : nonNegative(loan?.loanAmount)
const productFeeFrom = (principal, mode, value) => feeModeFrom(mode) === 'amount' ? nonNegative(value) : nonNegative(principal) * nonNegative(value) / 100
const normalizedTermMonths = (value) => {
  const parsed = Math.round(finite(value, DEFAULT_REPAYMENT_TERM_MONTHS))
  return parsed > 0 ? parsed : DEFAULT_REPAYMENT_TERM_MONTHS
}

export const hasMortgageData = (property) => Boolean(
  nonNegative(property?.loanAmount) || String(property?.lender || '').trim()
  || nonNegative(property?.baseRate) || String(property?.latestRemortgage || '').trim()
  || String(property?.mortgageNumber || '').trim()
)
export const inferLtvBand = (loanAmount, propertyValue) => {
  const value = nonNegative(propertyValue)
  const loan = nonNegative(loanAmount)
  if (!value || !loan) return 0
  return Math.min(100, Math.max(5, Math.ceil(loan / value * 100 / 5) * 5))
}
export const loanProductFeeAmount = (loan) => productFeeFrom(principalFromLoan(loan), loan?.feeMode, loan?.feeValue)
export const effectiveLoanAmount = (loan) => {
  if (loan?.currentBalance !== '' && loan?.currentBalance != null) return nonNegative(loan.currentBalance)
  const principal = principalFromLoan(loan)
  return principal + (loan?.addFeeToLoan ? productFeeFrom(principal, loan?.feeMode, loan?.feeValue) : 0)
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
  return {
    monthlyPayment,
    monthlyInterestCost: principal * monthlyRate,
    firstMonthPrincipal: Math.max(0, monthlyPayment - principal * monthlyRate),
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
      principalAmount: principalFromLoan(loan), effectiveBalance: balance, interestOnly, termMonths,
      monthlyCost: monthlyInterestCost, monthlyPayment: monthlyInterestCost, monthlyInterestCost,
      firstMonthPrincipal: 0, totalPrincipalRepaid: 0, totalInterestCost, productFee,
      totalCost: totalInterestCost + productFee, months, paymentMonths: months,
    }
  }
  const repayment = repaymentBreakdown(balance, rate, termMonths, months)
  return {
    principalAmount: principalFromLoan(loan), effectiveBalance: balance, interestOnly, termMonths,
    monthlyCost: repayment.monthlyPayment, monthlyPayment: repayment.monthlyPayment,
    monthlyInterestCost: repayment.monthlyInterestCost, firstMonthPrincipal: repayment.firstMonthPrincipal,
    totalPrincipalRepaid: repayment.totalPrincipalRepaid, totalInterestCost: repayment.totalInterestCost,
    productFee, totalCost: repayment.totalInterestCost + productFee, months, paymentMonths: repayment.paymentMonths,
  }
}
export const normalizePropertyMortgage = (property = {}) => {
  const principalAmount = hasOwn(property, 'mortgagePrincipalAmount') ? nonNegative(property.mortgagePrincipalAmount) : nonNegative(property.loanAmount)
  const feeMode = feeModeFrom(property.mortgageFeeMode)
  const feeValue = nonNegative(property.mortgageFeeValue)
  const addFeeToLoan = Boolean(property.mortgageFeeAddedToLoan)
  const loanAmount = principalAmount + (addFeeToLoan ? productFeeFrom(principalAmount, feeMode, feeValue) : 0)
  return {
    ...property, mortgagePrincipalAmount: principalAmount, loanAmount,
    mortgageFeeMode: feeMode, mortgageFeeValue: feeValue, mortgageFeeAddedToLoan: addFeeToLoan,
    mortgageInterestOnly: property?.mortgageInterestOnly !== false,
    mortgageTermMonths: normalizedTermMonths(property?.mortgageTermMonths),
  }
}
export const updatePropertyMortgageInput = (property, principalAmount) => normalizePropertyMortgage({
  ...property, mortgagePrincipalAmount: nonNegative(principalAmount),
})
export const createBlankLoan = () => ({
  id: makeId(), propertyId: '', lender: '', principalAmount: 0, loanAmount: 0, rate: 0,
  fixedRateMonths: 0, fixedStartDate: '', feeMode: 'percent', feeValue: 0, addFeeToLoan: false,
  interestOnly: true, termMonths: DEFAULT_REPAYMENT_TERM_MONTHS, ltvBand: 0,
})
export const normalizeLoan = (loan, properties = []) => {
  const source = loan || {}
  const property = propertyById(properties, source.propertyId)
  const principalAmount = principalFromLoan(source)
  const feeMode = feeModeFrom(source.feeMode)
  const feeValue = nonNegative(source.feeValue)
  const addFeeToLoan = Boolean(source.addFeeToLoan)
  const currentBalance = source.currentBalance !== '' && source.currentBalance != null ? nonNegative(source.currentBalance) : null
  const loanAmount = currentBalance ?? (principalAmount + (addFeeToLoan ? productFeeFrom(principalAmount, feeMode, feeValue) : 0))
  const fallbackBand = property ? inferLtvBand(loanAmount, property.latestValuation) : 0
  return {
    ...source, id: String(source.id || makeId()), propertyId: property ? property.id : '',
    lender: String(source.lender || ''), principalAmount, loanAmount, rate: nonNegative(source.rate),
    fixedRateMonths: Math.max(0, Math.round(finite(source.fixedRateMonths))), fixedStartDate: String(source.fixedStartDate || ''),
    feeMode, feeValue, addFeeToLoan, interestOnly: source.interestOnly !== false,
    termMonths: normalizedTermMonths(source.termMonths), ltvBand: nonNegative(source.ltvBand) || fallbackBand,
    mortgageNumber: String(source.mortgageNumber || ''), qualifyingFinanceBalance: source.qualifyingFinanceBalance ?? '',
    ...(currentBalance === null ? {} : { currentBalance }),
  }
}
export const createLoanFromProperty = (property, existingLoan = null) => {
  const existing = existingLoan ? normalizeLoan(existingLoan, [property]) : null
  const feeMode = existing ? existing.feeMode : feeModeFrom(property?.mortgageFeeMode)
  const feeValue = existing ? existing.feeValue : nonNegative(property?.mortgageFeeValue)
  const addFeeToLoan = existing ? existing.addFeeToLoan : Boolean(property?.mortgageFeeAddedToLoan)
  const interestOnly = existing ? existing.interestOnly : property?.mortgageInterestOnly !== false
  const termMonths = existing ? existing.termMonths : normalizedTermMonths(property?.mortgageTermMonths)
  const propertyBalance = nonNegative(property?.loanAmount)
  const propertyHasPrincipal = hasOwn(property, 'mortgagePrincipalAmount')
  const propertyPrincipal = propertyHasPrincipal ? nonNegative(property?.mortgagePrincipalAmount) : propertyBalance
  let principalAmount = propertyPrincipal
  if (existing) {
    const principalWasEdited = propertyHasPrincipal && !closeEnough(propertyPrincipal, existing.principalAmount)
    const effectiveBalanceWasEdited = !closeEnough(propertyBalance, existing.loanAmount)
    principalAmount = principalWasEdited ? propertyPrincipal : effectiveBalanceWasEdited ? propertyBalance : existing.principalAmount
  }
  const raw = {
    ...(existing || {}), id: existing?.id || `loan-${property.id}`, propertyId: property.id,
    lender: String(property?.lender || ''), principalAmount, rate: nonNegative(property?.baseRate),
    fixedRateMonths: Math.max(0, Math.round(finite(property?.fixedRateMonths))), fixedStartDate: String(property?.latestRemortgage || ''),
    mortgageNumber: String(property?.mortgageNumber || existing?.mortgageNumber || ''), feeMode, feeValue, addFeeToLoan,
    interestOnly, termMonths, ltvBand: existing?.ltvBand || nonNegative(property?.mortgageLtvBand),
    qualifyingFinanceBalance: property?.qualifyingFinanceBalance ?? existing?.qualifyingFinanceBalance ?? '',
  }
  if (!existing || !closeEnough(principalAmount, existing.principalAmount)) delete raw.currentBalance
  const normalized = normalizeLoan(raw, [property])
  return { ...normalized, ltvBand: normalized.ltvBand || inferLtvBand(normalized.loanAmount, property?.latestValuation) }
}
export const normalizeLoans = (loans, properties = []) => {
  if (Array.isArray(loans)) return loans.map((loan) => normalizeLoan(loan, properties))
  return properties.filter(hasMortgageData).map((property) => createLoanFromProperty(property))
}
