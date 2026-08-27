const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

export const DEFAULT_EQUITY_RELEASE_TARGET_LTV = 0.70

export const normalizeEquityReleaseTargetLtv = (value) => clamp(
  finite(value, DEFAULT_EQUITY_RELEASE_TARGET_LTV),
  0,
  1,
)

export const projectedExistingPropertyValue = (property, annualAppreciationRate = 0, month = 0) => {
  const currentValue = Math.max(0, finite(property?.latestValuation))
  const rate = Math.max(-0.999999, finite(annualAppreciationRate))
  const months = Math.max(0, Math.trunc(finite(month)))
  return currentValue * ((1 + rate) ** (months / 12))
}

export const potentialEquityReleaseForProperty = ({
  property,
  targetLtv = DEFAULT_EQUITY_RELEASE_TARGET_LTV,
  annualAppreciationRate = 0,
  month = 0,
}) => {
  const currentValue = Math.max(0, finite(property?.latestValuation))
  const loanAmount = Math.max(0, finite(property?.loanAmount))
  const normalizedTargetLtv = normalizeEquityReleaseTargetLtv(targetLtv)
  const projectedValue = projectedExistingPropertyValue(property, annualAppreciationRate, month)
  const targetDebt = projectedValue * normalizedTargetLtv
  const release = Math.max(0, targetDebt - loanAmount)

  return {
    propertyId: String(property?.id ?? ''),
    propertyName: String(property?.name || 'BTL'),
    currentValue,
    projectedValue,
    loanAmount,
    currentLtv: currentValue ? loanAmount / currentValue : 0,
    targetLtv: normalizedTargetLtv,
    targetDebt,
    release,
  }
}

export const potentialEquityReleaseAtMonth = ({
  properties = [],
  selections = {},
  annualAppreciationRate = 0,
  month = 0,
}) => {
  const details = (Array.isArray(properties) ? properties : []).flatMap((property) => {
    const propertyId = String(property?.id ?? '')
    if (!propertyId) return []
    const selection = selections?.[propertyId]
    if (selection?.enabled !== true) return []
    return [potentialEquityReleaseForProperty({
      property,
      targetLtv: selection.targetLtv,
      annualAppreciationRate,
      month,
    })]
  })

  return {
    total: details.reduce((sum, detail) => sum + detail.release, 0),
    selectedCount: details.length,
    details,
  }
}
