const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

const progressiveTax = (price, bands) => {
  const value = Math.max(0, finite(price))
  let tax = 0
  let lower = 0
  for (const [upper, rate] of bands) {
    if (value <= lower) break
    tax += Math.max(0, Math.min(value, upper) - lower) * rate
    lower = upper
  }
  return tax
}

export const SCOTLAND_LBTT_BANDS = [[145000,0],[250000,.02],[325000,.05],[750000,.10],[Infinity,.12]]
export const ENGLAND_NI_ADDITIONAL_SDLT_BANDS = [[125000,.05],[250000,.07],[925000,.10],[1500000,.15],[Infinity,.17]]
export const WALES_HIGHER_LTT_BANDS = [[180000,.05],[250000,.085],[400000,.10],[750000,.125],[1500000,.15],[Infinity,.17]]

export const acquisitionJurisdictions = [
  { id: 'scotland', label: 'Scotland · LBTT + ADS' },
  { id: 'england-ni', label: 'England / Northern Ireland · SDLT' },
  { id: 'wales', label: 'Wales · LTT' },
]

export const normalizeAcquisitionAssumptions = (source = {}) => {
  const requestedJurisdiction = String(source?.jurisdiction || 'england-ni')
  const jurisdiction = acquisitionJurisdictions.some((item) => item.id === requestedJurisdiction)
    ? requestedJurisdiction
    : 'england-ni'
  return {
    jurisdiction,
    ltv: clamp(finite(source?.ltv, 75), 0, 100),
    adsRate: Math.max(0, finite(source?.adsRate, 8)),
    legalFees: Math.max(0, finite(source?.legalFees, 1500)),
    mortgageFee: Math.max(0, finite(source?.mortgageFee, 0)),
    mortgageFeeAddedToLoan: source?.mortgageFeeAddedToLoan !== false,
  }
}

export const acquisitionCosts = (acquisition = {}) => {
  const price = Math.max(0, finite(acquisition?.purchasePrice))
  const assumptions = normalizeAcquisitionAssumptions(acquisition)
  const { jurisdiction, ltv, adsRate, legalFees, mortgageFee, mortgageFeeAddedToLoan } = assumptions
  const upfrontMortgageFee = mortgageFeeAddedToLoan ? 0 : mortgageFee
  const deposit = Math.max(0, price - price * ltv / 100)
  let baseTax = 0
  let supplement = 0
  let taxLabel = 'SDLT'

  if (jurisdiction === 'scotland') {
    baseTax = progressiveTax(price, SCOTLAND_LBTT_BANDS)
    supplement = price * adsRate / 100
    taxLabel = 'LBTT'
  } else if (jurisdiction === 'wales') {
    baseTax = progressiveTax(price, WALES_HIGHER_LTT_BANDS)
    taxLabel = 'LTT'
  } else {
    baseTax = progressiveTax(price, ENGLAND_NI_ADDITIONAL_SDLT_BANDS)
  }

  const expectedMonthlyRent = Math.max(0, finite(acquisition?.expectedMonthlyRent))
  return {
    price,
    ltv,
    deposit,
    baseTax,
    supplement,
    taxLabel,
    legalFees,
    upfrontMortgageFee,
    transactionTax: baseTax + supplement,
    cashRequired: deposit + baseTax + supplement + legalFees + upfrontMortgageFee,
    grossYield: price > 0 ? expectedMonthlyRent * 12 / price : 0,
  }
}

export const maxAffordablePurchasePrice = (availableCash, assumptions = {}, options = {}) => {
  const cash = Math.max(0, finite(availableCash))
  const normalized = normalizeAcquisitionAssumptions(assumptions)
  const maxPrice = Math.max(0, finite(options.maxPrice, 100_000_000))
  const precision = Math.max(0.01, finite(options.precision, 0.01))
  const maxIterations = Math.max(8, Math.trunc(finite(options.maxIterations, 96)))

  const costAt = (purchasePrice) => acquisitionCosts({ ...normalized, purchasePrice }).cashRequired
  if (maxPrice <= 0 || costAt(0) > cash + 1e-9) return 0

  let low = 0
  let high = Math.min(maxPrice, 1000)
  while (high < maxPrice && costAt(high) <= cash + 1e-9) {
    low = high
    high = Math.min(maxPrice, Math.max(high * 2, high + 1000))
  }

  if (high >= maxPrice && costAt(maxPrice) <= cash + 1e-9) return maxPrice

  let iterations = 0
  while (high - low > precision && iterations < maxIterations) {
    const midpoint = (low + high) / 2
    if (costAt(midpoint) <= cash + 1e-9) low = midpoint
    else high = midpoint
    iterations += 1
  }

  const affordable = Math.floor((low + 1e-9) / precision) * precision
  return Math.max(0, Math.min(maxPrice, Number(affordable.toFixed(8))))
}
