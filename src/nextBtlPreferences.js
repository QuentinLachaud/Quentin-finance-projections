const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const finite = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

export const NEXT_BTL_PREFERENCES_VERSION = 1

const sanitizeAssumptions = (value) => {
  if (!isRecord(value)) return undefined
  const next = {}
  if (typeof value.jurisdiction === 'string') next.jurisdiction = value.jurisdiction
  for (const key of ['ltv', 'adsRate', 'legalFees', 'mortgageFee']) {
    const parsed = finite(value[key])
    if (parsed != null) next[key] = parsed
  }
  if (typeof value.mortgageFeeAddedToLoan === 'boolean') next.mortgageFeeAddedToLoan = value.mortgageFeeAddedToLoan
  return Object.keys(next).length ? next : undefined
}

const sanitizeEquityReleaseOptions = (value) => {
  if (!isRecord(value)) return {}
  const next = {}
  for (const [key, option] of Object.entries(value)) {
    if (!key || !isRecord(option)) continue
    const target = finite(option.targetLtv)
    const enabled = typeof option.enabled === 'boolean' ? option.enabled : false
    next[key] = {
      enabled,
      targetLtv: target == null ? 70 : clamp(target, 0, 100),
    }
  }
  return next
}

export const normalizeNextBtlPreferences = (value) => {
  const raw = isRecord(value) ? value : {}
  const next = {
    version: NEXT_BTL_PREFERENCES_VERSION,
    equityReleaseOptions: sanitizeEquityReleaseOptions(raw.equityReleaseOptions),
  }

  if (raw.targetSource === 'manual' || raw.targetSource === 'saved') next.targetSource = raw.targetSource
  if (typeof raw.selectedAcquisitionId === 'string') next.selectedAcquisitionId = raw.selectedAcquisitionId

  const targetPrice = finite(raw.targetPrice)
  if (targetPrice != null && targetPrice >= 0) next.targetPrice = targetPrice

  const appreciation = finite(raw.appreciationPercent)
  if (appreciation != null) next.appreciationPercent = clamp(appreciation, -20, 30)

  const scenario = finite(raw.scenarioIndex)
  if (scenario != null && Number.isInteger(scenario) && scenario >= 0 && scenario <= 2) next.scenarioIndex = scenario

  if (typeof raw.preserveBuffer === 'boolean') next.preserveBuffer = raw.preserveBuffer
  if (typeof raw.includeExtraction === 'boolean') next.includeExtraction = raw.includeExtraction
  if (typeof raw.includeRentGrowth === 'boolean') next.includeRentGrowth = raw.includeRentGrowth
  if (raw.releaseMode === 'smooth' || raw.releaseMode === 'realistic') next.releaseMode = raw.releaseMode

  const assumptions = sanitizeAssumptions(raw.assumptions)
  if (assumptions) next.assumptions = assumptions

  return next
}
