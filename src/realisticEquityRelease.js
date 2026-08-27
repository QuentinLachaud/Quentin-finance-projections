import { addMonths, monthsBetween } from './calculations.js'
import { potentialEquityReleaseForProperty } from './equityRelease.js'

const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const validDate = (value) => value instanceof Date && !Number.isNaN(value.getTime())

const projectionDateAtMonth = (now, month) => {
  const source = validDate(now) ? now : new Date()
  return new Date(source.getFullYear(), source.getMonth() + Math.max(0, Math.trunc(finite(month))), 1, 12)
}
const EPSILON = 1e-7

export const nextRemortgageDateForProperty = (property) => {
  if (!property?.latestRemortgage) return null
  const fixedRateMonths = Math.trunc(finite(property?.fixedRateMonths))
  if (fixedRateMonths <= 0) return null
  const date = addMonths(property.latestRemortgage, fixedRateMonths)
  return validDate(date) ? date : null
}

export const buildRealisticEquityReleaseSchedule = ({
  properties = [],
  selections = {},
  rateShock = 0,
  now = new Date(),
}) => (Array.isArray(properties) ? properties : []).flatMap((property, propertyIndex) => {
  const propertyId = String(property?.id ?? '')
  if (!propertyId || selections?.[propertyId]?.enabled !== true) return []

  const remortgageDate = nextRemortgageDateForProperty(property)
  if (!remortgageDate) return []

  const eligibleFromMonth = Math.max(0, monthsBetween(now, remortgageDate))
  const targetLtv = Math.min(1, Math.max(0, finite(selections[propertyId]?.targetLtv, .70)))
  const modeledRate = Math.max(0, finite(property?.baseRate) + finite(rateShock))

  return [{
    propertyId,
    propertyName: String(property?.name || 'BTL'),
    propertyIndex,
    eligibleFromMonth,
    remortgageDate,
    targetLtv,
    modeledRate,
  }]
})

export const realisticEquityReleaseCandidatesAtMonth = ({
  properties = [],
  schedule = [],
  annualAppreciationRate = 0,
  month = 0,
  now = new Date(),
}) => {
  const currentMonth = Math.max(0, Math.trunc(finite(month)))
  const propertyById = new Map((Array.isArray(properties) ? properties : []).map((property) => [String(property?.id ?? ''), property]))

  return (Array.isArray(schedule) ? schedule : []).flatMap((entry) => {
    if (Math.max(0, Math.trunc(finite(entry?.eligibleFromMonth))) > currentMonth) return []
    const property = propertyById.get(String(entry?.propertyId ?? ''))
    if (!property) return []

    const detail = potentialEquityReleaseForProperty({
      property,
      targetLtv: entry.targetLtv,
      annualAppreciationRate,
      month: currentMonth,
    })
    const release = Math.max(0, finite(detail.release))

    return [{
      ...entry,
      month: currentMonth,
      executionDate: projectionDateAtMonth(now, currentMonth),
      projectedValue: detail.projectedValue,
      previousLoanAmount: detail.loanAmount,
      release,
      newLoanAmount: detail.loanAmount + release,
      loanDelta: release,
      monthlyInterestIncrease: release * finite(entry.modeledRate) / 12,
    }]
  })
}

const bundleIsBetter = (candidate, best) => {
  if (!best) return true
  if (candidate.total < best.total - EPSILON) return true
  if (Math.abs(candidate.total - best.total) <= EPSILON && candidate.events.length < best.events.length) return true
  if (Math.abs(candidate.total - best.total) <= EPSILON && candidate.events.length === best.events.length) {
    const candidateOrder = candidate.events.map((event) => finite(event.propertyIndex)).join(',')
    const bestOrder = best.events.map((event) => finite(event.propertyIndex)).join(',')
    return candidateOrder < bestOrder
  }
  return false
}

export const choosePurchaseEnablingRealisticReleases = (candidates = [], shortfall = 0) => {
  const required = Math.max(0, finite(shortfall))
  if (required <= EPSILON) return []

  const positive = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => finite(candidate?.release) > EPSILON)
    .sort((a, b) => finite(a.propertyIndex) - finite(b.propertyIndex))

  let best = null

  const visit = (index, events, total) => {
    if (total + EPSILON >= required) {
      const bundle = { events: [...events], total }
      if (bundleIsBetter(bundle, best)) best = bundle
      return
    }
    if (index >= positive.length) return
    if (best && total >= best.total - EPSILON) return

    visit(index + 1, events, total)

    const event = positive[index]
    events.push(event)
    visit(index + 1, events, total + finite(event.release))
    events.pop()
  }

  visit(0, [], 0)
  return best?.events || []
}

export const cumulativeRealisticEquityReleaseByMonth = (events = [], maxMonths = 0) => {
  const positive = (Array.isArray(events) ? events : []).filter((event) => finite(event?.release) > EPSILON)
  const horizon = Math.max(0, Math.trunc(finite(maxMonths)))
  return Array.from({ length: horizon + 1 }, (_, month) =>
    positive.reduce((total, event) => total + (Math.trunc(finite(event.month)) <= month ? finite(event.release) : 0), 0))
}

export const loanEventsFromRealisticReleases = (events = []) =>
  (Array.isArray(events) ? events : []).filter((event) => finite(event?.release) > EPSILON).map((event) => ({
    propertyId: event.propertyId,
    month: Math.max(0, Math.trunc(finite(event.month))),
    loanDelta: Math.max(0, finite(event.release)),
  }))
