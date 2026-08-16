import { calculateCorporationTax, calculatePrivateLandlordTax, taxYearForDate } from './tax.js'

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

export const mortgageInterestPayment = (property, settings) => {
  const loanAmount = Math.max(0, Number(property.loanAmount || 0))
  const currentRate = Math.max(0, Number(property.baseRate || 0) + Number(settings.rateShock || 0))
  return loanAmount * currentRate / 12
}

const qualifyingFinancePayment = (property, settings) => {
  const loanAmount = Math.max(0, Number(property.loanAmount || 0))
  const rawQualifyingBalance = property.qualifyingFinanceBalance
  const qualifyingBalance = rawQualifyingBalance === '' || rawQualifyingBalance == null
    ? loanAmount
    : Math.min(loanAmount, Math.max(0, Number(rawQualifyingBalance || 0)))
  const currentRate = Math.max(0, Number(property.baseRate || 0) + Number(settings.rateShock || 0))
  return qualifyingBalance * currentRate / 12
}

export function calculateProperty(property, settings, now = new Date()) {
  const currentRate = Math.max(0, Number(property.baseRate || 0) + Number(settings.rateShock || 0))
  const calculatedMortgage = Math.max(0, Number(property.loanAmount || 0)) * currentRate / 12
  const monthlyPayment = mortgageInterestPayment(property, settings)
  const qualifyingFinanceCost = qualifyingFinancePayment(property, settings)
  const nextRemortgage = addMonths(property.latestRemortgage, property.fixedRateMonths)
  const brokerDate = nextRemortgage ? addMonths(nextRemortgage.toISOString().slice(0, 10), -3) : null
  const monthsToRemortgage = monthsBetween(now, nextRemortgage)
  const expectedRemortgageValue = Number(property.latestValuation) * ((1 + Number(settings.appreciationRate)) ** (monthsToRemortgage / 12))
  const equity = Number(property.latestValuation) - Number(property.loanAmount)
  const mortgageAdmin = property.mortgageAdmin == null
    ? 13 / Math.max(1, Number(property.fixedRateMonths))
    : Number(property.mortgageAdmin)
  const complianceBudget = Number(property.legionella) + Number(property.gasCertificate) + Number(property.eicr)
  const financeAdminBudget = mortgageAdmin
  const problemBudget = Number(property.repairs) + Number(property.applianceReserve)
  const fixedCosts = monthlyPayment + Number(property.factorsFees) + complianceBudget + financeAdminBudget
  const voids = property.voidsOverride === '' || property.voidsOverride == null
    ? Number(property.rent) / 12
    : Number(property.voidsOverride)
  const variableCosts = voids + problemBudget
  const yearsOwned = property.purchaseDate ? Math.max(0, Math.floor((now - new Date(`${property.purchaseDate}T12:00:00`)) / MS_YEAR)) : 0

  return {
    ...property,
    currentRate,
    monthlyPayment,
    qualifyingFinanceCost,
    calculatedMortgage,
    mortgageAdmin,
    complianceBudget,
    financeAdminBudget,
    problemBudget,
    nextRemortgage,
    brokerDate,
    monthsToRemortgage,
    expectedRemortgageValue,
    expectedRemortgageLtv: expectedRemortgageValue ? Number(property.loanAmount) / expectedRemortgageValue : 0,
    equity,
    currentLtv: Number(property.latestValuation) ? Number(property.loanAmount) / Number(property.latestValuation) : 0,
    grossYield: Number(property.homeReportPurchase) ? Number(property.rent) * 12 / Number(property.homeReportPurchase) : 0,
    netYield: Number(property.homeReportPurchase) ? (Number(property.rent) - monthlyPayment - Number(property.factorsFees)) * 12 / Number(property.homeReportPurchase) : 0,
    appreciationAnnual: Number(property.latestValuation) * Number(settings.appreciationRate),
    yearsOwned,
    releasableEquity: equity - Number(property.latestValuation) * 0.25,
    icr: monthlyPayment ? Number(property.rent) / monthlyPayment : 0,
    fixedCosts,
    voids,
    variableCosts,
  }
}

const enabledItems = (items) => (Array.isArray(items) ? items : []).filter((item) => item.enabled !== false)
const itemTotal = (items) => enabledItems(items).reduce((total, item) => total + Number(item.amount || 0), 0)
const deductibleItemTotal = (items) => enabledItems(items)
  .filter((item) => item.taxDeductible === true)
  .reduce((total, item) => total + Number(item.amount || 0), 0)

export function calculatePortfolio(properties, settings, now = new Date()) {
  const selected = properties.filter((property) => property.active).map((property) => calculateProperty(property, settings, now))
  const isCompany = settings.accountType !== 'private'
  const sum = (key) => selected.reduce((total, property) => total + Number(property[key] || 0), 0)
  const rent = sum('rent')
  const companyCosts = isCompany ? itemTotal(settings.companyCosts) : 0
  const deductibleCompanyCosts = isCompany ? deductibleItemTotal(settings.companyCosts) : 0
  const extractionTotal = isCompany ? itemTotal(settings.extractions) : 0
  const deductibleExtractions = isCompany ? deductibleItemTotal(settings.extractions) : 0
  const financeCosts = sum('monthlyPayment')
  const qualifyingFinanceCosts = sum('qualifyingFinanceCost')
  const factorsCosts = sum('factorsFees')
  const complianceBudget = sum('complianceBudget')
  const financeAdminBudget = sum('financeAdminBudget')
  const problemBudget = sum('problemBudget')
  const voids = sum('voids')
  const propertyFixedCosts = financeCosts + factorsCosts + complianceBudget + financeAdminBudget
  const management = settings.fullyManaged ? rent * Number(settings.managementRate) : 0
  const fixedCosts = propertyFixedCosts + companyCosts + management
  const variableCosts = voids + problemBudget
  const appreciation = sum('latestValuation') * Number(settings.appreciationRate) / 12
  const budgetTaxDeductible = Boolean(settings.budgetedPropertyCostsTaxDeductible)
  const taxYear = taxYearForDate(now)

  const scenarioInputs = [
    { voidLoss: voids, problemBudget },
    { voidLoss: 0, problemBudget },
    { voidLoss: 0, problemBudget: 0 },
  ]

  const scenarios = scenarioInputs.map(({ voidLoss, problemBudget: scenarioProblemBudget }, index) => {
    const collectedRent = Math.max(0, rent - voidLoss)
    const scenarioManagement = settings.fullyManaged ? collectedRent * Number(settings.managementRate) : 0
    const deductiblePropertyBudgets = budgetTaxDeductible ? complianceBudget + scenarioProblemBudget : 0
    const deductibleFinanceAdmin = budgetTaxDeductible ? financeAdminBudget : 0
    const propertyProfit = collectedRent - factorsCosts - scenarioManagement - deductiblePropertyBudgets
    const scenarioTaxState = settings.privateTaxStates?.[index] || {}
    const privateTax = isCompany ? null : calculatePrivateLandlordTax({
      grossIncome: Number(settings.grossAnnualIncome || 0),
      propertyProfit: propertyProfit * 12,
      financeCosts: (qualifyingFinanceCosts + deductibleFinanceAdmin) * 12,
      propertyLossBroughtForward: scenarioTaxState.propertyLossBroughtForward ?? Number(settings.propertyLossBroughtForward || 0),
      financeCostsBroughtForward: scenarioTaxState.financeCostsBroughtForward ?? Number(settings.financeCostsBroughtForward || 0),
      jurisdiction: settings.taxJurisdiction,
      taxYear,
    })

    const companyTaxable = collectedRent
      - financeCosts
      - factorsCosts
      - scenarioManagement
      - deductiblePropertyBudgets
      - deductibleFinanceAdmin
      - deductibleCompanyCosts
      - deductibleExtractions
    const taxable = isCompany ? companyTaxable : propertyProfit
    const accountingPeriodMonths = Math.min(12, Math.max(1, Number(settings.accountingPeriodMonths || 12)))
    const periodTaxableProfit = Math.max(0, companyTaxable * accountingPeriodMonths)
    const corporationTax = isCompany ? calculateCorporationTax({
      taxableProfit: periodTaxableProfit,
      augmentedProfit: periodTaxableProfit + Math.max(0, Number(settings.augmentedProfitDistributions || 0)),
      associatedCompanies: Number(settings.associatedCompanies || 0),
      accountingPeriodMonths,
      closeInvestmentHoldingCompany: Boolean(settings.closeInvestmentHoldingCompany),
    }) : null
    const tax = isCompany ? corporationTax.tax / accountingPeriodMonths : privateTax.propertyIncomeTax / 12

    const bankCashBeforeTax = collectedRent
      - propertyFixedCosts
      - scenarioManagement
      - scenarioProblemBudget
      - companyCosts
      - extractionTotal
    const bankCashflow = bankCashBeforeTax - tax
    const cashflow = isCompany ? bankCashflow + extractionTotal : bankCashflow
    const totalGain = cashflow + appreciation

    return {
      id: index + 1,
      collectedRent,
      voidLoss,
      management: scenarioManagement,
      problemBudget: scenarioProblemBudget,
      taxable,
      tax,
      bankCashflow,
      cashflow,
      totalGain,
      privateTax,
      corporationTax,
    }
  })

  const totalLoans = sum('loanAmount')
  const weightedRate = totalLoans ? selected.reduce((total, property) => total + property.currentRate * property.loanAmount, 0) / totalLoans : 0
  const safeCashNeeded = (fixedCosts + variableCosts) * Number(settings.bufferMonths)
  const conservativeBurn = scenarios[0]?.bankCashflow || 0

  return {
    selected,
    count: selected.length,
    rent,
    fixedCosts,
    propertyFixedCosts,
    companyCosts,
    deductibleCompanyCosts,
    management,
    variableCosts,
    voids,
    problemBudget,
    complianceBudget,
    financeAdminBudget,
    factorsCosts,
    financeCosts,
    qualifyingFinanceCosts,
    nonFinancePropertyCosts: factorsCosts + complianceBudget,
    extractionTotal,
    deductibleExtractions,
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
    taxYear,
  }
}

const activeCompanyCostsForMonth = (items, month) => (Array.isArray(items) ? items : []).map((item) => {
  const monthsRemaining = Number(item.monthsRemaining || 0)
  if (monthsRemaining <= 0 || month <= monthsRemaining) return item
  return { ...item, enabled: false }
})

export function projectPortfolio(properties, settings, months = settings.projectionMonths || 60, now = new Date()) {
  const basePortfolio = calculatePortfolio(properties, settings, now)
  const duration = Math.max(12, Number(months || 60))
  const monthlyAppreciationRate = ((1 + Number(settings.appreciationRate || 0)) ** (1 / 12)) - 1
  const accumulators = basePortfolio.scenarios.map(() => ({ cashPot: Number(settings.cashHeld || 0), cashflow: 0, totalGain: 0, appreciation: 0 }))
  let privateTaxStates = basePortfolio.scenarios.map(() => ({
    propertyLossBroughtForward: Number(settings.propertyLossBroughtForward || 0),
    financeCostsBroughtForward: Number(settings.financeCostsBroughtForward || 0),
  }))
  let previousTaxYear = basePortfolio.taxYear
  let previousPortfolio = basePortfolio

  return Array.from({ length: duration + 1 }, (_, month) => {
    const date = new Date(now.getFullYear(), now.getMonth() + month, 6, 12)
    const currentTaxYear = taxYearForDate(date)

    if (month > 0 && settings.accountType === 'private' && currentTaxYear !== previousTaxYear) {
      privateTaxStates = previousPortfolio.scenarios.map((scenario) => ({
        propertyLossBroughtForward: Number(scenario.privateTax?.propertyLossCarryForward || 0),
        financeCostsBroughtForward: Number(scenario.privateTax?.financeCostsCarryForward || 0),
      }))
    }

    const projectedSettings = {
      ...settings,
      companyCosts: activeCompanyCostsForMonth(settings.companyCosts, month),
      privateTaxStates,
    }
    const monthlyPortfolio = month === 0 ? basePortfolio : calculatePortfolio(properties, projectedSettings, date)

    if (month > 0) {
      const appreciation = basePortfolio.totalValue * monthlyAppreciationRate * ((1 + monthlyAppreciationRate) ** (month - 1))
      monthlyPortfolio.scenarios.forEach((scenario, index) => {
        accumulators[index].cashPot += scenario.bankCashflow
        accumulators[index].cashflow += scenario.cashflow
        accumulators[index].appreciation += appreciation
        accumulators[index].totalGain += scenario.cashflow + appreciation
      })
    }

    previousTaxYear = currentTaxYear
    previousPortfolio = monthlyPortfolio
    return { month, date, taxYear: currentTaxYear, scenarios: accumulators.map((values) => ({ ...values })) }
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
