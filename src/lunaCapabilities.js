import { createBlankProperty } from './data.js'
import {
  applyTenantToProperty,
  createTenant,
  removeTenantsForProperty,
  syncPropertyTenant,
  tenantBelongsToProperty,
} from './tenants.js'
import { createExpense, summarizeExpenses } from './expenses.js'
import {
  applyLoanToPortfolio,
  createBlankLoan,
  removeLoanFromPortfolio,
  removePropertyFromLoanPortfolio,
} from './loans.js'
import {
  DEFAULT_CONTRACTOR_TAGS,
  createBlankContractor,
  createCustomContractorTag,
  normalizeContractor,
  normalizeContractorTags,
} from './contractors.js'
import { normalizeTimelineEvent, propertyChangeEvents } from './propertyTimeline.js'

const clean = (value) => String(value ?? '').trim()
const lower = (value) => clean(value).toLowerCase()
const clone = (value) => structuredClone(value)

const array = (value) => Array.isArray(value) ? value : []

const STATE_ARRAYS = [
  'properties', 'loans', 'tenants', 'contractors', 'contractorTags',
  'propertyTimelineEvents', 'performanceEvents', 'expenses', 'credentials',
  'acquisitionScenarios', 'remortgageComparisons',
]

const ensureState = (raw = {}) => {
  const next = { ...raw, settings: { ...(raw.settings || {}) } }
  for (const key of STATE_ARRAYS) next[key] = array(raw[key])
  next.contractorTags = normalizeContractorTags(next.contractorTags)
  return next
}

export const LUNA_PHASE_ONE_OPERATIONS = [
  'portfolio.summary',
  'property.list',
  'property.get',
  'tenant.list',
  'tenant.get',
  'expense.list',
  'expense.get',
  'expense.summary',
  'loan.list',
  'loan.get',
  'contractor.list',
  'contractor.get',
  'settings.get',
  'company_cost.list',
  'extraction.list',
  'timeline.list',
  'performance_event.list',
  'acquisition.list',
  'remortgage.list',
  'notification_preferences.get',
  'property.create',
  'property.update',
  'property.clone',
  'property.set_active',
  'property.delete',
  'tenant.create',
  'tenant.update',
  'tenant.delete',
  'expense.create',
  'expense.update',
  'expense.delete',
  'loan.create',
  'loan.update',
  'loan.delete',
  'contractor.create',
  'contractor.update',
  'contractor.delete',
  'contractor_tag.create',
  'contractor_tag.update',
  'contractor_tag.delete',
  'settings.update',
  'company_cost.create',
  'company_cost.update',
  'company_cost.delete',
  'extraction.create',
  'extraction.update',
  'extraction.delete',
  'timeline.create',
  'timeline.update',
  'timeline.delete',
]

export const LUNA_DESTRUCTIVE_OPERATIONS = new Set([
  'property.delete',
  'tenant.delete',
  'expense.delete',
  'loan.delete',
  'contractor.delete',
  'contractor_tag.delete',
  'company_cost.delete',
  'extraction.delete',
  'timeline.delete',
])

const PROPERTY_FIELDS = new Set([
  'name', 'address', 'postcode', 'flatNumber', 'purchasePrice', 'homeReportPurchase',
  'latestValuation', 'areaSqm', 'bedrooms', 'epc', 'rent', 'purchaseDate',
  'factorsFees', 'repairs', 'applianceReserve', 'legionella', 'gasCertificate',
  'eicr', 'mortgageAdmin', 'voidsOverride', 'qualifyingFinanceBalance',
  'gasExpiry', 'eicrExpiry', 'epcExpiry', 'patExpiry',
  'tenantName', 'tenantEmail', 'tenantPhone', 'tenantOccupation',
  'tenantMoveIn', 'tenantMoveOut', 'depositHeld', 'active',
])

const TENANT_FIELDS = new Set([
  'propertyId', 'name', 'email', 'phone', 'occupation', 'moveIn', 'moveOut',
  'depositHeld', 'rentPaymentDay', 'importedFromProperty',
])

const EXPENSE_FIELDS = new Set([
  'date', 'property', 'category', 'amount', 'description', 'recurrence',
  'notes', 'receiptLink', 'document',
])

const LOAN_FIELDS = new Set([
  'propertyId', 'lender', 'principalAmount', 'loanAmount', 'currentBalance',
  'rate', 'fixedRateMonths', 'fixedStartDate', 'feeMode', 'feeValue',
  'addFeeToLoan', 'interestOnly', 'termMonths', 'ltvBand', 'mortgageNumber',
  'qualifyingFinanceBalance',
])

const CONTRACTOR_FIELDS = new Set([
  'name', 'firstName', 'lastName', 'companyName', 'phone', 'email', 'trade',
  'tagIds', 'propertyIds', 'lastJobMonth', 'lastJobYear', 'notes',
])

const SETTINGS_FIELDS = new Set([
  'appreciationRate', 'rentGrowthRate', 'rateShock', 'associatedCompanies',
  'accountingPeriodMonths', 'augmentedProfitDistributions',
  'closeInvestmentHoldingCompany', 'budgetedPropertyCostsTaxDeductible',
  'propertyLossBroughtForward', 'financeCostsBroughtForward',
  'managementRate', 'cashHeld', 'bufferMonths', 'projectionMonths',
  'landlordRegistration', 'fullyManaged', 'accountType', 'companyName',
  'grossAnnualIncome', 'privateIncomeConfirmed', 'taxJurisdiction',
  'notificationsEnabled',
])

const TIMELINE_FIELDS = new Set([
  'propertyId', 'kind', 'manualType', 'category', 'occurredAt', 'date', 'title',
  'details', 'notes', 'amount', 'contractorId', 'sourceType', 'sourceId',
  'sourceField', 'before', 'after', 'major',
])

const patchFrom = (source, allowed) => Object.fromEntries(
  Object.entries(source && typeof source === 'object' ? source : {})
    .filter(([key]) => allowed.has(key)),
)

const withId = (item) => ({ ...item, id: clean(item?.id) || crypto.randomUUID() })

const exactOrUniquePartial = (items, target, fields = ['name']) => {
  const needle = lower(target)
  if (!needle) return null
  const exact = items.find((item) => lower(item?.id) === needle
    || fields.some((field) => lower(item?.[field]) === needle))
  if (exact) return exact
  const partial = items.filter((item) => fields.some((field) => lower(item?.[field]).includes(needle)))
  return partial.length === 1 ? partial[0] : null
}

const requireEntity = (items, target, label, fields = ['name']) => {
  const item = exactOrUniquePartial(items, target, fields)
  if (!item) throw new Error(`${label} not found or ambiguous: ${clean(target) || '(missing target)'}`)
  return item
}

const resolveProperty = (state, target) => requireEntity(
  state.properties,
  target,
  'Property',
  ['name', 'address', 'postcode'],
)

const propertyIdFrom = (state, raw) => {
  const direct = clean(raw)
  if (!direct) return ''
  const byId = state.properties.find((property) => property.id === direct)
  return byId?.id || resolveProperty(state, direct).id
}

const targetLabel = (item, fallback) => clean(item?.name || item?.title || item?.description || item?.id) || fallback

const normalizeRate = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return Math.abs(parsed) > 1 ? parsed / 100 : parsed
}

const normalizeSettingsPatch = (data) => {
  const patch = patchFrom(data, SETTINGS_FIELDS)
  for (const key of ['appreciationRate', 'rentGrowthRate', 'rateShock', 'managementRate']) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) patch[key] = normalizeRate(patch[key])
  }
  return patch
}

const readResult = (result) => ({ mutated: false, result })
const writeResult = (state, message, extra = {}) => ({ mutated: true, state, result: { ok: true, message, ...extra } })

const requiresConfirmation = (operation, confirmed, state, description) => {
  if (!LUNA_DESTRUCTIVE_OPERATIONS.has(operation) || confirmed) return null
  return {
    mutated: false,
    state,
    confirmationRequired: true,
    confirmationPrompt: `Confirm: ${description}`,
    result: { ok: false, confirmationRequired: true, description },
  }
}

const listLineItems = (state, collection) => array(state.settings?.[collection])
const findLineItem = (state, collection, target) => requireEntity(listLineItems(state, collection), target, collection === 'companyCosts' ? 'Company cost' : 'Extraction')

const listSummary = (state) => ({
  properties: state.properties.length,
  activeProperties: state.properties.filter((item) => item.active !== false).length,
  tenants: state.tenants.length,
  loans: state.loans.length,
  expenses: state.expenses.length,
  contractors: state.contractors.length,
  cashHeld: Number(state.settings?.cashHeld || 0),
  companyName: clean(state.settings?.companyName),
  accountType: state.settings?.accountType || 'company',
})

export function executePortfolioAction(rawState, rawArgs = {}, { confirmed = false } = {}) {
  const state = ensureState(clone(rawState || {}))
  const operation = clean(rawArgs.operation)
  const target = rawArgs.target == null ? '' : clean(rawArgs.target)
  const data = rawArgs.data && typeof rawArgs.data === 'object' ? rawArgs.data : {}

  if (!LUNA_PHASE_ONE_OPERATIONS.includes(operation)) throw new Error(`Unsupported Luna operation: ${operation}`)

  if (operation === 'portfolio.summary') return readResult(listSummary(state))
  if (operation === 'property.list') return readResult(state.properties)
  if (operation === 'property.get') return readResult(resolveProperty(state, target))
  if (operation === 'tenant.list') return readResult(state.tenants)
  if (operation === 'tenant.get') return readResult(requireEntity(state.tenants, target, 'Tenant', ['name', 'email', 'phone']))
  if (operation === 'expense.list') return readResult(state.expenses)
  if (operation === 'expense.get') return readResult(requireEntity(state.expenses, target, 'Expense', ['description', 'category']))
  if (operation === 'expense.summary') return readResult(summarizeExpenses(state.expenses))
  if (operation === 'loan.list') return readResult(state.loans)
  if (operation === 'loan.get') return readResult(requireEntity(state.loans, target, 'Loan', ['lender', 'mortgageNumber']))
  if (operation === 'contractor.list') return readResult(state.contractors)
  if (operation === 'contractor.get') return readResult(requireEntity(state.contractors, target, 'Contractor', ['name', 'companyName', 'email', 'phone']))
  if (operation === 'settings.get') return readResult(state.settings)
  if (operation === 'company_cost.list') return readResult(listLineItems(state, 'companyCosts'))
  if (operation === 'extraction.list') return readResult(listLineItems(state, 'extractions'))
  if (operation === 'timeline.list') return readResult(state.propertyTimelineEvents)
  if (operation === 'performance_event.list') return readResult(state.performanceEvents)
  if (operation === 'acquisition.list') return readResult(state.acquisitionScenarios)
  if (operation === 'remortgage.list') return readResult(state.remortgageComparisons)
  if (operation === 'notification_preferences.get') return readResult(state.notificationPreferences || {})

  if (operation === 'property.create') {
    const name = clean(data.name) || `BTL${state.properties.length + 1}`
    const property = { ...createBlankProperty(name), ...patchFrom(data, PROPERTY_FIELDS) }
    state.properties.push(property)
    return writeResult(state, `Created ${property.name}.`, { entity: property })
  }

  if (operation === 'property.update') {
    const previous = resolveProperty(state, target)
    const patch = patchFrom(data, PROPERTY_FIELDS)
    const draft = { ...previous, ...patch }
    const synced = syncPropertyTenant(draft, state.tenants)
    state.properties = state.properties.map((item) => item.id === previous.id ? synced.property : item)
    state.tenants = synced.tenants
    state.propertyTimelineEvents.push(...propertyChangeEvents(previous, synced.property))
    return writeResult(state, `Updated ${synced.property.name}.`, { entity: synced.property })
  }

  if (operation === 'property.clone') {
    const source = resolveProperty(state, target)
    const property = {
      ...source,
      id: crypto.randomUUID(),
      name: clean(data.name) || `BTL${state.properties.length + 1}`,
      address: Object.prototype.hasOwnProperty.call(data, 'address') ? clean(data.address) : `${source.address || ''} (copy)`.trim(),
      active: true,
      tenantId: '',
      tenantName: '',
      tenantEmail: '',
      tenantPhone: '',
      tenantOccupation: '',
      tenantMoveIn: '',
      tenantMoveOut: '',
      depositHeld: '',
      mortgageNumber: '',
    }
    state.properties.push(property)
    return writeResult(state, `Cloned ${source.name} as ${property.name}.`, { entity: property })
  }

  if (operation === 'property.set_active') {
    const property = resolveProperty(state, target)
    const active = data.active !== false
    state.properties = state.properties.map((item) => item.id === property.id ? { ...item, active } : item)
    return writeResult(state, `${property.name} is now ${active ? 'included' : 'excluded'} in the portfolio model.`)
  }

  if (operation === 'property.delete') {
    const property = resolveProperty(state, target)
    const pending = requiresConfirmation(operation, confirmed, state, `delete ${property.name}`)
    if (pending) return pending
    const next = removePropertyFromLoanPortfolio(state, property.id)
    next.tenants = removeTenantsForProperty(state.tenants, property.id)
    next.propertyTimelineEvents = state.propertyTimelineEvents.filter((event) => event.propertyId !== property.id)
    next.performanceEvents = state.performanceEvents.filter((event) => event.propertyId !== property.id)
    return writeResult(next, `Deleted ${property.name}.`)
  }

  if (operation === 'tenant.create') {
    const property = resolveProperty(state, data.propertyId || data.property || target)
    const tenant = { ...createTenant(property.id), ...patchFrom(data, TENANT_FIELDS), propertyId: property.id }
    state.tenants.push(tenant)
    return writeResult(state, `Added tenant ${tenant.name || 'record'} to ${property.name}.`, { entity: tenant })
  }

  if (operation === 'tenant.update') {
    const previous = requireEntity(state.tenants, target, 'Tenant', ['name', 'email', 'phone'])
    const patch = patchFrom(data, TENANT_FIELDS)
    if (patch.propertyId) patch.propertyId = propertyIdFrom(state, patch.propertyId)
    const tenant = { ...previous, ...patch }
    if (!tenantBelongsToProperty(tenant, state.properties)) throw new Error('Tenant must belong to an existing property.')
    state.tenants = state.tenants.map((item) => item.id === tenant.id ? tenant : item)
    state.properties = state.properties.map((property) => applyTenantToProperty(tenant, property))
    return writeResult(state, `Updated tenant ${tenant.name || tenant.id}.`, { entity: tenant })
  }

  if (operation === 'tenant.delete') {
    const tenant = requireEntity(state.tenants, target, 'Tenant', ['name', 'email', 'phone'])
    const pending = requiresConfirmation(operation, confirmed, state, `delete tenant ${tenant.name || tenant.id}`)
    if (pending) return pending
    state.tenants = state.tenants.filter((item) => item.id !== tenant.id)
    state.properties = state.properties.map((property) => tenant.importedFromProperty && property.id === tenant.propertyId
      ? { ...property, tenantId: '', tenantName: '', tenantEmail: '', tenantPhone: '', tenantOccupation: '', tenantMoveIn: '', tenantMoveOut: '', depositHeld: '' }
      : property)
    return writeResult(state, `Deleted tenant ${tenant.name || tenant.id}.`)
  }

  if (operation === 'expense.create') {
    const expense = createExpense(patchFrom(data, EXPENSE_FIELDS))
    state.expenses.unshift(expense)
    return writeResult(state, `Added expense/cash-flow entry ${targetLabel(expense, expense.id)}.`, { entity: expense })
  }

  if (operation === 'expense.update') {
    const previous = requireEntity(state.expenses, target, 'Expense', ['description', 'category'])
    const expense = { ...previous, ...patchFrom(data, EXPENSE_FIELDS) }
    state.expenses = state.expenses.map((item) => item.id === expense.id ? expense : item)
    return writeResult(state, `Updated expense/cash-flow entry ${targetLabel(expense, expense.id)}.`, { entity: expense })
  }

  if (operation === 'expense.delete') {
    const expense = requireEntity(state.expenses, target, 'Expense', ['description', 'category'])
    const pending = requiresConfirmation(operation, confirmed, state, `delete expense/cash-flow entry ${targetLabel(expense, expense.id)}`)
    if (pending) return pending
    state.expenses = state.expenses.filter((item) => item.id !== expense.id)
    return writeResult(state, 'Deleted the expense/cash-flow entry.')
  }

  if (operation === 'loan.create') {
    const raw = { ...createBlankLoan(), ...patchFrom(data, LOAN_FIELDS) }
    if (data.property || raw.propertyId) raw.propertyId = propertyIdFrom(state, data.property || raw.propertyId)
    if (Object.prototype.hasOwnProperty.call(raw, 'rate')) raw.rate = normalizeRate(raw.rate)
    const next = applyLoanToPortfolio(state, raw)
    const loan = next.loans.find((item) => item.id === raw.id)
    return writeResult(next, `Added loan ${loan?.lender || loan?.id || ''}.`.trim(), { entity: loan })
  }

  if (operation === 'loan.update') {
    const previous = requireEntity(state.loans, target, 'Loan', ['lender', 'mortgageNumber'])
    const patch = patchFrom(data, LOAN_FIELDS)
    if (data.property || patch.propertyId) patch.propertyId = propertyIdFrom(state, data.property || patch.propertyId)
    if (Object.prototype.hasOwnProperty.call(patch, 'rate')) patch.rate = normalizeRate(patch.rate)
    const next = applyLoanToPortfolio(state, { ...previous, ...patch })
    const loan = next.loans.find((item) => item.id === previous.id)
    return writeResult(next, `Updated loan ${loan?.lender || loan?.id || ''}.`.trim(), { entity: loan })
  }

  if (operation === 'loan.delete') {
    const loan = requireEntity(state.loans, target, 'Loan', ['lender', 'mortgageNumber'])
    const pending = requiresConfirmation(operation, confirmed, state, `delete loan ${loan.lender || loan.id}`)
    if (pending) return pending
    return writeResult(removeLoanFromPortfolio(state, loan.id), `Deleted loan ${loan.lender || loan.id}.`)
  }

  if (operation === 'contractor.create') {
    const contractor = normalizeContractor({ ...createBlankContractor(), ...patchFrom(data, CONTRACTOR_FIELDS) }, state.properties, state.contractorTags)
    state.contractors.push(contractor)
    return writeResult(state, `Added contractor ${contractor.name || contractor.companyName || contractor.id}.`, { entity: contractor })
  }

  if (operation === 'contractor.update') {
    const previous = requireEntity(state.contractors, target, 'Contractor', ['name', 'companyName', 'email', 'phone'])
    const contractor = normalizeContractor({ ...previous, ...patchFrom(data, CONTRACTOR_FIELDS) }, state.properties, state.contractorTags)
    state.contractors = state.contractors.map((item) => item.id === contractor.id ? contractor : item)
    return writeResult(state, `Updated contractor ${contractor.name || contractor.companyName || contractor.id}.`, { entity: contractor })
  }

  if (operation === 'contractor.delete') {
    const contractor = requireEntity(state.contractors, target, 'Contractor', ['name', 'companyName', 'email', 'phone'])
    const pending = requiresConfirmation(operation, confirmed, state, `delete contractor ${contractor.name || contractor.companyName || contractor.id}`)
    if (pending) return pending
    state.contractors = state.contractors.filter((item) => item.id !== contractor.id)
    state.expenses = state.expenses.map((item) => item.document?.contractorId === contractor.id
      ? { ...item, document: { ...item.document, contractorId: '' } }
      : item)
    return writeResult(state, `Deleted contractor ${contractor.name || contractor.companyName || contractor.id}.`)
  }

  if (operation === 'contractor_tag.create') {
    const tag = createCustomContractorTag(data.label || target, data.iconKey)
    if (!tag.label) throw new Error('Contractor tag label is required.')
    state.contractorTags = normalizeContractorTags([...state.contractorTags, tag])
    return writeResult(state, `Created contractor tag ${tag.label}.`, { entity: tag })
  }

  if (operation === 'contractor_tag.update') {
    const tag = requireEntity(state.contractorTags, target, 'Contractor tag', ['label'])
    if (tag.system) throw new Error('System contractor tags cannot be renamed.')
    const updated = { ...tag, ...(data.label == null ? {} : { label: clean(data.label) }), ...(data.iconKey == null ? {} : { iconKey: clean(data.iconKey) }) }
    state.contractorTags = normalizeContractorTags(state.contractorTags.map((item) => item.id === tag.id ? updated : item))
    return writeResult(state, `Updated contractor tag ${updated.label}.`, { entity: updated })
  }

  if (operation === 'contractor_tag.delete') {
    const tag = requireEntity(state.contractorTags, target, 'Contractor tag', ['label'])
    if (tag.system || DEFAULT_CONTRACTOR_TAGS.some((item) => item.id === tag.id)) throw new Error('System contractor tags cannot be deleted.')
    const pending = requiresConfirmation(operation, confirmed, state, `delete contractor tag ${tag.label}`)
    if (pending) return pending
    state.contractorTags = normalizeContractorTags(state.contractorTags.filter((item) => item.id !== tag.id))
    state.contractors = state.contractors.map((contractor) => ({ ...contractor, tagIds: array(contractor.tagIds).filter((id) => id !== tag.id) }))
    return writeResult(state, `Deleted contractor tag ${tag.label}.`)
  }

  if (operation === 'settings.update') {
    const patch = normalizeSettingsPatch(data)
    state.settings = { ...state.settings, ...patch }
    return writeResult(state, `Updated ${Object.keys(patch).join(', ') || 'portfolio settings'}.`, { settings: patch })
  }

  if (operation === 'company_cost.create' || operation === 'extraction.create') {
    const collection = operation.startsWith('company_cost') ? 'companyCosts' : 'extractions'
    const item = withId({
      name: clean(data.name || target),
      amount: Number.isFinite(Number(data.amount)) ? Number(data.amount) : 0,
      enabled: data.enabled !== false,
      taxDeductible: data.taxDeductible === true,
      ...(collection === 'companyCosts' ? { monthsRemaining: Number.isFinite(Number(data.monthsRemaining)) ? Number(data.monthsRemaining) : 0 } : {}),
    })
    if (!item.name) throw new Error(`${collection === 'companyCosts' ? 'Company cost' : 'Extraction'} name is required.`)
    state.settings[collection] = [...listLineItems(state, collection), item]
    return writeResult(state, `Added ${item.name}.`, { entity: item })
  }

  if (operation === 'company_cost.update' || operation === 'extraction.update') {
    const collection = operation.startsWith('company_cost') ? 'companyCosts' : 'extractions'
    const previous = findLineItem(state, collection, target)
    const allowed = new Set(['name', 'amount', 'enabled', 'taxDeductible', ...(collection === 'companyCosts' ? ['monthsRemaining'] : [])])
    const item = { ...previous, ...patchFrom(data, allowed) }
    state.settings[collection] = listLineItems(state, collection).map((candidate) => candidate.id === item.id ? item : candidate)
    return writeResult(state, `Updated ${item.name}.`, { entity: item })
  }

  if (operation === 'company_cost.delete' || operation === 'extraction.delete') {
    const collection = operation.startsWith('company_cost') ? 'companyCosts' : 'extractions'
    const item = findLineItem(state, collection, target)
    const pending = requiresConfirmation(operation, confirmed, state, `delete ${item.name}`)
    if (pending) return pending
    state.settings[collection] = listLineItems(state, collection).filter((candidate) => candidate.id !== item.id)
    return writeResult(state, `Deleted ${item.name}.`)
  }

  if (operation === 'timeline.create') {
    const property = resolveProperty(state, data.propertyId || data.property || target)
    const event = normalizeTimelineEvent({
      ...patchFrom(data, TIMELINE_FIELDS),
      propertyId: property.id,
      occurredAt: data.occurredAt || data.date || new Date().toISOString().slice(0, 10),
      title: data.title || target,
      kind: data.kind || 'manual',
    })
    if (!event) throw new Error('Timeline event needs a property, date and title.')
    state.propertyTimelineEvents.push(event)
    return writeResult(state, `Added timeline event ${event.title} to ${property.name}.`, { entity: event })
  }

  if (operation === 'timeline.update') {
    const previous = requireEntity(state.propertyTimelineEvents, target, 'Timeline event', ['title'])
    const patch = patchFrom(data, TIMELINE_FIELDS)
    if (data.property || patch.propertyId) patch.propertyId = propertyIdFrom(state, data.property || patch.propertyId)
    const event = normalizeTimelineEvent({ ...previous, ...patch })
    if (!event) throw new Error('Timeline event needs a property, date and title.')
    state.propertyTimelineEvents = state.propertyTimelineEvents.map((item) => item.id === event.id ? event : item)
    return writeResult(state, `Updated timeline event ${event.title}.`, { entity: event })
  }

  if (operation === 'timeline.delete') {
    const event = requireEntity(state.propertyTimelineEvents, target, 'Timeline event', ['title'])
    const pending = requiresConfirmation(operation, confirmed, state, `delete timeline event ${event.title}`)
    if (pending) return pending
    state.propertyTimelineEvents = state.propertyTimelineEvents.filter((item) => item.id !== event.id)
    return writeResult(state, `Deleted timeline event ${event.title}.`)
  }

  throw new Error(`Unhandled Luna operation: ${operation}`)
}
