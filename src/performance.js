const MS_DAY = 24 * 60 * 60 * 1000
const MS_YEAR = 365.2425 * MS_DAY

const clean = (value) => String(value ?? '').trim()
const finite = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const nonNegative = (value) => Math.max(0, finite(value))
const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const roundMoney = (value) => Math.round((finite(value) + Number.EPSILON) * 100) / 100
const dateOnly = (value) => {
  const source = clean(value)
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return source
}
const todayDate = (now = new Date()) => {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const utcDate = (value) => {
  const iso = dateOnly(value)
  return iso ? new Date(`${iso}T12:00:00Z`) : null
}
const addMonths = (dateString, months) => {
  const source = utcDate(dateString)
  if (!source) return ''
  const day = source.getUTCDate()
  source.setUTCDate(1)
  source.setUTCMonth(source.getUTCMonth() + Math.trunc(finite(months)))
  const end = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0)).getUTCDate()
  source.setUTCDate(Math.min(day, end))
  return source.toISOString().slice(0, 10)
}
const makeId = (prefix = 'performance') => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const PERFORMANCE_EVENT_TYPES = [
  { value: 'initial_capital', label: 'Initial cash invested', sign: -1, note: 'Use the actual cash you put into the purchase, excluding mortgage borrowing.' },
  { value: 'acquisition_cost', label: 'Purchase tax / acquisition cost', sign: -1, note: 'LBTT/SDLT/ADS, legal fees or other purchase cash not already in Documents & Expenses.' },
  { value: 'tax', label: 'Tax paid', sign: -1, note: 'Only add tax here when it is not already recorded in Documents & Expenses.' },
  { value: 'refinance_cash', label: 'Equity released / refinance cash', sign: 1, note: 'Cash received from refinancing. Mortgage balance changes are tracked separately.' },
  { value: 'other', label: 'Other investment cash flow', sign: 0, note: 'Positive means cash received; negative means cash paid.' },
]

const eventType = (type) => PERFORMANCE_EVENT_TYPES.find((candidate) => candidate.value === type) || PERFORMANCE_EVENT_TYPES.at(-1)

export const signedPerformanceAmount = (type, amount) => {
  const value = finite(amount)
  const meta = eventType(type)
  if (meta.sign < 0) return -Math.abs(value)
  if (meta.sign > 0) return Math.abs(value)
  return value
}

export const createPerformanceEvent = (propertyId = '', now = new Date()) => ({
  id: makeId('performance-manual'),
  propertyId: clean(propertyId),
  occurredAt: todayDate(now),
  type: 'acquisition_cost',
  title: '',
  amount: 0,
  notes: '',
  sourceType: 'manual-performance',
  createdAt: new Date().toISOString(),
})

export const normalizePerformanceEvent = (event) => {
  const occurredAt = dateOnly(event?.occurredAt || event?.date)
  if (!occurredAt) return null
  const type = eventType(clean(event?.type)).value
  return {
    id: clean(event?.id) || makeId('performance-manual'),
    propertyId: clean(event?.propertyId),
    occurredAt,
    type,
    title: clean(event?.title),
    amount: roundMoney(signedPerformanceAmount(type, event?.amount)),
    notes: clean(event?.notes),
    sourceType: 'manual-performance',
    createdAt: clean(event?.createdAt) || new Date().toISOString(),
  }
}

export const normalizePerformanceEvents = (events, properties = []) => {
  const propertyIds = new Set((properties || []).map((property) => clean(property?.id)).filter(Boolean))
  return (Array.isArray(events) ? events : [])
    .map(normalizePerformanceEvent)
    .filter((event) => event && (!event.propertyId || propertyIds.has(event.propertyId)))
}

const propertyAliases = (property) => [property?.id, property?.name, property?.postcode, property?.address]
  .map((value) => clean(value).toLowerCase()).filter(Boolean)

const expensePropertyId = (expense, properties) => {
  const association = expense?.document?.association
  if (association?.kind === 'property' && clean(association.id)) return clean(association.id)
  const raw = clean(expense?.property)
  if (!raw || raw.toLowerCase() === 'all') return ''
  const key = raw.toLowerCase()
  return clean((properties || []).find((property) => propertyAliases(property).includes(key))?.id)
}

const expenseTitle = (expense) => clean(expense?.description)
  || clean(expense?.document?.title)
  || clean(expense?.category)
  || (finite(expense?.amount) >= 0 ? 'Income recorded' : 'Cost recorded')

const financialTimelineEvent = (event) => {
  if (!event) return false
  if (event.sourceField === 'rent' || event.sourceField === 'latestValuation') return true
  if (event.sourceType === 'loan' || event.sourceType === 'loan-change') return true
  return event.category === 'finance' && event.kind === 'change'
}

const currentLoanFor = (propertyId, loans) => (loans || []).find((loan) => clean(loan?.propertyId) === clean(propertyId)) || null

const purchaseDebtFor = (property, loans) => {
  const purchaseDate = dateOnly(property?.purchaseDate)
  const loan = currentLoanFor(property?.id, loans)
  if (purchaseDate && loan && dateOnly(loan.fixedStartDate) === purchaseDate) {
    return { amount: nonNegative(loan.principalAmount || loan.loanAmount), confidence: 'recorded' }
  }
  return {
    amount: nonNegative(property?.mortgagePrincipalAmount || property?.loanAmount),
    confidence: 'estimated',
  }
}

const timelineAmount = (event, key) => {
  const value = event?.[key]
  return Number.isFinite(Number(value)) ? Number(value) : null
}

const buildRawEvents = ({ properties, loans, expenses, timelineEvents, performanceEvents, now }) => {
  const today = todayDate(now)
  const normalizedManual = normalizePerformanceEvents(performanceEvents, properties)
  const manualInitialProperties = new Set(normalizedManual.filter((event) => event.type === 'initial_capital').map((event) => event.propertyId))
  const events = []
  const basisByProperty = new Map()

  for (const property of properties || []) {
    const propertyId = clean(property?.id)
    const purchaseDate = dateOnly(property?.purchaseDate)
    const purchasePrice = nonNegative(property?.purchasePrice)
    const currentValue = nonNegative(property?.latestValuation)
    const currentDebt = nonNegative(property?.loanAmount)
    const purchaseDebt = purchaseDebtFor(property, loans)
    const derivedInitialCapital = Math.max(0, purchasePrice - purchaseDebt.amount)
    const manualInitial = normalizedManual.find((event) => event.propertyId === propertyId && event.type === 'initial_capital') || null
    const initialCapital = manualInitial ? Math.abs(manualInitial.amount) : derivedInitialCapital
    basisByProperty.set(propertyId, {
      propertyId,
      initialCapital,
      initialDebt: Math.max(0, purchasePrice - initialCapital),
      source: manualInitial ? 'recorded' : 'estimated',
      purchaseDebtConfidence: purchaseDebt.confidence,
    })

    if (purchaseDate && purchasePrice) {
      events.push({
        id: `performance:purchase:${propertyId}:${purchaseDate}`,
        propertyId,
        occurredAt: purchaseDate,
        type: 'purchase',
        category: 'value',
        title: 'Property purchased',
        details: `Purchase price £${Math.round(purchasePrice).toLocaleString('en-GB')}`,
        amount: 0,
        assetValue: purchasePrice,
        debtValue: Math.max(0, purchasePrice - initialCapital),
        sourceType: 'property',
        sourceId: propertyId,
        actual: true,
        estimated: !manualInitial,
      })
      if (!manualInitialProperties.has(propertyId) && initialCapital > 0) {
        events.push({
          id: `performance:capital-basis:${propertyId}:${purchaseDate}`,
          propertyId,
          occurredAt: purchaseDate,
          type: 'initial_capital',
          category: 'capital',
          title: 'Initial cash invested',
          details: 'Estimated from purchase price less the recorded/current mortgage basis. Replace this with the actual cash invested for an exact return.',
          amount: -initialCapital,
          sourceType: 'derived-capital-basis',
          sourceId: propertyId,
          actual: true,
          estimated: true,
        })
      }
    }

    if (currentValue || currentDebt) {
      events.push({
        id: `performance:current:${propertyId}:${today}`,
        propertyId,
        occurredAt: today,
        type: 'current_snapshot',
        category: 'value',
        title: 'Current position',
        details: 'Latest property value and mortgage balance',
        amount: 0,
        assetValue: currentValue,
        debtValue: currentDebt,
        rentValue: nonNegative(property?.rent),
        sourceType: 'current-state',
        sourceId: propertyId,
        actual: true,
        estimated: false,
      })
    }
  }

  for (const expense of Array.isArray(expenses) ? expenses : []) {
    const occurredAt = dateOnly(expense?.date)
    const amount = finite(expense?.amount, NaN)
    if (!occurredAt || !Number.isFinite(amount) || !amount) continue
    events.push({
      id: `performance:expense:${clean(expense?.id) || makeId('expense')}`,
      propertyId: expensePropertyId(expense, properties),
      occurredAt,
      type: amount > 0 ? 'income' : 'cost',
      category: amount > 0 ? 'income' : 'cost',
      title: expenseTitle(expense),
      details: [clean(expense?.category), clean(expense?.notes)].filter(Boolean).join(' · '),
      amount: roundMoney(amount),
      sourceType: 'expense',
      sourceId: clean(expense?.id),
      actual: true,
      estimated: false,
    })
  }

  for (const event of Array.isArray(timelineEvents) ? timelineEvents : []) {
    const occurredAt = dateOnly(event?.occurredAt)
    if (!occurredAt || !financialTimelineEvent(event)) continue
    const afterValuation = event.sourceField === 'latestValuation' ? timelineAmount(event, 'after') : null
    const loanAfter = event.sourceType === 'loan-change' ? event.after : null
    events.push({
      id: `performance:timeline:${clean(event?.id) || makeId('timeline')}`,
      propertyId: clean(event?.propertyId),
      occurredAt,
      type: event.sourceField === 'rent' ? 'rent_change' : event.sourceField === 'latestValuation' ? 'valuation' : 'financing',
      category: event.sourceField === 'rent' ? 'income' : event.sourceField === 'latestValuation' ? 'value' : 'finance',
      title: clean(event?.title) || 'Financial change',
      details: clean(event?.details),
      amount: 0,
      assetValue: afterValuation == null ? null : nonNegative(afterValuation),
      debtValue: loanAfter && Number.isFinite(Number(loanAfter.loanAmount)) ? nonNegative(loanAfter.loanAmount) : null,
      rentBefore: event.sourceField === 'rent' && Number.isFinite(Number(event.before)) ? nonNegative(event.before) : null,
      rentValue: event.sourceField === 'rent' && Number.isFinite(Number(event.after)) ? nonNegative(event.after) : null,
      sourceType: 'timeline',
      sourceId: clean(event?.id),
      actual: true,
      estimated: false,
    })
  }

  for (const event of normalizedManual) {
    events.push({
      ...event,
      category: ['initial_capital', 'acquisition_cost', 'tax'].includes(event.type) ? 'cost' : event.type === 'refinance_cash' ? 'finance' : event.amount >= 0 ? 'income' : 'cost',
      title: event.title || eventType(event.type).label,
      details: event.notes,
      actual: true,
      estimated: false,
    })
  }

  return { events, basisByProperty }
}

const scopedProperties = (properties, scope) => scope === 'portfolio'
  ? (properties || []).filter((property) => property?.active !== false)
  : (properties || []).filter((property) => clean(property?.id) === clean(scope))

const scopedEvents = (events, scope) => scope === 'portfolio'
  ? events
  : events.filter((event) => event.propertyId === scope)

const cashFlowForXirr = (event) => finite(event?.amount)

const npv = (rate, cashflows) => {
  if (rate <= -1) return Number.POSITIVE_INFINITY
  const first = utcDate(cashflows[0]?.date)
  if (!first) return NaN
  return cashflows.reduce((total, flow) => {
    const date = utcDate(flow.date)
    if (!date) return total
    const years = (date - first) / MS_YEAR
    return total + finite(flow.amount) / ((1 + rate) ** years)
  }, 0)
}

export const xirr = (cashflows) => {
  const flows = (Array.isArray(cashflows) ? cashflows : [])
    .map((flow) => ({ date: dateOnly(flow?.date), amount: finite(flow?.amount, NaN) }))
    .filter((flow) => flow.date && Number.isFinite(flow.amount) && flow.amount !== 0)
    .sort((left, right) => left.date.localeCompare(right.date))
  if (flows.length < 2 || !flows.some((flow) => flow.amount < 0) || !flows.some((flow) => flow.amount > 0)) return null

  const candidates = [-0.9999, -0.99, -0.9, -0.75, -0.5, -0.25, 0, 0.03, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]
  let left = candidates[0]
  let leftValue = npv(left, flows)
  for (let index = 1; index < candidates.length; index += 1) {
    const right = candidates[index]
    const rightValue = npv(right, flows)
    if (Math.abs(rightValue) < 1e-7) return right
    if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && Math.sign(leftValue) !== Math.sign(rightValue)) {
      let low = left
      let high = right
      let lowValue = leftValue
      for (let step = 0; step < 120; step += 1) {
        const mid = (low + high) / 2
        const midValue = npv(mid, flows)
        if (!Number.isFinite(midValue)) break
        if (Math.abs(midValue) < 1e-7) return mid
        if (Math.sign(midValue) === Math.sign(lowValue)) {
          low = mid
          lowValue = midValue
        } else high = mid
      }
      return (low + high) / 2
    }
    left = right
    leftValue = rightValue
  }
  return null
}

const latestKnownValue = (events, property, key, basis, today) => {
  if (key === 'assetValue') return nonNegative(property?.latestValuation)
  if (key === 'debtValue') return nonNegative(property?.loanAmount)
  return 0
}

const activePropertyIdsAt = (properties, date) => new Set((properties || [])
  .filter((property) => {
    const purchaseDate = dateOnly(property?.purchaseDate)
    return !purchaseDate || purchaseDate <= date
  })
  .map((property) => clean(property?.id)))

const performancePoint = ({ date, properties, state, cash, operatingNet, costs }) => {
  const activeIds = activePropertyIdsAt(properties, date)
  const activeStates = [...state.entries()].filter(([propertyId]) => activeIds.has(propertyId)).map(([, value]) => value)
  const assetValue = activeStates.reduce((sum, item) => sum + finite(item.value), 0)
  const debt = activeStates.reduce((sum, item) => sum + finite(item.debt), 0)
  const equity = assetValue - debt
  const activeProperties = properties.filter((property) => activeIds.has(clean(property.id)))
  const rentKnown = activeProperties.every((property) => hasNumber(state.get(clean(property.id))?.rent))
  const monthlyRent = rentKnown && activeProperties.length
    ? activeProperties.reduce((sum, property) => sum + finite(state.get(clean(property.id))?.rent), 0)
    : null
  const purchaseBasis = activeProperties.reduce((sum, property) => sum + nonNegative(property?.purchasePrice), 0)
  return {
    date,
    assetValue,
    debt,
    equity,
    monthlyRent,
    cumulativeNetIncome: operatingNet.value,
    cumulativeCosts: costs.value,
    cumulativeAppreciation: assetValue - purchaseBasis,
    netCash: cash.value,
    wealth: equity + cash.value,
    actual: true,
  }
}

const buildActualPoints = ({ properties, events, basisByProperty, today }) => {
  const sortedEvents = [...events]
    .filter((event) => event.occurredAt <= today)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.title.localeCompare(right.title))
  const dates = [...new Set(sortedEvents.map((event) => event.occurredAt))].sort()
  if (!dates.includes(today)) dates.push(today)
  const state = new Map()
  const cash = { value: 0 }
  const operatingNet = { value: 0 }
  const costs = { value: 0 }
  const points = []

  for (const date of dates.sort()) {
    const eventsOnDate = sortedEvents.filter((candidate) => candidate.occurredAt === date)
    const rentBeforeEvents = eventsOnDate.filter((event) => event.type === 'rent_change' && Number.isFinite(Number(event.rentBefore)))
    if (rentBeforeEvents.length) {
      for (const event of rentBeforeEvents) {
        const current = state.get(event.propertyId) || { value: 0, debt: 0, rent: null }
        if (!hasNumber(current.rent)) current.rent = nonNegative(event.rentBefore)
        state.set(event.propertyId, current)
      }
      points.push({ ...performancePoint({ date, properties, state, cash, operatingNet, costs }), phase: 'before-change' })
    }

    for (const event of eventsOnDate) {
      if (event.propertyId) {
        const current = state.get(event.propertyId) || { value: 0, debt: 0, rent: null }
        if (hasNumber(event.assetValue)) current.value = nonNegative(event.assetValue)
        if (hasNumber(event.debtValue)) current.debt = nonNegative(event.debtValue)
        if (hasNumber(event.rentValue)) current.rent = nonNegative(event.rentValue)
        state.set(event.propertyId, current)
      }
      const amount = finite(event.amount)
      cash.value += amount
      if (event.sourceType === 'expense') operatingNet.value += amount
      if (amount < 0 && event.type !== 'initial_capital') costs.value += Math.abs(amount)
    }

    if (date === today) {
      for (const property of properties) {
        const current = state.get(clean(property.id)) || { value: 0, debt: 0, rent: null }
        current.value = latestKnownValue(events, property, 'assetValue', basisByProperty.get(clean(property.id)), today)
        current.debt = latestKnownValue(events, property, 'debtValue', basisByProperty.get(clean(property.id)), today)
        current.rent = nonNegative(property?.rent)
        state.set(clean(property.id), current)
      }
    }
    points.push(performancePoint({ date, properties, state, cash, operatingNet, costs }))
  }
  return points
}

const repaymentBalanceAtMonth = (property, month, settings) => {
  const starting = nonNegative(property?.loanAmount)
  if (!starting || property?.mortgageInterestOnly !== false || month <= 0) return starting
  const annualRate = Math.max(0, finite(property?.baseRate) + finite(settings?.rateShock))
  const monthlyRate = annualRate / 12
  const term = Math.max(1, Math.round(finite(property?.mortgageTermMonths, 300)))
  const payment = monthlyRate ? starting * monthlyRate / (1 - ((1 + monthlyRate) ** -term)) : starting / term
  let balance = starting
  for (let index = 0; index < Math.min(month, term) && balance > 0; index += 1) {
    const interest = balance * monthlyRate
    balance = Math.max(0, balance - Math.max(0, payment - interest))
  }
  return balance
}

const projectedPropertyAtMonth = (property, month, settings) => {
  const appreciation = Math.max(-0.99, finite(settings?.appreciationRate))
  const rentGrowth = Math.max(-0.99, finite(settings?.rentGrowthRate))
  const years = month / 12
  const value = nonNegative(property?.latestValuation) * ((1 + appreciation) ** years)
  const debt = repaymentBalanceAtMonth(property, month, settings)
  const currentRent = nonNegative(property?.rent)
  const rent = currentRent * ((1 + rentGrowth) ** years)
  const managementShare = settings?.fullyManaged ? Math.max(0, finite(settings?.managementRate)) : 0
  const rentDeltaContribution = (rent - currentRent) * (1 - managementShare)
  const netCash = finite(property?.operatingCashflow) + rentDeltaContribution
  return { value, debt, equity: value - debt, rent, netCash }
}

const projectionFor = ({ properties, settings, actualEvents, currentNetCash, today, horizonYears }) => {
  const months = Math.max(1, Math.round(horizonYears * 12))
  const points = []
  let projectedCash = currentNetCash
  let projectedOperatingNet = actualEvents
    .filter((event) => event.sourceType === 'expense')
    .reduce((sum, event) => sum + finite(event.amount), 0)
  let projectedCosts = actualEvents
    .filter((event) => finite(event.amount) < 0 && event.type !== 'initial_capital')
    .reduce((sum, event) => sum + Math.abs(finite(event.amount)), 0)
  const projectedFlows = actualEvents.filter((event) => event.amount).map((event) => ({ date: event.occurredAt, amount: event.amount }))
  const purchaseBasis = properties.reduce((sum, property) => sum + nonNegative(property?.purchasePrice), 0)
  let finalAnnualRent = 0
  let finalAnnualCash = 0
  for (let month = 1; month <= months; month += 1) {
    const propertiesAtMonth = properties.map((property) => projectedPropertyAtMonth(property, month, settings))
    const monthCash = propertiesAtMonth.reduce((sum, property) => sum + property.netCash, 0)
    const monthRent = propertiesAtMonth.reduce((sum, property) => sum + property.rent, 0)
    const monthCosts = propertiesAtMonth.reduce((sum, property) => sum + Math.max(0, property.rent - property.netCash), 0)
    projectedCash += monthCash
    projectedOperatingNet += monthCash
    projectedCosts += monthCosts
    const date = addMonths(today, month)
    projectedFlows.push({ date, amount: monthCash })
    if (month === months) {
      finalAnnualRent = monthRent * 12
      finalAnnualCash = monthCash * 12
    }
    const assetValue = propertiesAtMonth.reduce((sum, property) => sum + property.value, 0)
    const debt = propertiesAtMonth.reduce((sum, property) => sum + property.debt, 0)
    const equity = assetValue - debt
    points.push({
      date,
      assetValue,
      debt,
      equity,
      monthlyRent: monthRent,
      cumulativeNetIncome: projectedOperatingNet,
      cumulativeCosts: projectedCosts,
      cumulativeAppreciation: assetValue - purchaseBasis,
      netCash: projectedCash,
      wealth: equity + projectedCash,
      actual: false,
    })
  }
  const terminal = points.at(-1) || { assetValue: 0, debt: 0, equity: 0, wealth: 0, date: addMonths(today, months) }
  projectedFlows.push({ date: terminal.date, amount: terminal.equity })
  return {
    points,
    summary: {
      horizonYears,
      propertyValue: terminal.assetValue,
      debt: terminal.debt,
      equity: terminal.equity,
      annualRent: finalAnnualRent,
      annualNetCashflow: finalAnnualCash,
      monthlyRent: terminal.monthlyRent || 0,
      cumulativeCosts: terminal.cumulativeCosts || 0,
      cumulativeNetIncome: terminal.cumulativeNetIncome || 0,
      cumulativeAppreciation: terminal.cumulativeAppreciation || 0,
      wealthCreated: terminal.wealth,
      annualisedReturn: xirr(projectedFlows),
    },
  }
}

const earliestPurchase = (properties) => (properties || []).map((property) => dateOnly(property?.purchaseDate)).filter(Boolean).sort()[0] || ''
const propertyCagr = (property, today) => {
  const purchaseDate = utcDate(property?.purchaseDate)
  const currentDate = utcDate(today)
  const purchaseValue = nonNegative(property?.purchasePrice)
  const currentValue = nonNegative(property?.latestValuation)
  if (!purchaseDate || !currentDate || !purchaseValue || !currentValue || currentDate <= purchaseDate) return null
  const years = (currentDate - purchaseDate) / MS_YEAR
  return (currentValue / purchaseValue) ** (1 / years) - 1
}

const rentCagr = (property, events, today) => {
  const changes = events.filter((event) => event.propertyId === property.id && event.type === 'rent_change')
  if (!changes.length) return null
  const first = changes.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))[0]
  const timeline = (first?.details || '').match(/£?([\d,.]+)\s*→/)
  const initialRent = timeline ? Number(timeline[1].replace(/,/g, '')) : NaN
  const currentRent = nonNegative(property?.rent)
  const from = utcDate(first.occurredAt)
  const to = utcDate(today)
  if (!Number.isFinite(initialRent) || initialRent <= 0 || !currentRent || !from || !to || to <= from) return null
  const years = (to - from) / MS_YEAR
  return (currentRent / initialRent) ** (1 / years) - 1
}

const classifyOtherCash = (event) => event.type !== 'initial_capital' && finite(event.amount)

const returnBreakdown = ({ properties, events, basisByProperty }) => {
  const appreciation = properties.reduce((sum, property) => sum + nonNegative(property?.latestValuation) - nonNegative(property?.purchasePrice), 0)
  const debtChange = properties.reduce((sum, property) => {
    const basis = basisByProperty.get(clean(property?.id))
    return sum + finite(basis?.initialDebt) - nonNegative(property?.loanAmount)
  }, 0)
  const income = events.filter((event) => classifyOtherCash(event) && event.amount > 0 && event.type !== 'refinance_cash').reduce((sum, event) => sum + event.amount, 0)
  const refinance = events.filter((event) => event.type === 'refinance_cash').reduce((sum, event) => sum + event.amount, 0)
  const costs = events.filter((event) => classifyOtherCash(event) && event.amount < 0).reduce((sum, event) => sum + event.amount, 0)
  return [
    { key: 'appreciation', label: 'Property appreciation', amount: appreciation },
    { key: 'income', label: 'Net cash income received', amount: income },
    { key: 'costs', label: 'Costs, tax & fees', amount: costs },
    { key: 'debt', label: 'Mortgage principal change', amount: debtChange },
    ...(Math.abs(refinance) >= 0.005 ? [{ key: 'refinance', label: 'Refinance cash released', amount: refinance }] : []),
  ]
}

const cashBuckets = (events, projectionPoints, currentNetCash) => {
  const buckets = new Map()
  for (const event of events) {
    if (!event.amount || event.type === 'initial_capital') continue
    const year = event.occurredAt.slice(0, 4)
    const bucket = buckets.get(year) || { label: year, actual: true, amount: 0 }
    bucket.amount += event.amount
    buckets.set(year, bucket)
  }
  let previous = currentNetCash
  for (const point of projectionPoints) {
    const year = point.date.slice(0, 4)
    const delta = point.netCash - previous
    previous = point.netCash
    const bucket = buckets.get(year) || { label: year, actual: false, amount: 0 }
    if (!bucket.actual) bucket.amount += delta
    else if (point.actual === false) {
      const projectedKey = `${year} projected`
      const projected = buckets.get(projectedKey) || { label: year, actual: false, amount: 0 }
      projected.amount += delta
      buckets.set(projectedKey, projected)
      continue
    }
    buckets.set(year, bucket)
  }
  return [...buckets.values()].sort((left, right) => left.label.localeCompare(right.label) || Number(right.actual) - Number(left.actual))
}

export const buildPerformanceModel = ({
  properties = [], loans = [], expenses = [], timelineEvents = [], performanceEvents = [], settings = {}, scope = 'portfolio', horizonYears = 10, now = new Date(),
} = {}) => {
  const today = todayDate(now)
  const selectedProperties = scopedProperties(properties, scope)
  const selectedIds = new Set(selectedProperties.map((property) => clean(property.id)))
  const raw = buildRawEvents({ properties, loans, expenses, timelineEvents, performanceEvents, now })
  const allEvents = raw.events.filter((event) => event.occurredAt <= today)
  const events = scopedEvents(allEvents, scope)
    .filter((event) => scope === 'portfolio' ? (!event.propertyId || selectedIds.has(event.propertyId)) : selectedIds.has(event.propertyId))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.title.localeCompare(right.title))
  let runningCash = 0
  const eventsWithRunning = events.map((event) => {
    runningCash += finite(event.amount)
    return { ...event, runningCash }
  })
  const currentValue = selectedProperties.reduce((sum, property) => sum + nonNegative(property.latestValuation), 0)
  const currentDebt = selectedProperties.reduce((sum, property) => sum + nonNegative(property.loanAmount), 0)
  const currentEquity = currentValue - currentDebt
  const cashflows = events.filter((event) => event.amount).map((event) => ({ date: event.occurredAt, amount: cashFlowForXirr(event) }))
  if (currentEquity) cashflows.push({ date: today, amount: currentEquity })
  const annualisedReturn = xirr(cashflows)
  const netCash = events.reduce((sum, event) => sum + finite(event.amount), 0)
  const operatingNetIncome = events.filter((event) => event.sourceType === 'expense').reduce((sum, event) => sum + finite(event.amount), 0)
  const recordedCosts = events.filter((event) => finite(event.amount) < 0 && event.type !== 'initial_capital').reduce((sum, event) => sum + Math.abs(finite(event.amount)), 0)
  const currentMonthlyRent = selectedProperties.reduce((sum, property) => sum + nonNegative(property.rent), 0)
  const appreciationGain = selectedProperties.reduce((sum, property) => sum + nonNegative(property.latestValuation) - nonNegative(property.purchasePrice), 0)
  const wealthCreated = currentEquity + netCash
  const cashOut = Math.abs(events.filter((event) => event.amount < 0).reduce((sum, event) => sum + event.amount, 0))
  const cashIn = events.filter((event) => event.amount > 0).reduce((sum, event) => sum + event.amount, 0)
  const moic = cashOut > 0 ? (currentEquity + cashIn) / cashOut : null
  const roi = cashOut > 0 ? wealthCreated / cashOut : null
  const actualPoints = buildActualPoints({ properties: selectedProperties, events, basisByProperty: raw.basisByProperty, today })
  const projection = projectionFor({ properties: selectedProperties, settings, actualEvents: events, currentNetCash: netCash, today, horizonYears })
  const property = selectedProperties.length === 1 ? selectedProperties[0] : null
  const valuationCagr = property ? propertyCagr(property, today) : null
  const rentalCagr = property ? rentCagr(property, events, today) : null
  const estimatedBasisCount = selectedProperties.filter((item) => raw.basisByProperty.get(clean(item.id))?.source !== 'recorded').length
  const actualCashEntries = events.filter((event) => event.sourceType === 'expense').length
  const missingPurchase = selectedProperties.filter((item) => !dateOnly(item.purchaseDate) || !nonNegative(item.purchasePrice)).length
  const missingValuation = selectedProperties.filter((item) => !nonNegative(item.latestValuation)).length
  const warnings = []
  if (estimatedBasisCount) warnings.push(`${estimatedBasisCount} ${estimatedBasisCount === 1 ? 'property uses' : 'properties use'} an estimated initial cash basis. Add the actual initial cash invested to make annualised return exact.`)
  if (!actualCashEntries) warnings.push('No dated income or cost entries are available. Historical cash return currently excludes rent and operating costs until they are recorded in Documents & Expenses.')
  if (missingPurchase) warnings.push(`${missingPurchase} ${missingPurchase === 1 ? 'property is' : 'properties are'} missing a purchase date or purchase price.`)
  if (missingValuation) warnings.push(`${missingValuation} ${missingValuation === 1 ? 'property is' : 'properties are'} missing a current valuation.`)
  const breakdown = returnBreakdown({ properties: selectedProperties, events, basisByProperty: raw.basisByProperty })
  const breakdownTotal = breakdown.reduce((sum, item) => sum + item.amount, 0)
  const earliest = earliestPurchase(selectedProperties)

  return {
    scope,
    today,
    properties: selectedProperties,
    events: [...eventsWithRunning].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.title.localeCompare(left.title)),
    actualPoints,
    projectionPoints: projection.points,
    cashBuckets: cashBuckets(events, projection.points, netCash),
    breakdown,
    breakdownTotal,
    metrics: {
      annualisedReturn,
      wealthCreated,
      currentValue,
      currentDebt,
      currentEquity,
      cashReturned: cashIn,
      cashInvested: cashOut,
      netCash,
      operatingNetIncome,
      recordedCosts,
      currentMonthlyRent,
      appreciationGain,
      moic,
      roi,
      valuationCagr,
      rentalCagr,
      since: earliest,
      capitalBasis: estimatedBasisCount ? 'estimated' : 'recorded',
      actualCashEntries,
    },
    projection: projection.summary,
    warnings,
  }
}
