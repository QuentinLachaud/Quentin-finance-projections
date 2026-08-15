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

export function calculateProperty(property, settings, now = new Date()) {
  const currentRate = Number(property.baseRate) + Number(settings.rateShock)
  const monthlyPayment = Number(property.loanAmount) * currentRate / 12
  const nextRemortgage = addMonths(property.latestRemortgage, property.fixedRateMonths)
  const brokerDate = nextRemortgage ? addMonths(nextRemortgage.toISOString().slice(0, 10), -3) : null
  const monthsToRemortgage = monthsBetween(now, nextRemortgage)
  const expectedRemortgageValue = Number(property.latestValuation) * ((1 + Number(settings.appreciationRate)) ** (monthsToRemortgage / 12))
  const equity = Number(property.latestValuation) - Number(property.loanAmount)
  const fixedCosts = monthlyPayment + Number(property.factorsFees) + Number(property.legionella) + Number(property.gasCertificate) + Number(property.eicr) + (13 / Math.max(1, Number(property.fixedRateMonths)))
  const voids = Number(property.rent) / 12
  const variableCosts = voids + Number(property.repairs) + Number(property.applianceReserve)
  const yearsOwned = property.purchaseDate ? Math.max(0, Math.floor((now - new Date(`${property.purchaseDate}T12:00:00`)) / MS_YEAR)) : 0

  return {
    ...property,
    currentRate,
    monthlyPayment,
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
  const sum = (key) => selected.reduce((total, property) => total + Number(property[key] || 0), 0)
  const rent = sum('rent')
  const management = settings.fullyManaged ? rent * Number(settings.managementRate) : 0
  const companyFixed = 34 / 12 + 47 / 12 + 70.8 / 12
  const fixedCosts = sum('fixedCosts') + companyFixed + management
  const variableCosts = sum('variableCosts')
  const engineeredCosts = settings.extraction ? sum('engineeredCost') : 0
  const appreciation = sum('latestValuation') * Number(settings.appreciationRate) / 12
  const taxableAll = rent - fixedCosts - variableCosts - engineeredCosts
  const taxableNoVoids = taxableAll + sum('voids')
  const taxableNoProblems = rent - fixedCosts - engineeredCosts
  const scenarios = [taxableAll, taxableNoVoids, taxableNoProblems].map((taxable, index) => {
    const tax = Math.max(0, taxable * Number(settings.corporationTaxRate))
    const cashflow = taxable + engineeredCosts - tax
    const totalGain = cashflow + appreciation
    return { id: index + 1, taxable, tax, cashflow, totalGain }
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
    variableCosts,
    engineeredCosts,
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

export const currency = (value, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: digits, minimumFractionDigits: digits,
}).format(Number(value || 0))

export const percent = (value, digits = 1) => `${(Number(value || 0) * 100).toFixed(digits)}%`

export const shortDate = (value) => {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
