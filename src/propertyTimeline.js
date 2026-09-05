import { normalizeDocumentMeta } from './documents.js'
import { inferExpenseType } from './expenses.js'
import { complianceDiaryItems, dateOnly, daysBetweenDateOnly } from './notifications.js'

const clean = (value) => String(value ?? '').trim()
const makeId = (prefix = 'timeline') => globalThis.crypto?.randomUUID?.()
  || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
const todayDate = (now = new Date()) => dateOnly(now)
const CATEGORY_IDS = new Set(['compliance', 'tenancy', 'finance', 'maintenance', 'other'])

export const TIMELINE_FILTERS = [
  ['all', 'All'],
  ['compliance', 'Compliance'],
  ['tenancy', 'Tenancy'],
  ['finance', 'Finance'],
  ['maintenance', 'Maintenance'],
]

export const MANUAL_EVENT_TYPES = [
  { id: 'maintenance', label: 'Maintenance / repair', category: 'maintenance' },
  { id: 'improvement', label: 'Improvement', category: 'maintenance' },
  { id: 'inspection', label: 'Inspection / visit', category: 'compliance' },
  { id: 'incident', label: 'Incident', category: 'maintenance' },
  { id: 'note', label: 'General note', category: 'other' },
]

const manualType = (value) => MANUAL_EVENT_TYPES.find((item) => item.id === value) || MANUAL_EVENT_TYPES[0]
const finiteOrBlank = (value) => {
  if (value === '' || value == null) return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : ''
}
const numberEqual = (left, right) => {
  const a = Number(left)
  const b = Number(right)
  if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) < 0.005
  return clean(left) === clean(right)
}
const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(value || 0))
const dateValue = (value) => dateOnly(value)
const dueChangeText = (before, after) => {
  const oldDate = dateValue(before)
  const newDate = dateValue(after)
  if (!oldDate && newDate) return `Due date set to ${newDate}`
  if (oldDate && !newDate) return `Due date cleared (was ${oldDate})`
  return `${oldDate} → ${newDate}`
}

export const normalizeTimelineEvent = (event = {}) => {
  const propertyId = clean(event.propertyId)
  const occurredAt = dateValue(event.occurredAt || event.date)
  const kind = event.kind === 'change' ? 'change' : 'manual'
  const selectedManualType = manualType(event.manualType)
  const category = CATEGORY_IDS.has(event.category)
    ? event.category
    : kind === 'manual' ? selectedManualType.category : 'other'
  const title = clean(event.title)
  if (!propertyId || !occurredAt || !title) return null
  return {
    id: clean(event.id) || makeId(kind === 'change' ? 'timeline-change' : 'timeline-manual'),
    propertyId,
    kind,
    manualType: kind === 'manual' ? selectedManualType.id : '',
    category,
    occurredAt,
    title,
    details: clean(event.details || event.notes),
    amount: finiteOrBlank(event.amount),
    contractorId: clean(event.contractorId),
    sourceType: clean(event.sourceType) || (kind === 'manual' ? 'manual' : 'property-change'),
    sourceId: clean(event.sourceId),
    sourceField: clean(event.sourceField),
    before: event.before ?? null,
    after: event.after ?? null,
    major: Boolean(event.major),
    createdAt: clean(event.createdAt) || new Date().toISOString(),
  }
}

export const normalizePropertyTimelineEvents = (events, properties = []) => {
  const propertyIds = new Set((properties || []).map((property) => clean(property.id)).filter(Boolean))
  return (Array.isArray(events) ? events : [])
    .map(normalizeTimelineEvent)
    .filter((event) => event && propertyIds.has(event.propertyId))
}

export const createManualTimelineEvent = (propertyId, overrides = {}, now = new Date()) => ({
  id: makeId('timeline-manual'),
  propertyId: clean(propertyId),
  kind: 'manual',
  manualType: 'maintenance',
  category: 'maintenance',
  occurredAt: todayDate(now),
  title: '',
  details: '',
  amount: '',
  contractorId: '',
  sourceType: 'manual',
  sourceId: '',
  sourceField: '',
  major: false,
  createdAt: new Date().toISOString(),
  ...overrides,
})

const makeChangeEvent = ({ propertyId, occurredAt, category, title, details, sourceField, before, after, sourceType = 'property-change', sourceId = '', major = false }) => normalizeTimelineEvent({
  id: makeId('timeline-change'),
  propertyId,
  kind: 'change',
  category,
  occurredAt,
  title,
  details,
  sourceType,
  sourceId,
  sourceField,
  before,
  after,
  major,
})

const trackedPropertyChanges = [
  ['rent', 'finance', 'Rent changed', (before, after) => `${money(before)} → ${money(after)} / month`],
  ['latestValuation', 'finance', 'Property valuation updated', (before, after) => `${money(before)} → ${money(after)}`],
  ['gasExpiry', 'compliance', 'Gas certificate date updated', dueChangeText],
  ['eicrExpiry', 'compliance', 'EICR date updated', dueChangeText],
  ['patExpiry', 'compliance', 'PAT testing date updated', dueChangeText],
  ['epcExpiry', 'compliance', 'EPC date updated', dueChangeText],
]

export const propertyChangeEvents = (beforeProperty, afterProperty, now = new Date()) => {
  if (!beforeProperty || !afterProperty || clean(beforeProperty.id) !== clean(afterProperty.id)) return []
  const occurredAt = todayDate(now)
  return trackedPropertyChanges.flatMap(([field, category, title, describe]) => {
    const before = beforeProperty[field]
    const after = afterProperty[field]
    const equal = field === 'rent' || field === 'latestValuation' ? numberEqual(before, after) : dateValue(before) === dateValue(after)
    if (equal) return []
    return [makeChangeEvent({
      propertyId: clean(afterProperty.id),
      occurredAt,
      category,
      title,
      details: describe(before, after),
      sourceField: field,
      before,
      after,
    })].filter(Boolean)
  })
}

const loanSnapshot = (loan) => loan ? ({
  id: clean(loan.id),
  lender: clean(loan.lender),
  loanAmount: Number(loan.loanAmount || 0),
  principalAmount: Number(loan.principalAmount || loan.loanAmount || 0),
  rate: Number(loan.rate || 0),
  fixedRateMonths: Number(loan.fixedRateMonths || 0),
  fixedStartDate: dateValue(loan.fixedStartDate),
  feeMode: clean(loan.feeMode),
  feeValue: Number(loan.feeValue || 0),
  addFeeToLoan: Boolean(loan.addFeeToLoan),
  interestOnly: loan.interestOnly !== false,
  ltvBand: Number(loan.ltvBand || 0),
}) : null

const loanSummary = (loan) => {
  if (!loan) return 'No mortgage recorded'
  return [
    clean(loan.lender),
    Number(loan.loanAmount || 0) ? money(loan.loanAmount) : '',
    Number(loan.rate || 0) ? `${(Number(loan.rate) * 100).toFixed(2)}%` : '',
  ].filter(Boolean).join(' · ')
}

export const loanChangeEvents = (beforeLoan, afterLoan, propertyId, now = new Date()) => {
  const before = loanSnapshot(beforeLoan)
  const after = loanSnapshot(afterLoan)
  if (!after || !clean(propertyId)) return []
  if (!before) {
    if (after.fixedStartDate) return []
    const event = makeChangeEvent({
      propertyId,
      occurredAt: todayDate(now),
      category: 'finance',
      title: 'Mortgage added',
      details: loanSummary(after),
      sourceType: 'loan-change',
      sourceId: after.id,
      before: null,
      after,
      major: true,
    })
    return event ? [event] : []
  }

  const keys = ['lender', 'loanAmount', 'rate', 'fixedRateMonths', 'fixedStartDate', 'feeMode', 'feeValue', 'addFeeToLoan', 'interestOnly', 'ltvBand']
  const changed = keys.some((key) => ['loanAmount', 'rate', 'fixedRateMonths', 'feeValue', 'ltvBand'].includes(key)
    ? !numberEqual(before[key], after[key])
    : before[key] !== after[key])
  if (!changed) return []
  const refinanced = before.fixedStartDate !== after.fixedStartDate && Boolean(after.fixedStartDate)
  const event = makeChangeEvent({
    propertyId,
    occurredAt: refinanced ? after.fixedStartDate : todayDate(now),
    category: 'finance',
    title: refinanced ? 'Mortgage refinanced' : 'Mortgage updated',
    details: `${loanSummary(before)} → ${loanSummary(after)}`,
    sourceType: 'loan-change',
    sourceId: after.id || before.id,
    before,
    after,
    major: true,
  })
  return event ? [event] : []
}

const propertyLinkedExpense = (entry, property) => {
  const document = normalizeDocumentMeta(entry?.document)
  if (document?.association.kind === 'property') return clean(document.association.id) === clean(property.id)
  return clean(entry?.property).toLowerCase() === clean(property.name).toLowerCase()
}

const expenseCategory = (entry, document) => {
  const text = [entry?.category, entry?.description, entry?.notes, document?.title, document?.type, ...(document?.tagIds || [])]
    .map(clean).join(' ').toLowerCase()
  if (document?.type === 'Compliance certificate' || /\b(gas|eicr|pat|epc|legionella|compliance|certificate|inspection)\b/.test(text)) return 'compliance'
  if (/\b(repair|maintenance|boiler|plumb|electric|handyman|install|roof|decor|appliance|leak|heating)\b/.test(text)) return 'maintenance'
  return 'finance'
}

const expenseTitle = (entry, document) => clean(entry?.description)
  || clean(document?.title)
  || clean(entry?.category)
  || (inferExpenseType(entry?.amount) === 'income' ? 'Income recorded' : 'Expense recorded')

const currentLoanEvent = (loan, storedEvents, today) => {
  const occurredAt = dateValue(loan?.fixedStartDate)
  if (!occurredAt || occurredAt > today) return null
  const sourceId = clean(loan.id)
  const superseded = storedEvents.some((event) => event.sourceType === 'loan-change' && event.sourceId === sourceId && event.occurredAt === occurredAt)
  if (superseded) return null
  return {
    id: `loan:${sourceId}:${occurredAt}`,
    propertyId: clean(loan.propertyId),
    category: 'finance',
    occurredAt,
    title: 'Mortgage / refinance started',
    details: loanSummary(loan),
    amount: '',
    contractorId: '',
    sourceType: 'loan',
    sourceId,
    sourceField: '',
    major: true,
  }
}

const historySort = (left, right) => right.occurredAt.localeCompare(left.occurredAt)
  || Number(Boolean(right.major)) - Number(Boolean(left.major))
  || left.title.localeCompare(right.title)

export const buildPropertyTimeline = ({ property, loans = [], tenants = [], contractors = [], expenses = [], timelineEvents = [], now = new Date() } = {}) => {
  if (!property?.id) return { upcoming: [], history: [] }
  const propertyId = clean(property.id)
  const today = todayDate(now)
  const stored = normalizePropertyTimelineEvents(timelineEvents, [property]).filter((event) => event.occurredAt <= today)
  const history = [...stored]

  const purchaseDate = dateValue(property.purchaseDate)
  if (purchaseDate && purchaseDate <= today) history.push({
    id: `property:${propertyId}:purchase:${purchaseDate}`,
    propertyId,
    category: 'finance',
    occurredAt: purchaseDate,
    title: 'Property purchased',
    details: Number(property.purchasePrice || 0) ? `Purchase price ${money(property.purchasePrice)}` : '',
    amount: Number(property.purchasePrice || 0) || '',
    contractorId: '',
    sourceType: 'property',
    sourceId: propertyId,
    sourceField: 'purchasePrice',
    major: true,
  })

  for (const loan of loans.filter((item) => clean(item.propertyId) === propertyId)) {
    const event = currentLoanEvent(loan, stored, today)
    if (event) history.push(event)
  }

  for (const tenant of tenants.filter((item) => clean(item.propertyId) === propertyId)) {
    const moveIn = dateValue(tenant.moveIn)
    const moveOut = dateValue(tenant.moveOut)
    if (moveIn && moveIn <= today) history.push({
      id: `tenant:${tenant.id}:in:${moveIn}`,
      propertyId,
      category: 'tenancy',
      occurredAt: moveIn,
      title: 'Tenant moved in',
      details: clean(tenant.name),
      amount: '', contractorId: '', sourceType: 'tenant', sourceId: clean(tenant.id), sourceField: '', major: false,
    })
    if (moveOut && moveOut <= today) history.push({
      id: `tenant:${tenant.id}:out:${moveOut}`,
      propertyId,
      category: 'tenancy',
      occurredAt: moveOut,
      title: 'Tenant moved out',
      details: clean(tenant.name),
      amount: '', contractorId: '', sourceType: 'tenant', sourceId: clean(tenant.id), sourceField: '', major: false,
    })
  }

  for (const entry of expenses.filter((item) => propertyLinkedExpense(item, property))) {
    const occurredAt = dateValue(entry.date)
    if (!occurredAt || occurredAt > today) continue
    const document = normalizeDocumentMeta(entry.document)
    const sourceType = document && (document.storagePath || document.title) ? 'document' : 'expense'
    history.push({
      id: `expense:${clean(entry.id) || `${occurredAt}:${clean(entry.description)}`}`,
      propertyId,
      category: expenseCategory(entry, document),
      occurredAt,
      title: expenseTitle(entry, document),
      details: clean(entry.notes) || clean(document?.type),
      amount: finiteOrBlank(entry.amount),
      contractorId: clean(document?.contractorId),
      sourceType,
      sourceId: clean(entry.id),
      sourceField: '',
      documentTitle: clean(document?.title),
      documentType: clean(document?.type),
      major: false,
    })
  }

  const diary = complianceDiaryItems([{ ...property, active: true }])
  const upcoming = diary.flatMap((item) => {
    if (!item.dueDate || item.dueDate < today) return []
    if (item.type === 'remortgage') {
      const windowOpen = item.displayDate <= today
      const date = windowOpen ? item.dueDate : item.displayDate
      return [{
        id: `upcoming:${item.key}`,
        category: 'finance',
        date,
        dueDate: item.dueDate,
        title: windowOpen ? 'Mortgage fix ends' : 'Remortgage window opens',
        details: windowOpen ? 'Remortgage window is open now' : `Current fix ends ${item.dueDate}`,
        daysUntil: daysBetweenDateOnly(today, date),
      }]
    }
    return [{
      id: `upcoming:${item.key}`,
      category: 'compliance',
      date: item.dueDate,
      dueDate: item.dueDate,
      title: `${item.label} due`,
      details: '',
      daysUntil: daysBetweenDateOnly(today, item.dueDate),
    }]
  })

  for (const tenant of tenants.filter((item) => clean(item.propertyId) === propertyId)) {
    const moveOut = dateValue(tenant.moveOut)
    if (moveOut && moveOut > today) upcoming.push({
      id: `upcoming:tenant:${tenant.id}:out:${moveOut}`,
      category: 'tenancy',
      date: moveOut,
      dueDate: moveOut,
      title: 'Tenant move-out',
      details: clean(tenant.name),
      daysUntil: daysBetweenDateOnly(today, moveOut),
    })
  }

  return {
    upcoming: upcoming.sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title)),
    history: history.sort(historySort),
  }
}

export const filterPropertyTimelineHistory = (history = [], filter = 'all') => filter === 'all'
  ? history
  : history.filter((event) => event.category === filter)
