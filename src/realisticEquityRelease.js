import { addMonths, monthsBetween } from './calculations.js'
import { potentialEquityReleaseForProperty } from './equityRelease.js'

const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const validDate = (value) => value instanceof Date && !Number.isNaN(value.getTime())

export const nextRemortgageDateForProperty = (property) => {
  if (!property?.latestRemortgage) return null
  const fixedRateMonths = Math.trunc(finite(property?.fixedRateMonths))
  if (fixedRateMonths <= 0) return null
  const date = addMonths(property.latestRemortgage, fixedRateMonths)
  return validDate(date) ? date : null
}

export const buildRealisticEquityReleaseEvents = ({
  properties = [],
  selections = {},
  annualAppreciationRate = 0,
  rateShock = 0,
  now = new Date(),
}) => (Array.isArray(properties) ? properties : []).flatMap((property) => {
  const propertyId = String(property?.id ?? '')
  if (!propertyId || selections?.[propertyId]?.enabled !== true) return []

  const remortgageDate = nextRemortgageDateForProperty(property)
  if (!remortgageDate) return []

  const month = monthsBetween(now, remortgageDate)
  const targetLtv = selections[propertyId]?.targetLtv
  const detail = potentialEquityReleaseForProperty({
    property,
    targetLtv,
    annualAppreciationRate,
    month,
  })
  const modeledRate = Math.max(0, finite(property?.baseRate) + finite(rateShock))

  return [{
    propertyId,
    propertyName: String(property?.name || 'BTL'),
    month,
    remortgageDate,
    targetLtv: detail.targetLtv,
    projectedValue: detail.projectedValue,
    previousLoanAmount: detail.loanAmount,
    release: detail.release,
    newLoanAmount: detail.loanAmount + detail.release,
    loanDelta: detail.release,
    modeledRate,
    monthlyInterestIncrease: detail.release * modeledRate / 12,
  }]
})

export const positiveRealisticEquityReleaseEvents = (events = []) =>
  (Array.isArray(events) ? events : []).filter((event) => finite(event?.release) > 0)

export const cumulativeRealisticEquityReleaseByMonth = (events = [], maxMonths = 0) => {
  const positive = positiveRealisticEquityReleaseEvents(events)
  const horizon = Math.max(0, Math.trunc(finite(maxMonths)))
  return Array.from({ length: horizon + 1 }, (_, month) =>
    positive.reduce((total, event) => total + (Math.trunc(finite(event.month)) <= month ? finite(event.release) : 0), 0))
}

export const loanEventsFromRealisticReleases = (events = []) =>
  positiveRealisticEquityReleaseEvents(events).map((event) => ({
    propertyId: event.propertyId,
    month: Math.max(0, Math.trunc(finite(event.month))),
    loanDelta: Math.max(0, finite(event.release)),
  }))
