import { amortizingPayment, calculatePortfolio } from './calculations.js'

const clean = (value) => String(value ?? '').trim()
const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const nonNegative = (value) => Math.max(0, finite(value))
const makeId = (prefix = 'performance-update') => globalThis.crypto?.randomUUID?.()
  || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const PERFORMANCE_SCENARIOS = [
  { id: 0, label: 'Conservative', shortLabel: 'Conservative' },
  { id: 1, label: 'No voids', shortLabel: 'No voids' },
  { id: 2, label: 'No repairs or voids', shortLabel: 'No repairs/voids' },
]

export const PERFORMANCE_SERIES = [
  { key: 'assetValue', label: 'Portfolio value', propertyLabel: 'Property value', axis: 'capital' },
  { key: 'equity', label: 'Equity', propertyLabel: 'Equity', axis: 'capital' },
  { key: 'debt', label: 'Mortgage debt', propertyLabel: 'Mortgage debt', axis: 'capital' },
  { key: 'monthlyCashflow', label: 'Monthly cash flow', propertyLabel: 'Monthly cash flow', axis: 'flow' },
  { key: 'cashAccumulation', label: 'Cash accumulated', propertyLabel: 'Cash accumulated', axis: 'capital' },
  { key: 'monthlyRent', label: 'Monthly rent', propertyLabel: 'Monthly rent', axis: 'flow' },
]

export const DEFAULT_PERFORMANCE_SERIES = ['assetValue', 'equity', 'monthlyCashflow', 'cashAccumulation']

export const monthKey = (value = new Date()) => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}`
  }
  const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const addMonthsKey = (source, amount) => {
  const match = clean(source).match(/^(\d{4})-(\d{2})$/)
  if (!match) return ''
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + Math.trunc(finite(amount)), 1, 12))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

const validMonth = (value) => /^(\d{4})-(0[1-9]|1[0-2])$/.test(clean(value))

export const monthLabel = (value, long = false) => {
  if (!validMonth(value)) return '—'
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    month: long ? 'short' : 'short',
    year: long ? 'numeric' : '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)))
}

export const createPerformanceUpdate = ({ kind = 'rent', propertyId = '', order = 0, now = new Date() } = {}) => ({
  id: makeId(),
  kind: kind === 'valuation' ? 'valuation' : 'rent',
  propertyId: clean(propertyId),
  value: '',
  startMonth: monthKey(now),
  endMonth: '',
  order: Math.max(0, Math.trunc(finite(order))),
  createdAt: new Date().toISOString(),
})

export const normalizePerformanceUpdate = (entry, fallbackOrder = 0) => {
  if (!entry || !['rent', 'valuation'].includes(entry.kind) || !clean(entry.propertyId)) return null
  const startMonth = validMonth(entry.startMonth) ? entry.startMonth : ''
  const endMonth = validMonth(entry.endMonth) ? entry.endMonth : ''
  const value = finite(entry.value, NaN)
  if (!startMonth || !Number.isFinite(value) || value <= 0 || (endMonth && endMonth < startMonth)) return null
  return {
    id: clean(entry.id) || makeId(),
    kind: entry.kind,
    propertyId: clean(entry.propertyId),
    value,
    startMonth,
    endMonth,
    order: Math.max(0, Math.trunc(finite(entry.order, fallbackOrder))),
    createdAt: clean(entry.createdAt) || new Date().toISOString(),
  }
}

export const normalizePerformanceUpdates = (updates, properties = []) => {
  const propertyIds = new Set((properties || []).map((property) => clean(property?.id)).filter(Boolean))
  return (Array.isArray(updates) ? updates : [])
    .map((entry, index) => normalizePerformanceUpdate(entry, index))
    .filter((entry) => entry && propertyIds.has(entry.propertyId))
    .sort((left, right) => left.order - right.order || right.startMonth.localeCompare(left.startMonth) || left.id.localeCompare(right.id))
    .map((entry, index) => ({ ...entry, order: index }))
}

const rangesOverlap = (left, right) => {
  const leftEnd = left.endMonth || '9999-12'
  const rightEnd = right.endMonth || '9999-12'
  return left.startMonth <= rightEnd && right.startMonth <= leftEnd
}

export const validatePerformanceUpdate = (candidate, updates, properties = [], ignoreId = '') => {
  const normalized = normalizePerformanceUpdate(candidate)
  if (!clean(candidate?.propertyId)) return 'Choose a BTL.'
  if (!(properties || []).some((property) => clean(property?.id) === clean(candidate?.propertyId))) return 'Choose a valid BTL.'
  if (!['rent', 'valuation'].includes(candidate?.kind)) return 'Choose Rent or Valuation.'
  if (!validMonth(candidate?.startMonth)) return 'Choose a start month.'
  if (candidate?.endMonth && !validMonth(candidate.endMonth)) return 'Choose a valid end month.'
  if (candidate?.endMonth && candidate.endMonth < candidate.startMonth) return 'End month must be on or after start month.'
  if (!Number.isFinite(Number(candidate?.value)) || Number(candidate.value) <= 0) return 'Enter a value above £0.'
  if (!normalized) return 'Check the update details.'
  const collision = normalizePerformanceUpdates(updates, properties).find((entry) =>
    entry.id !== ignoreId
    && entry.propertyId === normalized.propertyId
    && entry.kind === normalized.kind
    && rangesOverlap(entry, normalized))
  if (collision) return `This overlaps ${monthLabel(collision.startMonth, true)}${collision.endMonth ? `–${monthLabel(collision.endMonth, true)}` : ' onward'}. Edit that range first.`
  return ''
}

export const activePerformanceUpdate = (updates, propertyId, kind, atMonth) => normalizePerformanceUpdates(updates, [{ id: propertyId }])
  .find((entry) => entry.propertyId === propertyId
    && entry.kind === kind
    && entry.startMonth <= atMonth
    && (!entry.endMonth || entry.endMonth >= atMonth)) || null

export const performanceAnchorForProperty = (property, updates, atMonth) => {
  const propertyId = clean(property?.id)
  const rentUpdate = activePerformanceUpdate(updates, propertyId, 'rent', atMonth)
  const valuationUpdate = activePerformanceUpdate(updates, propertyId, 'valuation', atMonth)
  return {
    rent: rentUpdate ? nonNegative(rentUpdate.value) : nonNegative(property?.rent),
    value: valuationUpdate ? nonNegative(valuationUpdate.value) : nonNegative(property?.latestValuation),
    rentSource: rentUpdate ? 'update' : 'property',
    valueSource: valuationUpdate ? 'update' : 'property',
  }
}

export const resolvePerformanceAssumptions = (settings = {}, scope = 'portfolio') => {
  const portfolio = {
    rentGrowthRate: finite(settings.rentGrowthRate),
    appreciationRate: finite(settings.appreciationRate),
    rateShock: finite(settings.rateShock),
    rateShockStartMonth: validMonth(settings.performanceRateShockStartMonth) ? settings.performanceRateShockStartMonth : '',
  }
  if (scope === 'portfolio') return { ...portfolio, inherited: false }
  const override = settings.performanceModelOverrides?.[scope]
  if (!override || typeof override !== 'object') return { ...portfolio, inherited: true }
  return {
    rentGrowthRate: Number.isFinite(Number(override.rentGrowthRate)) ? Number(override.rentGrowthRate) : portfolio.rentGrowthRate,
    appreciationRate: Number.isFinite(Number(override.appreciationRate)) ? Number(override.appreciationRate) : portfolio.appreciationRate,
    rateShock: Number.isFinite(Number(override.rateShock)) ? Number(override.rateShock) : portfolio.rateShock,
    rateShockStartMonth: validMonth(override.rateShockStartMonth) ? override.rateShockStartMonth : portfolio.rateShockStartMonth,
    inherited: false,
  }
}

const rateShockAt = (assumptions, atMonth) => !assumptions.rateShockStartMonth || atMonth >= assumptions.rateShockStartMonth
  ? finite(assumptions.rateShock)
  : 0

const projectRepaymentBalance = ({ balance, property, annualRate, remainingTerm }) => {
  if (property?.mortgageInterestOnly !== false || balance <= 0) return balance
  const term = Math.max(1, Math.trunc(remainingTerm))
  const payment = amortizingPayment(balance, annualRate, term, false)
  const interest = balance * Math.max(0, annualRate) / 12
  return Math.max(0, balance - Math.max(0, payment - interest))
}

const scopedProperties = (properties, scope) => scope === 'portfolio'
  ? (properties || []).filter((property) => property?.active !== false)
  : (properties || []).filter((property) => clean(property?.id) === clean(scope) && property?.active !== false)

const scopedCalculationSettings = (settings, scope, assumptions, activeShock) => ({
  ...settings,
  rentGrowthRate: assumptions.rentGrowthRate,
  appreciationRate: assumptions.appreciationRate,
  rateShock: activeShock,
  ...(scope === 'portfolio' ? {} : { companyCosts: [], extractions: [] }),
})

export const buildTheoreticalPerformanceProjection = ({
  properties = [], settings = {}, scope = 'portfolio', scenarioId = 0, horizonYears = 10,
  excludeExtractions = true, now = new Date(),
} = {}) => {
  const selected = scopedProperties(properties, scope)
  const todayMonth = monthKey(now)
  const assumptions = resolvePerformanceAssumptions(settings, scope)
  const updates = normalizePerformanceUpdates(settings.performanceUpdates, properties)
  const anchors = new Map(selected.map((property) => [clean(property.id), performanceAnchorForProperty(property, updates, todayMonth)]))
  const balances = new Map(selected.map((property) => [clean(property.id), nonNegative(property.loanAmount)]))
  const horizon = Math.max(1, Math.min(15, finite(horizonYears, 10)))
  const months = Math.round(horizon * 12)
  const scenarioIndex = Math.max(0, Math.min(2, Math.trunc(finite(scenarioId))))
  const points = []
  let cashAccumulation = 0

  for (let month = 0; month <= months; month += 1) {
    const atMonth = addMonthsKey(todayMonth, month)
    const shock = rateShockAt(assumptions, atMonth)
    const years = month / 12
    const growth = Math.max(-0.99, assumptions.rentGrowthRate)
    const hpi = Math.max(-0.99, assumptions.appreciationRate)

    if (month > 0) {
      for (const property of selected) {
        const id = clean(property.id)
        const priorBalance = balances.get(id) || 0
        const originalTerm = Math.max(1, Math.round(finite(property.mortgageTermMonths, 300)))
        const remainingTerm = Math.max(1, originalTerm - (month - 1))
        const annualRate = Math.max(0, finite(property.baseRate) + shock)
        balances.set(id, projectRepaymentBalance({ balance: priorBalance, property, annualRate, remainingTerm }))
      }
    }

    const projected = selected.map((property) => {
      const id = clean(property.id)
      const anchor = anchors.get(id) || { rent: 0, value: 0 }
      return {
        ...property,
        active: true,
        rent: anchor.rent * ((1 + growth) ** years),
        latestValuation: anchor.value * ((1 + hpi) ** years),
        loanAmount: balances.get(id) || 0,
        mortgageTermMonths: Math.max(1, Math.round(finite(property.mortgageTermMonths, 300)) - month),
      }
    })
    const calculationSettings = scopedCalculationSettings(settings, scope, assumptions, shock)
    const portfolio = calculatePortfolio(projected, calculationSettings, new Date(`${atMonth}-01T12:00:00Z`))
    const scenario = portfolio.scenarios?.[scenarioIndex] || { cashflow: 0, bankCashflow: 0 }
    const monthlyCashflow = scope === 'portfolio' && !excludeExtractions
      ? finite(scenario.bankCashflow)
      : finite(scenario.cashflow)
    if (month > 0) cashAccumulation += monthlyCashflow
    const assetValue = projected.reduce((sum, property) => sum + nonNegative(property.latestValuation), 0)
    const debt = projected.reduce((sum, property) => sum + nonNegative(property.loanAmount), 0)
    const monthlyRent = projected.reduce((sum, property) => sum + nonNegative(property.rent), 0)
    points.push({
      month,
      date: atMonth,
      assetValue,
      equity: assetValue - debt,
      debt,
      monthlyCashflow,
      cashAccumulation,
      monthlyRent,
      rateShockApplied: shock,
      scenarioId: scenarioIndex,
    })
  }

  return {
    scope,
    scenarioId: scenarioIndex,
    scenario: PERFORMANCE_SCENARIOS[scenarioIndex],
    assumptions,
    points,
    anchors: Object.fromEntries(anchors),
    excludeExtractions: scope === 'portfolio' ? Boolean(excludeExtractions) : true,
    isEmpty: selected.length === 0,
  }
}

const niceStep = (range, targetTicks = 5) => {
  const raw = Math.abs(range) / Math.max(1, targetTicks)
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}

export const niceCurrencyAxis = (values, targetTicks = 5) => {
  const numbers = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite)
  if (!numbers.length) return { min: 0, max: 1, step: 1, ticks: [0, 1] }
  let min = Math.min(...numbers)
  let max = Math.max(...numbers)
  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * 0.1)
    min -= padding
    max += padding
  }
  const step = niceStep(max - min, targetTicks)
  let niceMin = Math.floor(min / step) * step
  let niceMax = Math.ceil(max / step) * step
  if (min >= 0 && niceMin < 0) niceMin = 0
  if (max <= 0 && niceMax > 0) niceMax = 0
  if (niceMin === niceMax) niceMax = niceMin + step
  const ticks = []
  for (let value = niceMin, guard = 0; value <= niceMax + step * 0.001 && guard < 12; value += step, guard += 1) {
    ticks.push(Math.abs(value) < step * 1e-9 ? 0 : value)
  }
  return { min: niceMin, max: niceMax, step, ticks }
}

export const formatCompactCurrency = (value) => {
  const amount = finite(value)
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.0', '')}m`
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1).replace('.0', '')}k`
  return `${sign}£${Math.round(abs).toLocaleString('en-GB')}`
}

export const performanceXAxisTicks = (points, horizonYears) => {
  const list = Array.isArray(points) ? points : []
  if (!list.length) return []
  const years = finite(horizonYears, 10)
  const every = years <= 1 ? 2 : years <= 3 ? 4 : years <= 5 ? 6 : 12
  const ticks = list
    .map((point, index) => ({ point, index }))
    .filter(({ point, index }) => index === 0 || index === list.length - 1 || point.month % every === 0)
    .map(({ point, index }) => ({
      index,
      label: years <= 5 ? monthLabel(point.date) : point.date.slice(0, 4),
    }))
  return ticks.filter((tick, index) => index === 0 || tick.label !== ticks[index - 1]?.label)
}
