// Official 2026–27 thresholds:
// https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
// https://www.gov.scot/publications/scottish-income-tax-rates-and-bands/pages/2026-to-2027/
// Residential finance-cost restriction:
// https://www.gov.uk/hmrc-internal-manuals/property-income-manual/pim2058
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

export const personalAllowance = (grossIncome) => {
  const income = Math.max(0, Number(grossIncome || 0))
  const reduction = Math.max(0, income - PERSONAL_ALLOWANCE_TAPER_START) / 2
  return Math.max(0, STANDARD_PERSONAL_ALLOWANCE - reduction)
}

export function calculateIncomeTax(grossIncome, jurisdiction = 'england') {
  const income = Math.max(0, Number(grossIncome || 0))
  const region = jurisdiction === 'scotland' ? 'scotland' : 'england'
  const allowance = personalAllowance(income)
  const taxableIncome = Math.max(0, income - allowance)
  let remaining = taxableIncome
  let totalTax = 0
  const bands = INCOME_TAX_BANDS[region].map((band) => {
    const amount = Math.min(remaining, band.width)
    const tax = amount * band.rate
    remaining -= amount
    totalTax += tax
    return { ...band, amount, tax }
  })
  const activeBand = [...bands].reverse().find((band) => band.amount > 0)

  return {
    jurisdiction: region,
    grossIncome: income,
    personalAllowance: allowance,
    taxableIncome,
    bands,
    totalTax,
    marginalRate: activeBand?.rate || 0,
  }
}

export function calculatePrivateLandlordTax({
  grossIncome = 0,
  propertyProfit = 0,
  financeCosts = 0,
  jurisdiction = 'england',
}) {
  const otherIncome = Math.max(0, Number(grossIncome || 0))
  const rentalProfit = Math.max(0, Number(propertyProfit || 0))
  const mortgageFinanceCosts = Math.max(0, Number(financeCosts || 0))
  const combined = calculateIncomeTax(otherIncome + rentalProfit, jurisdiction)
  const baseline = calculateIncomeTax(otherIncome, jurisdiction)
  const adjustedIncomeAboveAllowance = Math.max(0, combined.grossIncome - combined.personalAllowance)
  const relievableFinanceCosts = Math.min(mortgageFinanceCosts, rentalProfit, adjustedIncomeAboveAllowance)
  const financeCostTaxReduction = Math.min(combined.totalTax, relievableFinanceCosts * 0.20)
  const incrementalTaxBeforeRelief = Math.max(0, combined.totalTax - baseline.totalTax)
  const propertyIncomeTax = Math.max(0, incrementalTaxBeforeRelief - financeCostTaxReduction)

  return {
    taxYear: TAX_YEAR,
    jurisdiction: combined.jurisdiction,
    grossIncome: otherIncome,
    propertyProfit: rentalProfit,
    financeCosts: mortgageFinanceCosts,
    personalAllowance: combined.personalAllowance,
    taxableIncome: combined.taxableIncome,
    marginalRate: combined.marginalRate,
    incomeTaxBeforeProperty: baseline.totalTax,
    incomeTaxWithProperty: combined.totalTax,
    incrementalTaxBeforeRelief,
    relievableFinanceCosts,
    financeCostTaxReduction,
    propertyIncomeTax,
  }
}
