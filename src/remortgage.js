import { loanFinancials } from './loans.js'

const makeId = () => globalThis.crypto?.randomUUID?.()
  || `remortgage-${Date.now()}-${Math.random().toString(16).slice(2)}`

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const nonNegative = (value) => Math.max(0, number(value))

export const roundedLtv = (value) => Math.round(nonNegative(value))

export const createRemortgageScenario = ({
  propertyValue = 0,
  loanAmount = 0,
  rate = 0,
  feeMode = 'percent',
  feeValue = 0,
  addFeeToLoan = false,
  loanBasis = 'loan',
  ...extra
} = {}) => {
  const value = nonNegative(propertyValue)
  const loan = nonNegative(loanAmount)
  return {
    ...extra,
    propertyValue: value,
    loanAmount: loan,
    ltv: value ? loan / value * 100 : 0,
    loanBasis,
    rate: nonNegative(rate),
    feeMode: feeMode === 'amount' ? 'amount' : 'percent',
    feeValue: nonNegative(feeValue),
    addFeeToLoan: Boolean(addFeeToLoan),
  }
}

export const createRemortgageComparison = (property = null) => {
  const propertyValue = nonNegative(property?.latestValuation)
  const loanAmount = nonNegative(property?.loanAmount)
  const hasCurrentRate = property?.currentRate !== '' && property?.currentRate != null
    && Number.isFinite(Number(property.currentRate))
  const rate = nonNegative(hasCurrentRate ? property.currentRate : property?.baseRate) * 100
  const scenario = createRemortgageScenario({ propertyValue, loanAmount, rate })
  return {
    id: makeId(),
    sourcePropertyId: property?.id || '',
    name: property?.name ? `${property.name} remortgage` : 'Manual remortgage',
    left: { ...scenario, ...(Array.isArray(property?.financeLoans) ? { currentLoans: property.financeLoans, financeScope: property.financeLoans.length > 1 ? 'whole-property' : 'single-loan' } : {}) },
    right: { ...scenario },
  }
}

export const duplicateRemortgageComparison = (comparison) => ({
  ...comparison,
  id: makeId(),
  name: `${comparison.name || 'Remortgage'} copy`,
  left: { ...comparison.left },
  right: { ...comparison.right },
})

export const updateRemortgageScenario = (scenario, key, rawValue) => {
  const current = createRemortgageScenario(scenario)
  if (key !== 'propertyValue') {
    delete current.currentLoans
    delete current.currentMonthlyInterest
    delete current.currentMonthlyPayment
    delete current.financeScope
  }

  if (key === 'addFeeToLoan') return { ...current, addFeeToLoan: Boolean(rawValue) }
  if (key === 'feeMode') return { ...current, feeMode: rawValue === 'amount' ? 'amount' : 'percent' }

  const value = nonNegative(rawValue)

  if (key === 'propertyValue') {
    const next = { ...current, propertyValue: value }
    if (current.loanBasis === 'ltv') next.loanAmount = value * current.ltv / 100
    else next.ltv = value ? current.loanAmount / value * 100 : 0
    return next
  }

  if (key === 'loanAmount') {
    return {
      ...current,
      loanAmount: value,
      ltv: current.propertyValue ? value / current.propertyValue * 100 : 0,
      loanBasis: 'loan',
    }
  }

  if (key === 'ltv') {
    return {
      ...current,
      ltv: value,
      loanAmount: current.propertyValue * value / 100,
      loanBasis: 'ltv',
    }
  }

  if (key === 'rate' || key === 'feeValue') return { ...current, [key]: value }
  return current
}

export const calculateRemortgageScenario = (scenario) => {
  const current = createRemortgageScenario(scenario)
  const fee = current.feeMode === 'amount' ? current.feeValue : current.loanAmount * current.feeValue / 100
  const financing = Array.isArray(current.currentLoans) ? current.currentLoans.map((loan) => loanFinancials(loan)) : []
  const actual = financing.length > 0
  const effectiveLoan = actual ? financing.reduce((sum, loan) => sum + loan.balance, 0)
    : current.loanAmount + (current.addFeeToLoan ? fee : 0)
  const resultingLtv = current.propertyValue ? effectiveLoan / current.propertyValue * 100 : 0
  const monthlyInterest = actual ? financing.reduce((sum, loan) => sum + loan.monthlyInterestCost, 0)
    : effectiveLoan * current.rate / 100 / 12
  const monthlyPayment = actual ? financing.reduce((sum, loan) => sum + loan.monthlyPayment, 0) : monthlyInterest
  return {
    ...current, fee, effectiveLoan, resultingLtv, monthlyInterest, monthlyPayment,
    annualInterest: monthlyInterest * 12,
    upfrontFee: current.addFeeToLoan ? 0 : fee,
    equity: current.propertyValue - effectiveLoan,
  }
}

export const compareRemortgageScenarios = (leftScenario, rightScenario) => {
  const left = calculateRemortgageScenario(leftScenario)
  const right = calculateRemortgageScenario(rightScenario)
  return {
    left,
    right,
    monthlyCashFlowChange: left.monthlyPayment - right.monthlyPayment,
    annualCashFlowChange: (left.monthlyPayment - right.monthlyPayment) * 12,
    loanChange: right.effectiveLoan - left.effectiveLoan,
    ltvChange: right.resultingLtv - left.resultingLtv,
    rateChange: right.rate - left.rate,
    feeChange: right.fee - left.fee,
    upfrontFeeChange: right.upfrontFee - left.upfrontFee,
    equityChange: right.equity - left.equity,
    equityRelease: left.equity - right.equity,
  }
}
