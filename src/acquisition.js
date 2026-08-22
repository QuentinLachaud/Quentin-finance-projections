// Acquisition tax assumptions verified 2026-08-22 against official sources.
//
// Scotland residential LBTT:
// https://revenue.scot/taxes/land-buildings-transaction-tax/lbtt-legislation-guidance/residentialnon-residential-technical-guidance/lbtt4010-residential-transactions
// Additional Dwelling Supplement: 8% for transactions on/after 5 Dec 2024:
// https://revenue.scot/taxes/land-buildings-transaction-tax/additional-dwelling-supplement-ads
//
// England & Northern Ireland higher-rate residential SDLT from 1 Apr 2025:
// https://www.gov.uk/guidance/stamp-duty-land-tax-buying-an-additional-residential-property
//
// Wales higher residential LTT from 11 Dec 2024:
// https://www.gov.wales/land-transaction-tax-rates-and-bands

const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const progressiveTax = (price, bands) => {
  const value = Math.max(0, finite(price))
  let tax = 0
  let lower = 0

  for (const [upper, rate] of bands) {
    if (value <= lower) break
    const taxable = Math.min(value, upper) - lower
    tax += Math.max(0, taxable) * rate
    lower = upper
  }

  return tax
}

export const SCOTLAND_LBTT_BANDS = [
  [145000, 0],
  [250000, 0.02],
  [325000, 0.05],
  [750000, 0.10],
  [Infinity, 0.12],
]

export const ENGLAND_NI_ADDITIONAL_SDLT_BANDS = [
  [125000, 0.05],
  [250000, 0.07],
  [925000, 0.10],
  [1500000, 0.15],
  [Infinity, 0.17],
]

export const WALES_HIGHER_LTT_BANDS = [
  [180000, 0.05],
  [250000, 0.085],
  [400000, 0.10],
  [750000, 0.125],
  [1500000, 0.15],
  [Infinity, 0.17],
]

export const acquisitionJurisdictions = [
  { id: 'scotland', label: 'Scotland · LBTT + ADS' },
  { id: 'england-ni', label: 'England / Northern Ireland · SDLT' },
  { id: 'wales', label: 'Wales · LTT' },
]

export const createAcquisition = (values = {}, defaultJurisdiction = 'england-ni') => ({
  id: values.id || crypto.randomUUID(),
  sourceUrl: values.sourceUrl || '',
  sourceProvider: values.sourceProvider || '',
  purchasePrice: values.purchasePrice ?? '',
  expectedMonthlyRent: values.expectedMonthlyRent ?? '',
  address: values.address || '',
  postcode: values.postcode || '',
  bedrooms: values.bedrooms ?? '',
  areaSqm: values.areaSqm ?? '',
  propertyType: values.propertyType || '',
  epc: values.epc || '',
  jurisdiction: values.jurisdiction || defaultJurisdiction,
  ltv: values.ltv ?? 75,
  adsRate: values.adsRate ?? 8,
  legalFees: values.legalFees ?? 1500,
  mortgageFee: values.mortgageFee ?? 0,
  mortgageFeeAddedToLoan: values.mortgageFeeAddedToLoan ?? true,
  createdAt: values.createdAt || new Date().toISOString(),
})

export const acquisitionCosts = (acquisition) => {
  const price = Math.max(0, finite(acquisition?.purchasePrice))
  const ltv = Math.min(100, Math.max(0, finite(acquisition?.ltv, 75)))
  const legalFees = Math.max(0, finite(acquisition?.legalFees, 1500))
  const mortgageFee = Math.max(0, finite(acquisition?.mortgageFee))
  const mortgageFeeAddedToLoan = acquisition?.mortgageFeeAddedToLoan !== false
  const jurisdiction = acquisition?.jurisdiction || 'england-ni'

  const baseMortgage = price * ltv / 100
  const deposit = Math.max(0, price - baseMortgage)

  let baseTax = 0
  let supplement = 0
  let taxLabel = 'SDLT'

  if (jurisdiction === 'scotland') {
    baseTax = progressiveTax(price, SCOTLAND_LBTT_BANDS)
    supplement = price * Math.max(0, finite(acquisition?.adsRate, 8)) / 100
    taxLabel = 'LBTT + ADS'
  } else if (jurisdiction === 'wales') {
    baseTax = progressiveTax(price, WALES_HIGHER_LTT_BANDS)
    taxLabel = 'LTT'
  } else {
    baseTax = progressiveTax(price, ENGLAND_NI_ADDITIONAL_SDLT_BANDS)
    taxLabel = 'SDLT'
  }

  const transactionTax = baseTax + supplement
  const upfrontMortgageFee = mortgageFeeAddedToLoan ? 0 : mortgageFee
  const effectiveMortgage = baseMortgage + (mortgageFeeAddedToLoan ? mortgageFee : 0)
  const cashRequired = deposit + transactionTax + legalFees + upfrontMortgageFee
  const totalAcquisitionCost = price + transactionTax + legalFees + mortgageFee
  const expectedMonthlyRent = Math.max(0, finite(acquisition?.expectedMonthlyRent))
  const grossYield = price > 0 ? expectedMonthlyRent * 12 / price : 0

  return {
    price,
    ltv,
    baseMortgage,
    effectiveMortgage,
    deposit,
    baseTax,
    supplement,
    transactionTax,
    taxLabel,
    legalFees,
    mortgageFee,
    upfrontMortgageFee,
    cashRequired,
    totalAcquisitionCost,
    grossYield,
  }
}

export const prependAcquisition = (acquisitions, acquisition) => [
  acquisition,
  ...(Array.isArray(acquisitions) ? acquisitions : []),
]

