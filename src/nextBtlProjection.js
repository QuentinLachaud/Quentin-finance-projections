import { calculatePortfolio, projectPortfolio } from './calculations.js'
import { acquisitionCosts, maxAffordablePurchasePrice, normalizeAcquisitionAssumptions } from './acquisitionEngine.js'
import { potentialEquityReleaseAtMonth } from './equityRelease.js'
import { buildRealisticEquityReleaseSchedule, choosePurchaseEnablingRealisticReleases, cumulativeRealisticEquityReleaseByMonth, loanEventsFromRealisticReleases, realisticEquityReleaseCandidatesAtMonth } from './realisticEquityRelease.js'

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
  potentialEquityReleaseByMonth = [],
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
    const potentialEquityRelease = Math.max(0, finite(potentialEquityReleaseByMonth[month], potentialEquityReleaseByMonth.length ? potentialEquityReleaseByMonth[potentialEquityReleaseByMonth.length - 1] : 0))
    const availableCash = Math.max(0, surplus + cumulative + potentialEquityRelease)
    const targetPrice = targetPriceAtMonth(priceToday, annualAppreciationRate, month)
    const costs = acquisitionCosts({ ...assumptions, purchasePrice: targetPrice })
    const buyingPower = maxAffordablePurchasePrice(availableCash, assumptions, { precision: 0.01 })
    const affordable = costs.cashRequired <= availableCash + 1e-7
    const point = {
      month,
      date: projectionDateAtMonth(startDate, month),
      availableCash,
      potentialEquityRelease,
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
  equityReleaseSelections = {},
  equityReleaseMode = 'smooth',
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
  const releaseMode = equityReleaseMode === 'realistic' ? 'realistic' : 'smooth'
  const projectionHorizon = Math.max(0, Math.trunc(finite(maxMonths, DEFAULT_NEXT_BTL_MAX_MONTHS)))

  const equityReleaseNow = potentialEquityReleaseAtMonth({
    properties,
    selections: equityReleaseSelections,
    annualAppreciationRate: finite(settings.appreciationRate),
    month: 0,
  })

  if (releaseMode === 'smooth') {
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

    const potentialEquityReleaseByMonth = Array.from({ length: projectionHorizon + 1 }, (_, month) => potentialEquityReleaseAtMonth({
      properties,
      selections: equityReleaseSelections,
      annualAppreciationRate: finite(settings.appreciationRate),
      month,
    }).total)

    const nextBtlProjection = buildNextBtlProjection({
      targetPriceToday,
      annualAppreciationRate,
      acquisitionAssumptions,
      startingSurplus,
      cumulativeCashByMonth,
      potentialEquityReleaseByMonth,
      startDate: now,
      maxMonths,
    })

    return {
      ...nextBtlProjection,
      scenario: NEXT_BTL_SCENARIOS[Math.min(2, Math.max(0, Math.trunc(finite(scenarioIndex))))],
      monthlyOperatingCosts,
      reserveCash,
      startingSurplus,
      preserveBuffer,
      includeExtraction: Boolean(includeExtraction && isCompany),
      equityReleaseNow: equityReleaseNow.total,
      equityReleaseSelectedCount: equityReleaseNow.selectedCount,
      equityReleaseMode: 'smooth',
      equityReleaseSchedule: [],
      equityReleaseEvents: [],
      isCompany,
    }
  }

  const realisticSchedule = buildRealisticEquityReleaseSchedule({
    properties,
    selections: equityReleaseSelections,
    rateShock: finite(settings.rateShock),
    now,
  })

  // Before a refinance actually happens there is no financing drag, so search for the purchase-enabling
  // month against a clean no-release baseline. Eligibility alone never mutates cash or debt.
  const baselinePoints = projectPortfolio(properties, settings, maxMonths, now)
  const baselineCumulativeCashByMonth = baselinePoints.map((point) => cumulativeProjectedCash({
    projectionPoint: point,
    scenarioIndex,
    includeExtraction,
    startingCashHeld: basePortfolio.cashHeld,
    isCompany,
  }))

  const assumptions = normalizeAcquisitionAssumptions(acquisitionAssumptions)
  let realisticEvents = []

  for (let month = 0; month <= projectionHorizon; month += 1) {
    const cumulative = finite(
      baselineCumulativeCashByMonth[month],
      baselineCumulativeCashByMonth.length ? baselineCumulativeCashByMonth[baselineCumulativeCashByMonth.length - 1] : 0,
    )
    const cashWithoutRelease = Math.max(0, startingSurplus + cumulative)
    const targetPrice = targetPriceAtMonth(targetPriceToday, annualAppreciationRate, month)
    const cashRequired = acquisitionCosts({ ...assumptions, purchasePrice: targetPrice }).cashRequired

    // If organic cash gets there first, do not refinance merely because capacity exists.
    if (cashWithoutRelease + 1e-7 >= cashRequired) break

    const candidates = realisticEquityReleaseCandidatesAtMonth({
      properties,
      schedule: realisticSchedule,
      annualAppreciationRate: finite(settings.appreciationRate),
      month,
      now,
    })
    const shortfall = Math.max(0, cashRequired - cashWithoutRelease)
    const purchaseEnabling = choosePurchaseEnablingRealisticReleases(candidates, shortfall)

    if (purchaseEnabling.length) {
      realisticEvents = purchaseEnabling
      break
    }
  }

  const loanEvents = loanEventsFromRealisticReleases(realisticEvents)
  const points = realisticEvents.length
    ? projectPortfolio(properties, settings, maxMonths, now, { loanEvents })
    : baselinePoints

  const cumulativeCashByMonth = points.map((point) => cumulativeProjectedCash({
    projectionPoint: point,
    scenarioIndex,
    includeExtraction,
    startingCashHeld: basePortfolio.cashHeld,
    isCompany,
  }))

  const potentialEquityReleaseByMonth = cumulativeRealisticEquityReleaseByMonth(realisticEvents, projectionHorizon)

  const nextBtlProjection = buildNextBtlProjection({
    targetPriceToday,
    annualAppreciationRate,
    acquisitionAssumptions,
    startingSurplus,
    cumulativeCashByMonth,
    potentialEquityReleaseByMonth,
    startDate: now,
    maxMonths,
  })

  return {
    ...nextBtlProjection,
    scenario: NEXT_BTL_SCENARIOS[Math.min(2, Math.max(0, Math.trunc(finite(scenarioIndex))))],
    monthlyOperatingCosts,
    reserveCash,
    startingSurplus,
    preserveBuffer,
    includeExtraction: Boolean(includeExtraction && isCompany),
    equityReleaseNow: equityReleaseNow.total,
    equityReleaseSelectedCount: equityReleaseNow.selectedCount,
    equityReleaseMode: 'realistic',
    equityReleaseSchedule: realisticSchedule,
    equityReleaseEvents: realisticEvents,
    isCompany,
  }
}
