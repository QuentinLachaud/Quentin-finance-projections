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

export const createAcquisition = (values = {}, defaultJurisdiction = 'england-ni') => ({
  id: values.id || crypto.randomUUID(),
  name: String(values.name || '').trim(),
  sourceUrl: values.sourceUrl || '',
  sourceProvider: values.sourceProvider || '',
  purchasePrice: values.purchasePrice ?? '',
  expectedMonthlyRent: values.expectedMonthlyRent ?? '',
  jurisdiction: values.jurisdiction || defaultJurisdiction,
  ltv: values.ltv ?? 75,
  adsRate: values.adsRate ?? 8,
  legalFees: values.legalFees ?? 1500,
  mortgageFee: values.mortgageFee ?? 0,
  mortgageFeeAddedToLoan: values.mortgageFeeAddedToLoan ?? true,
  createdAt: values.createdAt || new Date().toISOString(),
})

export const prependAcquisition = (items, item) => [item, ...(Array.isArray(items) ? items : [])]

export const nextAcquisitionName = (existingPropertyCount = 0, acquisitions = []) => {
  const used = new Set((acquisitions || []).map((item) => String(item?.name || '').replace(/\s+/g,'').toUpperCase()).filter(Boolean))
  let number = Math.max(0, Number.parseInt(existingPropertyCount, 10) || 0) + 1
  while (used.has(`BTL${number}`)) number += 1
  return `BTL${number}`
}

export const acquisitionCosts = (acquisition) => {
  const price = Math.max(0, finite(acquisition?.purchasePrice))
  const ltv = Math.min(100, Math.max(0, finite(acquisition?.ltv, 75)))
  const legalFees = Math.max(0, finite(acquisition?.legalFees, 1500))
  const mortgageFee = Math.max(0, finite(acquisition?.mortgageFee))
  const upfrontMortgageFee = acquisition?.mortgageFeeAddedToLoan === false ? mortgageFee : 0
  const jurisdiction = acquisition?.jurisdiction || 'england-ni'
  const deposit = Math.max(0, price - price * ltv / 100)
  let baseTax = 0
  let supplement = 0
  let taxLabel = 'SDLT'
  if (jurisdiction === 'scotland') {
    baseTax = progressiveTax(price, SCOTLAND_LBTT_BANDS)
    supplement = price * Math.max(0, finite(acquisition?.adsRate, 8)) / 100
    taxLabel = 'LBTT'
  } else if (jurisdiction === 'wales') {
    baseTax = progressiveTax(price, WALES_HIGHER_LTT_BANDS)
    taxLabel = 'LTT'
  } else {
    baseTax = progressiveTax(price, ENGLAND_NI_ADDITIONAL_SDLT_BANDS)
  }
  const expectedMonthlyRent = Math.max(0, finite(acquisition?.expectedMonthlyRent))
  return {
    price, ltv, deposit, baseTax, supplement, taxLabel, legalFees, upfrontMortgageFee,
    transactionTax: baseTax + supplement,
    cashRequired: deposit + baseTax + supplement + legalFees + upfrontMortgageFee,
    grossYield: price > 0 ? expectedMonthlyRent * 12 / price : 0,
  }
}

export const reorderAcquisitions = (acquisitions, fromIndex, toIndex) => {
  const source = Array.isArray(acquisitions) ? acquisitions : []
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= source.length
    || toIndex >= source.length
  ) return source

  const next = [...source]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

