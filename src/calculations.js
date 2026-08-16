import { calculatePrivateLandlordTax } from './tax.js'

const MS_YEAR = 365.2425 * 24 * 60 * 60 * 1000

export const addMonths = (dateString, months) => {
  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setMonth(date.getMonth() + Number(months || 0))
  return date
}

export const monthsBetween = (from, to) => {
  if (!to || Number.isNaN(to.getTime())) return 0
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth())
}

export const amortizingPayment = (principal, annualRate, months, dueAtStart = true) => {
  const value = Math.max(0, Number(principal || 0))
  const term = Math.max(1, Number(months || 1))
  const monthlyRate = Math.max(0, Number(annualRate || 0)) / 12
  if (!monthlyRate) return value / term
  const ordinaryPayment = value * monthlyRate / (1 - ((1 + monthlyRate) ** -term))
  return dueAtStart ? ordinaryPayment / (1 + monthlyRate) : ordinaryPayment
}

const hasMortgageOverride = (property) => property.mortgageOverride !== '' && property.mortgageOverride != null

export const mortgageInterestPayment = (property, settings) => {
  const loanAmount = Math.max(0, Number(property.loanAmount || 0))
  const currentRate = Math.max(0, Number(property.baseRate || 0) + Number(settings.rateShock || 0))
  const calculatedMortgage = loanAmount * currentRate / 12

  if (!hasMortgageOverride(property)) return calculatedMortgage

  const override = Number(property.mortgageOverride || 0)
  const anchorRate = property.mortgageOverrideRate == null
    ? Number(property.baseRate || 0)
    : Number(property.mortgageOverrideRate)
  const anchorLoanAmount = property.mortgageOverrideLoanAmount == null
    ? loanAmount
    : Math.max(0, Number(property.mortgageOverrideLoanAmount))
  const interestMovement = (loanAmount * currentRate - anchorLoanAmount * anchorRate) / 12

  return Math.max(0, override + interestMovement)
}

export const anchorMortgageOverride = (property, monthlyPayment, settings) => ({
  ...property,
  mortgageOverride: Number(monthlyPayment || 0),
  mortgageOverrideRate: Math.max(0, Number(property.baseRate || 0) + Number(settings.rateShock || 0)),
  mortgageOverrideLoanAmount: Math.max(0, Number(property.loanAmount || 0)),
})

export const migrateMortgageOverride = (property, settings) => {
  if (!hasMortgageOverride(property) || (property.mortgageOverrideRate != null && property.mortgageOverrideLoanAmount != null)) return property
  return anchorMortgageOverride(property, property.mortgageOverride, settings)
}

export function calculateProperty(property, settings, now = new Date()) {
  const currentRate = Number(property.baseRate) + Number(settings.rateShock)
  const calculatedMortgage = Number(property.loanAmount) * currentRate / 12
  const monthlyPayment = mortgageInterestPayment(property, settings)
  const nextRemortgage = addMonths(property.latestRemortgage, property.fixedRateMonths)
  const brokerDate = nextRemortgage ? addMonths(nextRemortgage.toISOString().slice(0, 10), -3) : null
  const monthsToRemortgage = monthsBetween(now, nextRemortgage)
  const expectedRemortgageValue = Number(property.latestValuation) * ((1 + Number(settings.appreciationRate)) ** (monthsToRemortgage / 12))
  const equity = Number(property.latestValuation) - Number(property.loanAmount)
  const mortgageAdmin = property.mortgageAdmin == null
    ? 13 / Math.max(1, Number(property.fixedRateMonths))
    : Number(property.mortgageAdmin)
  const fixedCosts = monthlyPayment + Number(property.factorsFees) + Number(property.legionella) + Number(property.gasCertificate) + Number(property.eicr) + mortgageAdmin
  const voids = property.voidsOverride === '' || property.voidsOverride == null
    ? Number(property.rent) / 12
    : Number(property.voidsOverride)
  const variableCosts = voids + Number(property.repairs) + Number(property.applianceReserve)
  const yearsOwned = property.purchaseDate ? Math.max(0, Math.floor((now - new Date(`${property.purchaseDate}T12:00:00`)) / MS_YEAR)) : 0

  return {
    ...property,
    currentRate,
    monthlyPayment,
    calculatedMortgage,
    mortgageAdmin,
    nextRemortgage,
    brokerDate,
    monthsToRemortgage,
    expectedRemortgageValue,
    expectedRemortgageLtv: expectedRemortgageValue ? Number(property.loanAmount) / expectedRemortgageValue : 0,
    equity,
    currentLtv: Number(property.latestValuation) ? Number(property.loanAmount) / Number(property.latestValuation) : 0,
    grossYield: Number(property.homeReportPurchase) ? Number(property.rent) * 12 / Number(property.homeReportPurchase) : 0,
    netYield: Number(property.homeReportPurchase) ? (Number(property.rent) - monthlyPayment - Number(property.factorsFees)) * 12 / Number(property.homeReportPurchase) : 0,
    appreciationAnnual: Number(property.homeReportPurchase) * Number(settings.appreciationRate),
    yearsOwned,
    releasableEquity: equity - Number(property.latestValuation) * 0.25,
    icr: monthlyPayment ? Number(property.rent) / monthlyPayment : 0,
    fixedCosts,
    voids,
    variableCosts,
  }
}

export function calculatePortfolio(properties, settings, now = new Date()) {
  const selected = properties.filter((property) => property.active).map((property) => calculateProperty(property, settings, now))
  const isCompany = settings.accountType !== 'private'
  const sum = (key) => selected.reduce((total, property) => total + Number(property[key] || 0), 0)
  const rent = sum('rent')
  const management = settings.fullyManaged ? rent * Number(settings.managementRate) : 0
  const enabledTotal = (items) => (Array.isArray(items) ? items : []).filter((item) => item.enabled !== false).reduce((total, item) => total + Number(item.amount || 0), 0)
  const companyCosts = isCompany ? enabledTotal(settings.companyCosts) : 0
  const extractionCosts = enabledTotal(settings.extractions)
  const propertyFixedCosts = sum('fixedCosts')
  const fixedCosts = propertyFixedCosts + companyCosts + management
  const variableCosts = sum('variableCosts')
  const extractionTotal = extractionCosts
  const appreciation = sum('latestValuation') * Number(settings.appreciationRate) / 12
  const financeCosts = sum('monthlyPayment')
  const nonFinancePropertyCosts = propertyFixedCosts - financeCosts
  const scenarioVariableCosts = [variableCosts, variableCosts - sum('voids'), 0]
  const scenarios = scenarioVariableCosts.map((scenarioVariables, index) => {
    const companyTaxable = rent - fixedCosts - scenarioVariables - extractionTotal
    const propertyProfit = rent - nonFinancePropertyCosts - management - scenarioVariables
    const privateTax = isCompany ? null : calculatePrivateLandlordTax({
      grossIncome: Number(settings.grossAnnualIncome || 0),
      propertyProfit: Math.max(0, propertyProfit * 12),
      financeCosts: financeCosts * 12,
      jurisdiction: settings.taxJurisdiction,
    })
    const taxable = isCompany ? companyTaxable : propertyProfit
    const tax = isCompany
      ? Math.max(0, taxable * Number(settings.corporationTaxRate))
      : privateTax.propertyIncomeTax / 12
    const cashBeforeTax = isCompany ? taxable + extractionTotal : rent - propertyFixedCosts - management - scenarioVariables
    const cashflow = cashBeforeTax - tax
    const totalGain = cashflow + appreciation
    return { id: index + 1, taxable, tax, cashflow, totalGain, privateTax }
  })
  const totalLoans = sum('loanAmount')
  const weightedRate = totalLoans ? selected.reduce((total, property) => total + property.currentRate * property.loanAmount, 0) / totalLoans : 0
  const safeCashNeeded = (fixedCosts + variableCosts) * Number(settings.bufferMonths)
  const conservativeBurn = scenarios[0]?.cashflow || 0

  return {
    selected,
    count: selected.length,
    rent,
    fixedCosts,
    propertyFixedCosts,
    companyCosts,
    management,
    variableCosts,
    financeCosts,
    nonFinancePropertyCosts,
    extractionTotal,
    appreciation,
    totalValue: sum('latestValuation'),
    totalLoans,
    totalEquity: sum('equity'),
    weightedRate,
    scenarios,
    safeCashNeeded,
    cashHeld: Number(settings.cashHeld),
    bufferMonths: fixedCosts + variableCosts ? Number(settings.cashHeld) / (fixedCosts + variableCosts) : 0,
    extraCashNeeded: Math.max(0, safeCashNeeded - Number(settings.cashHeld)),
    glideMonths: conservativeBurn < 0 ? Math.floor(Number(settings.cashHeld) / Math.abs(conservativeBurn)) : Infinity,
  }
}

export function projectPortfolio(properties, settings, months = settings.projectionMonths || 60, now = new Date()) {
  const portfolio = calculatePortfolio(properties, settings, now)
  const duration = Math.max(12, Number(months || 60))
  const monthlyAppreciationRate = ((1 + Number(settings.appreciationRate || 0)) ** (1 / 12)) - 1
  const accumulators = portfolio.scenarios.map(() => ({ cashPot: Number(settings.cashHeld || 0), cashflow: 0, totalGain: 0, appreciation: 0 }))

  return Array.from({ length: duration + 1 }, (_, month) => {
    if (month > 0) {
      const appreciation = portfolio.totalValue * monthlyAppreciationRate * ((1 + monthlyAppreciationRate) ** (month - 1))
      const expiringCompanyCosts = settings.accountType === 'private' ? 0 : (Array.isArray(settings.companyCosts) ? settings.companyCosts : [])
        .filter((item) => item.enabled !== false && Number(item.monthsRemaining || 0) > 0 && month > Number(item.monthsRemaining))
        .reduce((total, item) => total + Number(item.amount || 0), 0)
      portfolio.scenarios.forEach((scenario, index) => {
        const cashflow = scenario.cashflow + expiringCompanyCosts
        accumulators[index].cashPot += cashflow
        accumulators[index].cashflow += cashflow
        accumulators[index].appreciation += appreciation
        accumulators[index].totalGain += cashflow + appreciation
      })
    }
    const date = new Date(now.getFullYear(), now.getMonth() + month, 1)
    return { month, date, scenarios: accumulators.map((values) => ({ ...values })) }
  })
}

export const currency = (value, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: digits, minimumFractionDigits: digits,
}).format(Number(value || 0))

export const percent = (value, digits = 1) => `${(Number(value || 0) * 100).toFixed(digits)}%`

export const shortDate = (value) => {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
