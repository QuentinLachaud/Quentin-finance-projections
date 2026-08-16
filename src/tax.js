// Current rates and rules are sourced from HMRC / Scottish Government guidance.
// Keep this module tax-year aware: projections can cross the 6 April boundary.
export const TAX_YEAR = '2026–27'
export const STANDARD_PERSONAL_ALLOWANCE = 12570
export const PERSONAL_ALLOWANCE_TAPER_START = 100000

export const INCOME_TAX_BANDS = {
  england: [
    { name: 'Basic', width: 37700, rate: 0.20 },
    { name: 'Higher', width: 87440, rate: 0.40 },
    { name: 'Additional', width: Infinity, rate: 0.45 },
  ],
  scotland: [
    { name: 'Starter', width: 3967, rate: 0.19 },
    { name: 'Basic', width: 12989, rate: 0.20 },
    { name: 'Intermediate', width: 14136, rate: 0.21 },
    { name: 'Higher', width: 31338, rate: 0.42 },
    { name: 'Advanced', width: 62710, rate: 0.45 },
    { name: 'Top', width: Infinity, rate: 0.48 },
  ],
}

const PROPERTY_BANDS_2027 = [
  { name: 'Property basic', width: 37700, rate: 0.22 },
  { name: 'Property higher', width: 87440, rate: 0.42 },
  { name: 'Property additional', width: Infinity, rate: 0.47 },
]

const taxYearStart = (date) => {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return 2026
  const year = value.getFullYear()
  const aprilSix = new Date(year, 3, 6, 12)
  return value >= aprilSix ? year : year - 1
}

export const taxYearForDate = (date = new Date()) => {
  const start = taxYearStart(date)
  const shortEnd = String((start + 1) % 100).padStart(2, '0')
  return `${start}–${shortEnd}`
}

export const personalAllowance = (grossIncome) => {
  const income = Math.max(0, Number(grossIncome || 0))
  const reduction = Math.max(0, income - PERSONAL_ALLOWANCE_TAPER_START) / 2
  return Math.max(0, STANDARD_PERSONAL_ALLOWANCE - reduction)
}

const taxAcrossBands = (amount, bands, startingTaxableIncome = 0) => {
  let remaining = Math.max(0, Number(amount || 0))
  let position = Math.max(0, Number(startingTaxableIncome || 0))
  let totalTax = 0
  const details = []

  for (const band of bands) {
    if (remaining <= 0) {
      details.push({ ...band, amount: 0, tax: 0 })
      continue
    }
    const alreadyUsed = Math.min(position, band.width)
    const capacity = band.width === Infinity ? Infinity : Math.max(0, band.width - alreadyUsed)
    const amountInBand = Math.min(remaining, capacity)
    const tax = amountInBand * band.rate
    totalTax += tax
    remaining -= amountInBand
    position = Math.max(0, position - band.width)
    details.push({ ...band, amount: amountInBand, tax })
  }

  return { totalTax, bands: details }
}

export function calculateIncomeTax(grossIncome, jurisdiction = 'england') {
  const income = Math.max(0, Number(grossIncome || 0))
  const region = jurisdiction === 'scotland' ? 'scotland' : 'england'
  const allowance = personalAllowance(income)
  const taxableIncome = Math.max(0, income - allowance)
  const result = taxAcrossBands(taxableIncome, INCOME_TAX_BANDS[region])
  const activeBand = [...result.bands].reverse().find((band) => band.amount > 0)

  return {
    jurisdiction: region,
    grossIncome: income,
    personalAllowance: allowance,
    taxableIncome,
    bands: result.bands,
    totalTax: result.totalTax,
    marginalRate: activeBand?.rate || 0,
  }
}

export function calculateCorporationTax({
  taxableProfit = 0,
  augmentedProfit = null,
  associatedCompanies = 0,
  accountingPeriodMonths = 12,
  closeInvestmentHoldingCompany = false,
} = {}) {
  const taxable = Math.max(0, Number(taxableProfit || 0))
  const augmented = Math.max(taxable, augmentedProfit == null ? taxable : Number(augmentedProfit || 0))
  const associates = Math.max(0, Math.floor(Number(associatedCompanies || 0)))
  const periodFraction = Math.min(1, Math.max(1 / 12, Number(accountingPeriodMonths || 12) / 12))
  const divisor = associates + 1
  const lowerLimit = 50000 * periodFraction / divisor
  const upperLimit = 250000 * periodFraction / divisor
  const mainRate = 0.25
  const smallProfitsRate = 0.19
  const marginalFraction = 3 / 200

  if (!taxable) {
    return { taxableProfit: 0, augmentedProfit: augmented, tax: 0, effectiveRate: 0, rateType: 'none', lowerLimit, upperLimit }
  }

  if (closeInvestmentHoldingCompany) {
    const tax = taxable * mainRate
    return { taxableProfit: taxable, augmentedProfit: augmented, tax, effectiveRate: mainRate, rateType: 'main-cihc', lowerLimit, upperLimit }
  }

  if (augmented <= lowerLimit) {
    const tax = taxable * smallProfitsRate
    return { taxableProfit: taxable, augmentedProfit: augmented, tax, effectiveRate: smallProfitsRate, rateType: 'small-profits', lowerLimit, upperLimit }
  }

  if (augmented >= upperLimit) {
    const tax = taxable * mainRate
    return { taxableProfit: taxable, augmentedProfit: augmented, tax, effectiveRate: mainRate, rateType: 'main', lowerLimit, upperLimit }
  }

  const marginalRelief = marginalFraction * (upperLimit - augmented) * (taxable / augmented)
  const tax = Math.max(0, taxable * mainRate - marginalRelief)
  return {
    taxableProfit: taxable,
    augmentedProfit: augmented,
    tax,
    effectiveRate: tax / taxable,
    rateType: 'marginal-relief',
    marginalRelief,
    lowerLimit,
    upperLimit,
  }
}

const calculate2027EnglandPropertyTax = (otherIncome, rentalProfit) => {
  const totalIncome = otherIncome + rentalProfit
  const allowance = personalAllowance(totalIncome)
  const allowanceAgainstOther = Math.min(otherIncome, allowance)
  const remainingAllowance = Math.max(0, allowance - allowanceAgainstOther)
  const taxableOther = Math.max(0, otherIncome - allowanceAgainstOther)
  const taxableProperty = Math.max(0, rentalProfit - remainingAllowance)
  const otherTax = taxAcrossBands(taxableOther, INCOME_TAX_BANDS.england)
  const propertyTax = taxAcrossBands(taxableProperty, PROPERTY_BANDS_2027, taxableOther)
  const activePropertyBand = [...propertyTax.bands].reverse().find((band) => band.amount > 0)
  return {
    totalTax: otherTax.totalTax + propertyTax.totalTax,
    personalAllowance: allowance,
    taxableIncome: taxableOther + taxableProperty,
    taxableOther,
    taxableProperty,
    marginalRate: activePropertyBand?.rate || [...otherTax.bands].reverse().find((band) => band.amount > 0)?.rate || 0,
  }
}

export function calculatePrivateLandlordTax({
  grossIncome = 0,
  propertyProfit = 0,
  financeCosts = 0,
  propertyLossBroughtForward = 0,
  financeCostsBroughtForward = 0,
  jurisdiction = 'england',
  taxYear = TAX_YEAR,
}) {
  const otherIncome = Math.max(0, Number(grossIncome || 0))
  const preLossPropertyProfit = Number(propertyProfit || 0)
  const lossBroughtForward = Math.max(0, Number(propertyLossBroughtForward || 0))
  const currentYearLoss = Math.max(0, -preLossPropertyProfit)
  const currentYearProfit = Math.max(0, preLossPropertyProfit)
  const propertyLossUsed = Math.min(currentYearProfit, lossBroughtForward)
  const rentalProfit = Math.max(0, currentYearProfit - propertyLossUsed)
  const propertyLossCarryForward = Math.max(0, lossBroughtForward - propertyLossUsed + currentYearLoss)

  const currentFinanceCosts = Math.max(0, Number(financeCosts || 0))
  const financeBroughtForward = Math.max(0, Number(financeCostsBroughtForward || 0))
  const relievableAmount = currentFinanceCosts + financeBroughtForward
  const region = jurisdiction === 'scotland' ? 'scotland' : 'england'
  const yearStart = Number(String(taxYear).slice(0, 4)) || 2026
  const uses2027PropertyRates = region === 'england' && yearStart >= 2027

  const baseline = calculateIncomeTax(otherIncome, region)
  let combined
  let futureRatesAssumed = false
  let policyNote = ''
  let financeReliefRate = 0.20

  if (uses2027PropertyRates) {
    combined = calculate2027EnglandPropertyTax(otherIncome, rentalProfit)
    financeReliefRate = 0.22
    if (yearStart > 2027) {
      futureRatesAssumed = true
      policyNote = 'Property-income rates after 2027–28 are not yet known in this model; the 2027–28 England/Wales/NI property rates are carried forward as a planning assumption.'
    }
  } else {
    combined = calculateIncomeTax(otherIncome + rentalProfit, region)
    if (region === 'scotland' && yearStart >= 2027) {
      futureRatesAssumed = true
      policyNote = 'Future Scottish property-income rates are not yet set in this model; current Scottish non-savings rates are carried forward as a planning assumption.'
    }
  }

  const adjustedProfit = rentalProfit
  const lowerOfFinanceAndProfit = Math.min(relievableAmount, adjustedProfit)
  const adjustedTotalIncome = Math.max(0, otherIncome + rentalProfit - combined.personalAllowance)
  const financeBaseBeforeTaxCap = Math.min(lowerOfFinanceAndProfit, adjustedTotalIncome)
  const maxFinanceBaseFromTaxLiability = financeReliefRate ? combined.totalTax / financeReliefRate : 0
  const relievedFinanceCosts = Math.min(financeBaseBeforeTaxCap, maxFinanceBaseFromTaxLiability)
  const financeCostTaxReduction = relievedFinanceCosts * financeReliefRate
  const financeCostsCarryForward = Math.max(0, relievableAmount - relievedFinanceCosts)
  const totalTaxAfterFinanceRelief = Math.max(0, combined.totalTax - financeCostTaxReduction)
  const incrementalTaxBeforeRelief = combined.totalTax - baseline.totalTax
  const propertyIncomeTax = totalTaxAfterFinanceRelief - baseline.totalTax

  return {
    taxYear,
    jurisdiction: region,
    grossIncome: otherIncome,
    propertyProfitBeforeLosses: preLossPropertyProfit,
    propertyProfit: rentalProfit,
    propertyLossBroughtForward: lossBroughtForward,
    propertyLossUsed,
    propertyLossCarryForward,
    financeCosts: currentFinanceCosts,
    financeCostsBroughtForward: financeBroughtForward,
    relievableAmount,
    relievedFinanceCosts,
    financeCostsCarryForward,
    personalAllowance: combined.personalAllowance,
    taxableIncome: combined.taxableIncome,
    marginalRate: combined.marginalRate,
    incomeTaxBeforeProperty: baseline.totalTax,
    incomeTaxWithProperty: combined.totalTax,
    totalTaxAfterFinanceRelief,
    incrementalTaxBeforeRelief,
    relievableFinanceCosts: relievedFinanceCosts,
    financeReliefRate,
    financeCostTaxReduction,
    propertyIncomeTax,
    futureRatesAssumed,
    policyNote,
  }
}
