import { calculatePortfolio, projectPortfolio } from './calculations.js'
import { acquisitionCosts, maxAffordablePurchasePrice, normalizeAcquisitionAssumptions } from './acquisitionEngine.js'

const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const NEXT_BTL_SCENARIOS = [
  { id: 0, label: 'Conservative' },
  { id: 1, label: 'Full occupancy' },
  { id: 2, label: 'Maximum cash' },
]

export const DEFAULT_NEXT_BTL_APPRECIATION = 0.0325
export const DEFAULT_NEXT_BTL_BUFFER_MONTHS = 6
export const DEFAULT_NEXT_BTL_MAX_MONTHS = 600

export const targetPriceAtMonth = (priceToday, annualAppreciationRate, month) => {
  const price = Math.max(0, finite(priceToday))
  const rate = Math.max(-0.999999, finite(annualAppreciationRate, DEFAULT_NEXT_BTL_APPRECIATION))
  const months = Math.max(0, Math.trunc(finite(month)))
  return price * ((1 + rate) ** (months / 12))
}

export const startingSurplusCash = ({
  cashHeld,
  monthlyOperatingCosts,
  preserveBuffer = true,
  bufferMonths = DEFAULT_NEXT_BTL_BUFFER_MONTHS,
}) => {
  const cash = Math.max(0, finite(cashHeld))
  if (!preserveBuffer) return cash
  const monthlyCosts = Math.max(0, finite(monthlyOperatingCosts))
  const months = Math.max(0, finite(bufferMonths, DEFAULT_NEXT_BTL_BUFFER_MONTHS))
  return Math.max(0, cash - monthlyCosts * months)
}

export const cumulativeProjectedCash = ({
  projectionPoint,
  scenarioIndex = 0,
  includeExtraction = false,
  startingCashHeld = 0,
  isCompany = true,
}) => {
  const index = Math.min(2, Math.max(0, Math.trunc(finite(scenarioIndex))))
  const scenario = projectionPoint?.scenarios?.[index] || {}
  if (includeExtraction && isCompany) return finite(scenario.cashflow)
  return finite(scenario.cashPot) - Math.max(0, finite(startingCashHeld))
}

const projectionDateAtMonth = (startDate, month) => {
  const source = startDate instanceof Date && !Number.isNaN(startDate.getTime()) ? startDate : new Date()
  return new Date(source.getFullYear(), source.getMonth() + month, 1, 12)
}

export const formatDurationMonths = (months) => {
  const total = Math.max(0, Math.trunc(finite(months)))
  const years = Math.floor(total / 12)
  const remaining = total % 12
  if (!years) return `${remaining} ${remaining === 1 ? 'month' : 'months'}`
  if (!remaining) return `${years} ${years === 1 ? 'year' : 'years'}`
  return `${years} ${years === 1 ? 'year' : 'years'} ${remaining} ${remaining === 1 ? 'month' : 'months'}`
}

export const formatProjectionMonth = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date)
}

export const buildNextBtlProjection = ({
  targetPriceToday,
  annualAppreciationRate = DEFAULT_NEXT_BTL_APPRECIATION,
  acquisitionAssumptions = {},
  startingSurplus = 0,
  cumulativeCashByMonth = [],
  startDate = new Date(),
  maxMonths = DEFAULT_NEXT_BTL_MAX_MONTHS,
}) => {
  const priceToday = Math.max(0, finite(targetPriceToday))
  const horizon = Math.max(0, Math.trunc(finite(maxMonths, DEFAULT_NEXT_BTL_MAX_MONTHS)))
  const assumptions = normalizeAcquisitionAssumptions(acquisitionAssumptions)
  const surplus = Math.max(0, finite(startingSurplus))

  if (priceToday <= 0) {
    return { status: 'invalid', points: [], crossing: null, maxMonths: horizon, assumptions }
  }

  let crossing = null
  const points = Array.from({ length: horizon + 1 }, (_, month) => {
    const cumulative = finite(cumulativeCashByMonth[month], cumulativeCashByMonth.length ? cumulativeCashByMonth[cumulativeCashByMonth.length - 1] : 0)
    const availableCash = Math.max(0, surplus + cumulative)
    const targetPrice = targetPriceAtMonth(priceToday, annualAppreciationRate, month)
    const costs = acquisitionCosts({ ...assumptions, purchasePrice: targetPrice })
    const buyingPower = maxAffordablePurchasePrice(availableCash, assumptions, { precision: 0.01 })
    const affordable = costs.cashRequired <= availableCash + 1e-7
    const point = {
      month,
      date: projectionDateAtMonth(startDate, month),
      availableCash,
      targetPrice,
      cashRequired: costs.cashRequired,
      buyingPower,
      affordable,
    }
    if (!crossing && affordable) crossing = point
    return point
  })

  return {
    status: crossing ? (crossing.month === 0 ? 'ready' : 'reached') : 'not-reached',
    points,
    crossing,
    maxMonths: horizon,
    assumptions,
  }
}

export const projectTimeToNextBtl = ({
  properties = [],
  settings = {},
  portfolio = null,
  projectionPoints = null,
  targetPriceToday,
  annualAppreciationRate = DEFAULT_NEXT_BTL_APPRECIATION,
  acquisitionAssumptions = {},
  scenarioIndex = 0,
  preserveBuffer = true,
  includeExtraction = false,
  bufferMonths = DEFAULT_NEXT_BTL_BUFFER_MONTHS,
  maxMonths = DEFAULT_NEXT_BTL_MAX_MONTHS,
  now = new Date(),
}) => {
  const basePortfolio = portfolio || calculatePortfolio(properties, settings, now)
  const monthlyOperatingCosts = Math.max(0, finite(basePortfolio.fixedCosts) + finite(basePortfolio.variableCosts))
  const reserveCash = preserveBuffer ? monthlyOperatingCosts * Math.max(0, finite(bufferMonths, DEFAULT_NEXT_BTL_BUFFER_MONTHS)) : 0
  const startingSurplus = startingSurplusCash({
    cashHeld: basePortfolio.cashHeld,
    monthlyOperatingCosts,
    preserveBuffer,
    bufferMonths,
  })
  const isCompany = settings.accountType !== 'private'
  const points = Array.isArray(projectionPoints)
    ? projectionPoints
    : projectPortfolio(properties, settings, maxMonths, now)
  const cumulativeCashByMonth = points.map((point) => cumulativeProjectedCash({
    projectionPoint: point,
    scenarioIndex,
    includeExtraction,
    startingCashHeld: basePortfolio.cashHeld,
    isCompany,
  }))

  const projection = buildNextBtlProjection({
    targetPriceToday,
    annualAppreciationRate,
    acquisitionAssumptions,
    startingSurplus,
    cumulativeCashByMonth,
    startDate: now,
    maxMonths,
  })

  return {
    ...projection,
    scenario: NEXT_BTL_SCENARIOS[Math.min(2, Math.max(0, Math.trunc(finite(scenarioIndex))))],
    monthlyOperatingCosts,
    reserveCash,
    startingSurplus,
    preserveBuffer,
    includeExtraction: Boolean(includeExtraction && isCompany),
    isCompany,
  }
}
