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
} = {}) => {
  const value = nonNegative(propertyValue)
  const loan = nonNegative(loanAmount)
  return {
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
  const rate = nonNegative(property?.baseRate) * 100
  const scenario = createRemortgageScenario({ propertyValue, loanAmount, rate })
  return {
    id: makeId(),
    sourcePropertyId: property?.id || '',
    name: property?.name ? `${property.name} remortgage` : 'Manual remortgage',
    left: { ...scenario },
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
  const fee = current.feeMode === 'amount'
    ? current.feeValue
    : current.loanAmount * current.feeValue / 100
  const effectiveLoan = current.loanAmount + (current.addFeeToLoan ? fee : 0)
  const resultingLtv = current.propertyValue ? effectiveLoan / current.propertyValue * 100 : 0
  const monthlyInterest = effectiveLoan * current.rate / 100 / 12
  return {
    ...current,
    fee,
    effectiveLoan,
    resultingLtv,
    monthlyInterest,
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
    monthlyCashFlowChange: left.monthlyInterest - right.monthlyInterest,
    annualCashFlowChange: (left.monthlyInterest - right.monthlyInterest) * 12,
    loanChange: right.effectiveLoan - left.effectiveLoan,
    ltvChange: right.resultingLtv - left.resultingLtv,
    rateChange: right.rate - left.rate,
    feeChange: right.fee - left.fee,
    upfrontFeeChange: right.upfrontFee - left.upfrontFee,
    equityChange: right.equity - left.equity,
    equityRelease: left.equity - right.equity,
  }
}
