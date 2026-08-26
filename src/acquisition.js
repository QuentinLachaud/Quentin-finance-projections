export {
  SCOTLAND_LBTT_BANDS,
  ENGLAND_NI_ADDITIONAL_SDLT_BANDS,
  WALES_HIGHER_LTT_BANDS,
  acquisitionJurisdictions,
  normalizeAcquisitionAssumptions,
  acquisitionCosts,
  maxAffordablePurchasePrice,
} from './acquisitionEngine.js'

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
