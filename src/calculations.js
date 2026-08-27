import { calculateCorporationTax, calculatePrivateLandlordTax, taxYearForDate } from './tax.js'

const MS_YEAR = 365.2425 * 24 * 60 * 60 * 1000
const finiteNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const addMonths = (dateString, months) => {
  const source = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(source.getTime())) return null

  const target = new Date(source)
  const originalDay = source.getDate()
  target.setDate(1)
  target.setMonth(target.getMonth() + Math.trunc(finiteNumber(months)))
  const finalDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate()
  target.setDate(Math.min(originalDay, finalDay))
  return target
}

export const monthsBetween = (from, to) => {
  if (!(from instanceof Date) || Number.isNaN(from.getTime()) || !(to instanceof Date) || Number.isNaN(to.getTime())) return 0
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
  property = {
    ...property,
    loanAmount: finiteNumber(property?.loanAmount),
    latestValuation: finiteNumber(property?.latestValuation),
    homeReportPurchase: finiteNumber(property?.homeReportPurchase),
    rent: finiteNumber(property?.rent),
    baseRate: finiteNumber(property?.baseRate),
    factorsFees: finiteNumber(property?.factorsFees),
    legionella: finiteNumber(property?.legionella),
    gasCertificate: finiteNumber(property?.gasCertificate),
    eicr: finiteNumber(property?.eicr),
    repairs: finiteNumber(property?.repairs),
    applianceReserve: finiteNumber(property?.applianceReserve),
  }
  settings = {
    ...settings,
    rateShock: finiteNumber(settings?.rateShock),
    appreciationRate: finiteNumber(settings?.appreciationRate),
  }
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
  const purchaseDate = property.purchaseDate ? new Date(`${property.purchaseDate}T12:00:00`) : null
  const yearsOwned = purchaseDate && !Number.isNaN(purchaseDate.getTime())
    ? Math.max(0, Math.floor((now - purchaseDate) / MS_YEAR))
    : 0

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
const itemTotal = (items) => enabledItems(items).reduce((total, item) => total + finiteNumber(item.amount), 0)
const deductibleItemTotal = (items) => enabledItems(items)
  .filter((item) => item.taxDeductible === true)
  .reduce((total, item) => total + finiteNumber(item.amount), 0)

export function calculatePortfolio(properties, settings, now = new Date()) {
  const propertyList = Array.isArray(properties) ? properties : []
  settings = settings || {}
  const selected = propertyList.filter((property) => property?.active === true).map((property) => calculateProperty(property, settings, now))
  const isCompany = settings.accountType !== 'private'
  const sum = (key) => selected.reduce((total, property) => total + finiteNumber(property[key]), 0)
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
  const management = settings.fullyManaged ? rent * finiteNumber(settings.managementRate) : 0
  const fixedCosts = propertyFixedCosts + companyCosts + management
  const variableCosts = voids + problemBudget
  const appreciation = sum('latestValuation') * finiteNumber(settings.appreciationRate) / 12
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
      grossIncome: finiteNumber(settings.grossAnnualIncome),
      propertyProfit: propertyProfit * 12,
      financeCosts: (qualifyingFinanceCosts + deductibleFinanceAdmin) * 12,
      propertyLossBroughtForward: scenarioTaxState.propertyLossBroughtForward ?? finiteNumber(settings.propertyLossBroughtForward),
      financeCostsBroughtForward: scenarioTaxState.financeCostsBroughtForward ?? finiteNumber(settings.financeCostsBroughtForward),
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
    const accountingPeriodMonths = Math.min(12, Math.max(1, finiteNumber(settings.accountingPeriodMonths, 12)))
    const periodTaxableProfit = Math.max(0, companyTaxable * accountingPeriodMonths)
    const corporationTax = isCompany ? calculateCorporationTax({
      taxableProfit: periodTaxableProfit,
      augmentedProfit: periodTaxableProfit + Math.max(0, finiteNumber(settings.augmentedProfitDistributions)),
      associatedCompanies: finiteNumber(settings.associatedCompanies),
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
  const safeCashNeeded = (fixedCosts + variableCosts) * finiteNumber(settings.bufferMonths)
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
    cashHeld: finiteNumber(settings.cashHeld),
    bufferMonths: fixedCosts + variableCosts ? finiteNumber(settings.cashHeld) / (fixedCosts + variableCosts) : 0,
    extraCashNeeded: Math.max(0, safeCashNeeded - finiteNumber(settings.cashHeld)),
    glideMonths: conservativeBurn < 0 ? Math.floor(finiteNumber(settings.cashHeld) / Math.abs(conservativeBurn)) : Infinity,
    taxYear,
  }
}

const activeCompanyCostsForMonth = (items, month) => (Array.isArray(items) ? items : []).map((item) => {
  const monthsRemaining = finiteNumber(item.monthsRemaining)
  if (monthsRemaining <= 0 || month <= monthsRemaining) return item
  return { ...item, enabled: false }
})


export const projectedRentAtMonth = (rent, annualGrowthRate = 0, month = 0) => {
  const startingRent = Math.max(0, finiteNumber(rent))
  const annualRate = Math.max(-0.999999, finiteNumber(annualGrowthRate))
  const projectedMonth = Math.max(0, finiteNumber(month))
  return startingRent * ((1 + annualRate) ** (projectedMonth / 12))
}

export const propertiesWithProjectedRentGrowth = (properties = [], annualGrowthRate = 0, month = 0) =>
  (Array.isArray(properties) ? properties : []).map((property) => ({
    ...property,
    rent: projectedRentAtMonth(property?.rent, annualGrowthRate, month),
  }))

export const propertiesWithProjectedLoanEvents = (properties = [], loanEvents = [], month = 0) => {
  const currentMonth = Math.max(0, Math.trunc(finiteNumber(month)))
  const deltas = new Map()
  for (const event of Array.isArray(loanEvents) ? loanEvents : []) {
    const eventMonth = Math.max(0, Math.trunc(finiteNumber(event?.month)))
    if (eventMonth >= currentMonth) continue
    const propertyId = String(event?.propertyId ?? '')
    const loanDelta = Math.max(0, finiteNumber(event?.loanDelta))
    if (!propertyId || !loanDelta) continue
    deltas.set(propertyId, (deltas.get(propertyId) || 0) + loanDelta)
  }
  return (Array.isArray(properties) ? properties : []).map((property) => {
    const delta = deltas.get(String(property?.id ?? '')) || 0
    return delta ? { ...property, loanAmount: finiteNumber(property?.loanAmount) + delta } : property
  })
}

export function projectPortfolio(properties, settings, months = settings.projectionMonths || 60, now = new Date(), options = {}) {
  const loanEvents = Array.isArray(options?.loanEvents) ? options.loanEvents : []
  const baseProperties = propertiesWithProjectedLoanEvents(properties, loanEvents, 0)
  const basePortfolio = calculatePortfolio(baseProperties, settings, now)
  const duration = Math.max(12, Math.trunc(finiteNumber(months, 60)))
  const monthlyAppreciationRate = ((1 + finiteNumber(settings.appreciationRate)) ** (1 / 12)) - 1
  const accumulators = basePortfolio.scenarios.map(() => ({ cashPot: finiteNumber(settings.cashHeld), cashflow: 0, totalGain: 0, appreciation: 0 }))
  let privateTaxStates = basePortfolio.scenarios.map(() => ({
    propertyLossBroughtForward: finiteNumber(settings.propertyLossBroughtForward),
    financeCostsBroughtForward: finiteNumber(settings.financeCostsBroughtForward),
  }))
  let previousTaxYear = basePortfolio.taxYear
  let previousPortfolio = basePortfolio

  return Array.from({ length: duration + 1 }, (_, month) => {
    const date = new Date(now.getFullYear(), now.getMonth() + month, 6, 12)
    const currentTaxYear = taxYearForDate(date)

    if (month > 0 && settings.accountType === 'private' && currentTaxYear !== previousTaxYear) {
      privateTaxStates = previousPortfolio.scenarios.map((scenario) => ({
        propertyLossBroughtForward: finiteNumber(scenario.privateTax?.propertyLossCarryForward),
        financeCostsBroughtForward: finiteNumber(scenario.privateTax?.financeCostsCarryForward),
      }))
    }

    const projectedSettings = {
      ...settings,
      companyCosts: activeCompanyCostsForMonth(settings.companyCosts, month),
      privateTaxStates,
    }
    const projectedProperties = propertiesWithProjectedRentGrowth(
      propertiesWithProjectedLoanEvents(properties, loanEvents, month),
      settings.rentGrowthRate,
      month,
    )
    const monthlyPortfolio = month === 0 ? basePortfolio : calculatePortfolio(projectedProperties, projectedSettings, date)

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
    return { month, date, taxYear: currentTaxYear, rent: monthlyPortfolio.rent, scenarios: accumulators.map((values) => ({ ...values })) }
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
