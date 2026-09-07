import {
  createLoanFromProperty, effectiveLoanAmount, hasMortgageData, inferLtvBand,
  normalizeLoan, normalizeLoans, normalizePropertyMortgage, repaymentMonthlyPayment,
} from './loanMath.js'

const number = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const positive = (value) => Math.max(0, number(value))
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key)
const dateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : ''
const addMonths = (value, months) => {
  const source = dateOnly(value)
  if (!source) return ''
  const [year, month, day] = source.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + Math.trunc(number(months)), 1))
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`
}

export const loansForProperty = (loans = [], propertyId = '') =>
  (Array.isArray(loans) ? loans : []).filter((loan) => Boolean(propertyId) && loan.propertyId === propertyId)

export const loanFinancials = (loan, rateShock = 0) => {
  const balance = effectiveLoanAmount(loan)
  const rate = Math.max(0, number(loan?.rate) + number(rateShock))
  const monthlyInterestCost = balance * rate / 12
  const interestOnly = loan?.interestOnly !== false
  const termMonths = Math.max(1, Math.round(number(loan?.termMonths, 300)))
  const scheduledPayment = interestOnly ? monthlyInterestCost : repaymentMonthlyPayment(balance, rate, termMonths)
  const monthlyPayment = balance ? Math.min(balance + monthlyInterestCost, Math.max(monthlyInterestCost, scheduledPayment)) : 0
  const principalPayment = Math.min(balance, Math.max(0, monthlyPayment - monthlyInterestCost))
  const rawQualifying = loan?.qualifyingFinanceBalance
  const qualifyingBalance = rawQualifying === '' || rawQualifying == null
    ? balance : Math.min(balance, positive(rawQualifying))
  return {
    ...loan,
    balance, rate, interestOnly, termMonths, monthlyInterestCost, monthlyPayment,
    principalPayment, qualifyingFinanceCost: qualifyingBalance * rate / 12,
  }
}

export const loanDueDate = (loan) => {
  const months = Math.max(0, Math.round(number(loan?.fixedRateMonths)))
  return months ? addMonths(loan?.fixedStartDate, months) : ''
}

export const summarizePropertyLoans = (property, loans = [], rateShock = 0) => {
  const financials = loansForProperty(loans, property?.id).map((loan) => loanFinancials(loan, rateShock))
  const sum = (key) => financials.reduce((total, loan) => total + loan[key], 0)
  const loanAmount = sum('balance')
  const rate = loanAmount ? financials.reduce((total, loan) => total + loan.balance * loan.rate, 0) / loanAmount : 0
  const remortgageSchedule = financials.map((loan) => ({
    loanId: loan.id, lender: loan.lender, loanAmount: loan.balance,
    date: loanDueDate(loan), fixedStartDate: loan.fixedStartDate,
    fixedRateMonths: loan.fixedRateMonths,
  })).filter((item) => item.date).sort((left, right) => left.date.localeCompare(right.date) || String(left.loanId).localeCompare(String(right.loanId)))
  const modes = new Set(financials.map((loan) => loan.interestOnly ? 'interest-only' : 'repayment'))
  const lenders = [...new Set(financials.map((loan) => loan.lender).filter(Boolean))]
  return {
    loans: financials,
    loanIds: financials.map((loan) => loan.id),
    loanCount: financials.length,
    loanAmount,
    principalAmount: financials.reduce((total, loan) => total + positive(loan.principalAmount), 0),
    monthlyInterestCost: sum('monthlyInterestCost'),
    monthlyPayment: sum('monthlyPayment'),
    principalPayment: sum('principalPayment'),
    qualifyingFinanceCost: sum('qualifyingFinanceCost'),
    rate,
    weightedRate: rate,
    currentLtv: positive(property?.latestValuation) ? loanAmount / positive(property.latestValuation) : 0,
    equity: positive(property?.latestValuation) - loanAmount,
    lenders,
    repaymentMode: modes.size > 1 ? 'mixed' : modes.values().next().value || 'none',
    remortgageSchedule,
    nextRemortgage: remortgageSchedule[0]?.date || '',
  }
}

export const applyLoansToProperty = (property, loans = []) => {
  const summary = summarizePropertyLoans(property, loans)
  const single = summary.loans.length === 1 ? summary.loans[0] : null
  const count = summary.loanCount
  return {
    ...property,
    loanAmount: summary.loanAmount,
    mortgagePrincipalAmount: summary.principalAmount,
    baseRate: summary.rate,
    lender: single?.lender || (count ? `${count} loans${summary.lenders.length === 1 ? ` · ${summary.lenders[0]}` : ''}` : ''),
    mortgageInterestOnly: summary.repaymentMode === 'mixed' ? null : summary.repaymentMode !== 'repayment',
    mortgageRepaymentMode: summary.repaymentMode,
    mortgageTermMonths: single?.termMonths || 300,
    fixedRateMonths: single?.fixedRateMonths || 0,
    latestRemortgage: single?.fixedStartDate || '',
    mortgageNumber: single?.mortgageNumber || '',
    mortgageFeeMode: single?.feeMode || 'percent',
    mortgageFeeValue: single?.feeValue || 0,
    mortgageFeeAddedToLoan: single?.addFeeToLoan || false,
    mortgageLtvBand: single?.ltvBand || inferLtvBand(summary.loanAmount, property.latestValuation),
    mortgageLenders: summary.lenders,
    qualifyingFinanceBalance: single?.qualifyingFinanceBalance ?? (count ? '' : property.qualifyingFinanceBalance ?? ''),
    mortgageLoanIds: summary.loanIds,
    mortgageLoanCount: count,
    remortgageSchedule: summary.remortgageSchedule,
    nextRemortgage: summary.nextRemortgage,
    mortgageMonthlyPayment: summary.monthlyPayment,
    mortgageMonthlyInterest: summary.monthlyInterestCost,
  }
}

// This is a calculation-only view, not a second persisted loan collection.
export const withPropertyLoans = (properties = [], loans = []) =>
  (Array.isArray(properties) ? properties : []).map((property) => ({
    ...applyLoansToProperty(property, loans),
    financeLoans: loansForProperty(loans, property.id),
  }))

export const applyLoanToProperty = (loan, property) => applyLoansToProperty(property, [loan])

const currentComparison = (comparison, property, summary) => {
  const value = positive(property.latestValuation)
  const single = summary.loanCount === 1 ? summary.loans[0] : null
  return {
    ...comparison.left,
    propertyValue: value,
    loanAmount: summary.loanAmount,
    ltv: value ? summary.loanAmount / value * 100 : 0,
    loanBasis: 'loan',
    rate: summary.rate * 100,
    feeMode: 'amount',
    feeValue: 0,
    addFeeToLoan: false, // Historical fees are already reflected in outstanding balances.
    currentLoans: summary.loans,
    loanCount: summary.loanCount,
    financeScope: summary.loanCount > 1 ? 'whole-property' : 'single-loan',
    currentMonthlyInterest: summary.monthlyInterestCost,
    currentMonthlyPayment: summary.monthlyPayment,
  }
}

export const reconcileLoanComparisons = (property, loans, comparisons = []) => {
  if (!property) return comparisons
  const summary = summarizePropertyLoans(property, loans)
  return comparisons.map((comparison) => comparison.sourcePropertyId === property.id
    ? { ...comparison, left: currentComparison(comparison, property, summary) }
    : comparison)
}

export const syncLoanToRemortgageComparisons = (loan, property, comparisons = []) =>
  reconcileLoanComparisons(property, Array.isArray(loan) ? loan : [loan], comparisons)

export const reconcileLoanPortfolio = ({ properties = [], loans, comparisons = [] }) => {
  const original = Array.isArray(properties) ? properties : []
  const normalizedProperties = original.map((property) => normalizePropertyMortgage(property))
  const normalizedLoans = normalizeLoans(loans, normalizedProperties)
  const ids = new Set()
  for (const loan of normalizedLoans) {
    if (ids.has(loan.id)) throw new Error(`Duplicate loan ID: ${loan.id}`)
    ids.add(loan.id)
  }
  const nextProperties = normalizedProperties.map((property) => applyLoansToProperty(property, normalizedLoans))
  const nextComparisons = nextProperties.reduce(
    (current, property) => reconcileLoanComparisons(property, normalizedLoans, current),
    Array.isArray(comparisons) ? comparisons : [],
  )
  return { properties: nextProperties, loans: normalizedLoans, comparisons: nextComparisons }
}

const reconcileState = (state, loans, properties = state.properties) => {
  const next = reconcileLoanPortfolio({
    properties, loans, comparisons: state.remortgageComparisons || [],
  })
  return { ...state, properties: next.properties, loans: next.loans, remortgageComparisons: next.comparisons }
}

export const applyLoanToPortfolio = (state, rawLoan) => {
  const properties = Array.isArray(state?.properties) ? state.properties : []
  const loan = normalizeLoan(rawLoan, properties)
  const existing = Array.isArray(state?.loans) ? state.loans : []
  const loans = existing.some((item) => item.id === loan.id)
    ? existing.map((item) => item.id === loan.id ? loan : item)
    : [...existing, loan]
  return reconcileState(state, loans, properties)
}

export const removeLoanFromPortfolio = (state, loanId) =>
  reconcileState(state, (state.loans || []).filter((loan) => loan.id !== loanId))

export const removePropertyFromLoanPortfolio = (state, propertyId) => {
  const properties = (state.properties || []).filter((property) => property.id !== propertyId)
  // Preserve the debt record, but never leave it falsely associated with a deleted asset.
  const loans = (state.loans || []).map((loan) => loan.propertyId === propertyId ? { ...loan, propertyId: '' } : loan)
  return reconcileState(state, loans, properties)
}

export const savePropertyLoans = (state, property, stagedLoans = [], removedLoanIds = []) => {
  const properties = (state.properties || []).some((item) => item.id === property.id)
    ? state.properties.map((item) => item.id === property.id ? property : item)
    : [...(state.properties || []), property]
  const original = state.loans || []
  const removed = new Set(removedLoanIds)
  for (const id of removed) {
    const loan = original.find((item) => item.id === id)
    if (!loan || loan.propertyId !== property.id) throw new Error(`Cannot remove unrelated loan: ${id}`)
  }
  const staged = stagedLoans.map((loan) => normalizeLoan({ ...loan, propertyId: property.id }, properties))
  const stagedIds = new Set(staged.map((loan) => loan.id))
  if (stagedIds.size !== staged.length) throw new Error('Duplicate loan IDs in property editor')
  for (const loan of staged) {
    const previous = original.find((item) => item.id === loan.id)
    if (previous && previous.propertyId && previous.propertyId !== property.id) {
      throw new Error(`Loan ${loan.id} belongs to another BTL; reassign it from Loans first`)
    }
  }
  const stagedById = new Map(staged.map((loan) => [loan.id, loan]))
  const existing = original.filter((loan) => !removed.has(loan.id)).map((loan) => stagedById.get(loan.id) || loan)
  const additions = staged.filter((loan) => !original.some((item) => item.id === loan.id))
  return reconcileState(state, [...existing, ...additions], properties)
}

// Legacy scalar editing remains safe for a single loan. Multiple loans must be edited explicitly.
export const syncPropertyMortgage = ({ property, loans = [], comparisons = [] }) => {
  const linked = loansForProperty(loans, property.id)
  if (linked.length > 1) {
    const summary = applyLoansToProperty(property, loans)
    return { property: summary, loans, comparisons: reconcileLoanComparisons(summary, loans, comparisons) }
  }
  if (!linked.length && !hasMortgageData(property)) {
    return { property: applyLoansToProperty(property, loans), loans, comparisons }
  }
  const loan = createLoanFromProperty(property, linked[0] || null)
  const nextLoans = linked.length
    ? loans.map((item) => item.id === loan.id ? loan : item)
    : [...loans, loan]
  const nextProperty = applyLoansToProperty(property, nextLoans)
  return {
    property: nextProperty,
    loans: nextLoans,
    comparisons: reconcileLoanComparisons(nextProperty, nextLoans, comparisons),
  }
}

// Project each debt independently. A dated release or repayment is applied at its
// own month, not retroactively after all amortisation has finished.
export const projectLoan = (loan, months = 0, rateShock = 0, events = []) => {
  const elapsed = Math.max(0, Math.trunc(number(months)))
  let balance = effectiveLoanAmount(loan)
  let remaining = Math.max(1, Math.round(number(loan.termMonths, 300)))
  let qualifyingBalance = loan.qualifyingFinanceBalance === '' || loan.qualifyingFinanceBalance == null
    ? null : Math.min(balance, positive(loan.qualifyingFinanceBalance))
  for (let month = 0; month < elapsed; month += 1) {
    if (balance > 0) {
      const current = loanFinancials({ ...loan, currentBalance: balance, termMonths: remaining }, rateShock)
      balance = Math.max(0, balance - current.principalPayment)
      if (qualifyingBalance !== null) qualifyingBalance = Math.max(0, Math.min(balance, qualifyingBalance - current.principalPayment))
    }
    remaining = Math.max(0, remaining - 1)
    for (const event of events) {
      if (event.loanId !== loan.id || Math.trunc(number(event.month)) !== month) continue
      const delta = number(event.loanDelta)
      const next = Math.max(0, balance + delta)
      if (qualifyingBalance !== null) qualifyingBalance = Math.min(next, qualifyingBalance + Math.min(0, delta))
      balance = next
    }
  }
  return {
    ...loan, currentBalance: balance, loanAmount: balance, termMonths: Math.max(1, remaining),
    ...(qualifyingBalance === null ? {} : { qualifyingFinanceBalance: qualifyingBalance }),
  }
}

export const projectPropertyLoans = (property, months = 0, rateShock = 0, events = []) => {
  const original = Array.isArray(property.financeLoans) ? property.financeLoans : []
  const elapsed = Math.max(0, Math.trunc(number(months)))
  const relevant = (Array.isArray(events) ? events : []).filter((event) =>
    String(event.propertyId || '') === String(property.id) && number(event.month) < elapsed)
  const projected = original.map((loan) => projectLoan(loan, elapsed, rateShock, relevant))
  const releases = relevant.filter((event) => !event.loanId && number(event.loanDelta) > 0)
  const extraLoans = releases.map((event, index) => {
    const releaseMonth = Math.max(0, Math.trunc(number(event.month)))
    const loan = {
      id: `projection-release:${event.id || index}`, propertyId: property.id,
      lender: 'Projected financing', principalAmount: positive(event.loanDelta),
      rate: number(event.rate, number(property.baseRate)), interestOnly: true,
      termMonths: 300, fixedRateMonths: 0, fixedStartDate: '',
      feeMode: 'amount', feeValue: 0, addFeeToLoan: false,
    }
    return projectLoan(loan, elapsed - releaseMonth - 1, rateShock)
  })
  const financeLoans = [...projected, ...extraLoans]
  return { ...applyLoansToProperty(property, financeLoans), financeLoans }
}
