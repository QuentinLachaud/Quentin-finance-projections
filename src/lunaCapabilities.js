import { createBlankProperty, editableSections } from './data.js'
import {
  applyTenantToProperty,
  createTenant,
  removeTenantsForProperty,
  syncPropertyTenant,
  tenantBelongsToProperty,
} from './tenants.js'
import { createExpense, summarizeExpenses, filterExpenses } from './expenses.js'
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
import { normalizeTimelineEvent, propertyChangeEvents, buildPropertyTimeline } from './propertyTimeline.js'
import { calculateProperty, calculatePortfolio, projectPortfolio } from './calculations.js'
import { withPropertyLoans, summarizePropertyLoans } from './loans.js'
import { propertyOperatingCashflow } from './portfolioFields.js'
import { complianceDiaryItems, actionableNotifications, dismissNotification, snoozeNotification } from './notifications.js'
import { normalizeDocumentMeta } from './documents.js'
import { createAcquisition, nextAcquisitionName, reorderAcquisitions } from './acquisition.js'
import { createRemortgageComparison, duplicateRemortgageComparison, updateRemortgageScenario, compareRemortgageScenarios } from './remortgage.js'
import { createPerformanceEvent, normalizePerformanceEvent, PERFORMANCE_EVENT_TYPES } from './performance.js'
import { normalizeNextBtlPreferences } from './nextBtlPreferences.js'

const clean = (value) => String(value ?? '').trim()
const lower = (value) => clean(value).toLowerCase()
const referenceKey = (value) => lower(value).replace(/[^a-z0-9]+/g, '')
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
  'portfolio.context',
  'portfolio.financial_summary',
  'portfolio.projection',
  'portfolio.batch',
  'property.context',
  'expense.filtered',
  'timeline.view',
  'property.list',
  'property.get',
  'property.loans',
  'property.tenants',
  'property.financial_summary',
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
  'performance_event.create',
  'performance_event.update',
  'performance_event.delete',
  'acquisition.list',
  'acquisition.create',
  'acquisition.update',
  'acquisition.duplicate',
  'acquisition.reorder',
  'acquisition.delete',
  'remortgage.list',
  'remortgage.create',
  'remortgage.update',
  'remortgage.duplicate',
  'remortgage.delete',
  'remortgage.compare',
  'notification_preferences.get',
  'notification.list',
  'notification.dismiss',
  'notification.snooze',
  'next_btl.get',
  'next_btl.update',
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
  'acquisition.delete', 'remortgage.delete', 'performance_event.delete',
])

const PROPERTY_FIELDS = new Set([
  'name', 'address', 'postcode', 'flatNumber', 'purchasePrice', 'homeReportPurchase',
  'latestValuation', 'areaSqm', 'bedrooms', 'epc', 'rent', 'purchaseDate',
  'factorsFees', 'repairs', 'applianceReserve', 'legionella', 'gasCertificate',
  'eicr', 'mortgageAdmin', 'voidsOverride', 'qualifyingFinanceBalance',
  'gasExpiry', 'eicrExpiry', 'epcExpiry', 'patExpiry',
  'tenantName', 'tenantEmail', 'tenantPhone', 'tenantOccupation',
  'tenantMoveIn', 'tenantMoveOut', 'depositHeld', 'active',
  'factorsProvider', 'factorsAccountNumber', 'mortgageNumber',
  'buildingsInsuranceProvider', 'buildingsInsurancePolicyNumber', 'buildingsInsuranceInsuredValue',
  'depositScheme', 'depositRegistrationNumber',
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

const patchFrom = (source, allowed, { extra = [] } = {}) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Update fields must be an object.')
  const unknown = Object.keys(source).filter((key) => !allowed.has(key) && !extra.includes(key))
  if (unknown.length) throw new Error('Unsupported field(s): ' + unknown.join(', ') + '. No changes were saved.')
  const patch = Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key)))
  if (!Object.keys(patch).length && !extra.some((key) => Object.prototype.hasOwnProperty.call(source, key))) {
    throw new Error('No supported fields supplied; no changes were saved.')
  }
  return patch
}

const withId = (item) => ({ ...item, id: clean(item?.id) || crypto.randomUUID() })

const exactOrUniquePartial = (items, target, fields = ['name']) => {
  const needle = lower(target)
  if (!needle) return null
  const canonicalNeedle = referenceKey(target)
  const idMatches = items.filter((item) => lower(item?.id) === needle)
  if (idMatches.length === 1) return idMatches[0]
  if (idMatches.length > 1) return null
  const exact = items.filter((item) => fields.some((field) => lower(item?.[field]) === needle
    || (canonicalNeedle && referenceKey(item?.[field]) === canonicalNeedle)))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null
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

export const resolveLunaProperty = (rawState, target) => resolveProperty(ensureState(rawState), target)

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


const propertyFieldDefinitions = new Map(
  editableSections.flatMap((section) => section.fields)
    .map(([key, label, type]) => [key, { label, type }]),
)

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)
const numberOrNull = (value) => value === '' || value == null ? null : Number(value)

const validatedPropertyPatch = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Property fields must be an object.')
  const keys = Object.keys(raw)
  if (!keys.length) throw new Error('Specify at least one property field to update.')
  const unknown = keys.filter((key) => !PROPERTY_FIELDS.has(key))
  if (unknown.length) throw new Error('Unsupported property field(s): ' + unknown.join(', ') + '. No changes were saved.')
  const patch = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) throw new Error('Undefined value for property field: ' + key)
    const definition = propertyFieldDefinitions.get(key)
    if (definition?.type === 'optional-number' || definition?.type === 'number') {
      const parsed = numberOrNull(value)
      if (parsed === null && definition.type === 'optional-number') {
        patch[key] = ''
      } else if (parsed === null || !Number.isFinite(parsed) || parsed < 0 || parsed > 1e12) {
        throw new Error('Invalid numeric property field: ' + key)
      } else {
        patch[key] = parsed
      }
    } else if (definition && ['text', 'date', 'email', 'tel'].includes(definition.type)) {
      if (value !== null && typeof value !== 'string' && typeof value !== 'number') throw new Error('Invalid text property field: ' + key)
      const text = String(value ?? '').trim()
      if (text.length > 512) throw new Error('Property field too long: ' + key)
      if (definition.type === 'date' && text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Invalid date property field: ' + key)
      patch[key] = text
    } else if (key === 'active') {
      if (typeof value !== 'boolean') throw new Error('Property active must be a boolean.')
      patch[key] = value
    } else {
      if (value === null || Array.isArray(value) || typeof value === 'object') throw new Error('Invalid property field: ' + key)
      patch[key] = value
    }
  }
  return patch
}


const ACQUISITION_FIELDS = new Set([
  'name', 'sourceUrl', 'sourceProvider', 'purchasePrice', 'expectedMonthlyRent',
  'jurisdiction', 'ltv', 'adsRate', 'legalFees', 'mortgageFee', 'mortgageFeeAddedToLoan',
])
const validatedAcquisition = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Acquisition data must be an object.')
  const unknown = Object.keys(raw).filter((key) => !ACQUISITION_FIELDS.has(key))
  if (unknown.length) throw new Error('Unsupported acquisition field(s): ' + unknown.join(', '))
  const result = { ...raw }
  for (const key of ['purchasePrice', 'expectedMonthlyRent', 'ltv', 'adsRate', 'legalFees', 'mortgageFee']) {
    if (!hasOwn(result, key)) continue
    const n = Number(result[key])
    if (result[key] === '' || result[key] == null) continue
    if (typeof result[key] === 'boolean' || !Number.isFinite(n) || n < 0
      || n > (key === 'ltv' || key === 'adsRate' ? 100 : 1e12)) throw new Error('Invalid acquisition amount: ' + key)
    result[key] = n
  }
  for (const key of ['name', 'sourceUrl', 'sourceProvider']) {
    if (!hasOwn(result, key)) continue
    if (typeof result[key] !== 'string' || result[key].length > 1000) throw new Error('Invalid acquisition field: ' + key)
    result[key] = result[key].trim()
  }
  if (hasOwn(result, 'jurisdiction') && !['scotland', 'england-ni', 'wales'].includes(result.jurisdiction)) throw new Error('Invalid acquisition jurisdiction.')
  if (hasOwn(result, 'mortgageFeeAddedToLoan') && typeof result.mortgageFeeAddedToLoan !== 'boolean') throw new Error('Invalid acquisition fee flag.')
  return result
}


const REMORTGAGE_SCENARIO_FIELDS = new Set(['propertyValue', 'loanAmount', 'ltv', 'rate', 'feeMode', 'feeValue', 'addFeeToLoan'])
const updatedComparison = (current, raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Remortgage changes must be an object.')
  const unknown = Object.keys(raw).filter((key) => !['name', 'left', 'right'].includes(key))
  if (unknown.length) throw new Error('Unsupported remortgage field(s): ' + unknown.join(', '))
  const updated = { ...current }
  if (hasOwn(raw, 'name')) {
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 200) throw new Error('Invalid comparison name.')
    updated.name = raw.name.trim()
  }
  for (const side of ['left', 'right']) {
    if (!hasOwn(raw, side)) continue
    const fields = raw[side]
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('Invalid remortgage scenario.')
    const unknownFields = Object.keys(fields).filter((key) => !REMORTGAGE_SCENARIO_FIELDS.has(key))
    if (unknownFields.length) throw new Error('Unsupported remortgage scenario field(s): ' + unknownFields.join(', '))
    let scenario = { ...updated[side] }
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'feeMode' && !['amount', 'percent'].includes(value)) throw new Error('Invalid fee mode.')
      if (key === 'addFeeToLoan' && typeof value !== 'boolean') throw new Error('Invalid fee setting.')
      if (!['feeMode', 'addFeeToLoan'].includes(key)
        && (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e12)) {
        throw new Error('Invalid remortgage amount: ' + key)
      }
      scenario = updateRemortgageScenario(scenario, key, value)
    }
    updated[side] = scenario
  }
  return updated
}


const PERFORMANCE_EVENT_FIELDS = new Set(['property', 'propertyId', 'occurredAt', 'date', 'type', 'title', 'amount', 'notes'])
const updatedPerformanceEvent = (source, raw, state) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Performance event fields must be an object.')
  const unknown = Object.keys(raw).filter((key) => !PERFORMANCE_EVENT_FIELDS.has(key))
  if (unknown.length) throw new Error('Unsupported performance event field(s): ' + unknown.join(', '))
  const { property, date, ...fields } = raw
  const propertyReference = property || fields.propertyId
  const propertyId = propertyReference ? propertyIdFrom(state, propertyReference) : source.propertyId
  const event = { ...source, ...fields, propertyId, occurredAt: raw.occurredAt || date || source.occurredAt }
  if (!PERFORMANCE_EVENT_TYPES.some((kind) => kind.value === event.type)) throw new Error('Invalid performance event type.')
  if (hasOwn(fields, 'amount') && (typeof fields.amount === 'boolean' || !Number.isFinite(Number(fields.amount)))) {
    throw new Error('Invalid performance event amount.')
  }
  const normalized = normalizePerformanceEvent(event)
  if (!normalized) throw new Error('Invalid performance event date; expected YYYY-MM-DD.')
  return normalized
}


const NEXT_BTL_FIELDS = new Set([
  'targetSource', 'selectedAcquisitionId', 'targetPrice', 'appreciationPercent',
  'scenarioIndex', 'preserveBuffer', 'includeExtraction', 'includeRentGrowth',
  'releaseMode', 'assumptions', 'equityReleaseOptions',
])
const findComplianceEvent = (state, ref) => {
  const events = complianceDiaryItems(withPropertyLoans(state.properties, state.loans))
  const matches = events.filter((event) => event.key === ref || referenceKey(event.propertyName + ' ' + event.label) === referenceKey(ref))
  if (matches.length !== 1) throw new Error('Reminder not found or ambiguous: ' + ref)
  return matches[0]
}

const linkedExpenses = (state, property) => state.expenses.filter((entry) => {
  const document = normalizeDocumentMeta(entry.document)
  if (document?.association?.kind === 'property') return document.association.id === property.id
  return referenceKey(entry.property) === referenceKey(property.name)
})
const linkedContext = (state, property) => {
  const financed = withPropertyLoans([property], state.loans)[0]
  const calculated = calculateProperty(financed, state.settings)
  return {
    property: financed,
    metrics: {
      value: calculated.latestValuation, loanBalance: calculated.loanAmount,
      equity: calculated.equity, ltv: calculated.currentLtv,
      monthlyRent: calculated.rent, monthlyMortgagePayment: calculated.monthlyPayment,
      monthlyOperatingCashflow: propertyOperatingCashflow(calculated, state.settings),
      grossYield: calculated.grossYield, netYield: calculated.netYield,
      nextRemortgage: calculated.nextRemortgage,
    },
    loans: state.loans.filter((loan) => loan.propertyId === property.id),
    tenants: state.tenants.filter((tenant) => tenant.propertyId === property.id),
    expenses: linkedExpenses(state, property),
    contractors: state.contractors.filter((item) => array(item.propertyIds).includes(property.id)),
    timeline: state.propertyTimelineEvents.filter((item) => item.propertyId === property.id),
    performanceEvents: state.performanceEvents.filter((item) => item.propertyId === property.id),
    compliance: complianceDiaryItems([financed]),
  }
}

const CONTEXT_COLLECTIONS = new Set([
  'properties', 'loans', 'tenants', 'expenses', 'contractors', 'contractorTags',
  'propertyTimelineEvents', 'performanceEvents', 'acquisitionScenarios',
  'remortgageComparisons', 'companyCosts', 'extractions', 'notificationPreferences',
])
const contextCollections = (state, target, data) => {
  const requested = data?.collections ?? ['properties', 'loans', 'tenants', 'expenses']
  if (!Array.isArray(requested) || requested.length < 1 || requested.length > 4
      || requested.some((key) => !CONTEXT_COLLECTIONS.has(key))) {
    throw new Error('Specify one to four supported portfolio context collections.')
  }
  const property = target ? resolveProperty(state, target) : null
  const limit = Math.min(100, Math.max(1, Number.isInteger(data?.limit) ? data.limit : 40))
  const offset = data?.offset === undefined ? 0 : Number(data.offset)
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new Error('Context offset must be 0 to 100000.')
  const collections = Object.fromEntries(requested.map((key) => {
    if (key === 'notificationPreferences') return [key, state.notificationPreferences || {}]
    const items = key === 'companyCosts' || key === 'extractions' ? listLineItems(state, key) : array(state[key])
    const selected = property && key !== 'properties'
      ? items.filter((item) => key === 'expenses' ? linkedExpenses(state, property).includes(item)
        : key === 'contractors' ? array(item.propertyIds).includes(property.id)
        : item.propertyId === property.id || item.sourcePropertyId === property.id)
      : property ? items.filter((item) => item.id === property.id) : items
    return [key, { total: selected.length, items: selected.slice(offset, offset + limit), nextOffset: selected.length > offset + limit ? offset + limit : null }]
  }))
  return { property: property ? propertyIdentity(property) : null, collections }
}

const financialSummary = (state, data = {}) => {
  const references = data?.properties
  if (references != null && (!Array.isArray(references) || references.length === 0 || references.length > 25)) {
    throw new Error('properties must be an array of 1 to 25 BTL names or IDs.')
  }
  const properties = references
    ? [...new Map(references.map((reference) => {
      const property = resolveProperty(state, reference)
      return [property.id, { ...property, active: true }]
    })).values()]
    : state.properties
  const scoped = Boolean(references)
  const settings = scoped
    ? { ...state.settings, companyCosts: [], extractions: [] }
    : state.settings
  const calculated = calculatePortfolio(withPropertyLoans(properties, state.loans), settings)
  return {
    scope: scoped ? 'selected properties, excluding shared company costs and extractions' : 'active properties, including company costs and tax',
    propertyNames: calculated.selected.map((item) => item.name),
    propertyCount: calculated.count,
    monthlyRent: calculated.rent,
    totalValue: calculated.totalValue,
    totalDebt: calculated.totalLoans,
    totalEquity: calculated.totalEquity,
    monthlyMortgagePayments: calculated.mortgagePayments,
    monthlyFixedCosts: calculated.fixedCosts,
    monthlyVariableCosts: calculated.variableCosts,
    portfolioCashHeld: scoped ? null : calculated.cashHeld,
    portfolioBufferMonths: scoped ? null : calculated.bufferMonths,
    scenarios: calculated.scenarios.map((item) => ({
      id: item.id, monthlyCashflowAfterTax: item.cashflow, monthlyBankCashflowAfterTax: item.bankCashflow,
      monthlyTax: item.tax, monthlyCollectedRent: item.collectedRent, monthlyTotalGain: item.totalGain,
    })),
    perProperty: calculated.selected.map((item) => ({
      id: item.id, name: item.name, value: item.latestValuation,
      loanBalance: item.loanAmount, equity: item.equity, ltv: item.currentLtv,
      rent: item.rent, mortgagePayment: item.monthlyPayment,
      operatingCashflow: propertyOperatingCashflow(item, settings),
    })),
  }
}

const portfolioProjection = (state, data = {}) => {
  const months = data.months === undefined ? 60 : Number(data.months)
  if (!Number.isInteger(months) || months < 12 || months > 120) throw new Error('Projection months must be 12 to 120.')
  const series = projectPortfolio(withPropertyLoans(state.properties, state.loans), state.settings, months)
  const requested = data.milestones === undefined ? [0, 12, 24, 36, 60, months] : data.milestones
  if (!Array.isArray(requested) || requested.length > 12 || requested.some((value) => !Number.isInteger(value) || value < 0 || value > months)) {
    throw new Error('Projection milestones must be months within the forecast horizon.')
  }
  return {
    months, assumptions: {
      appreciationRate: state.settings?.appreciationRate,
      rentGrowthRate: state.settings?.rentGrowthRate,
      rateShock: state.settings?.rateShock,
    },
    milestones: [...new Set(requested.filter((value) => value <= months).concat(months))]
      .sort((a, b) => a - b).map((month) => series[month]),
    note: 'Uses the existing app projection engine; scenarios depend on configured assumptions, not guaranteed outcomes.',
  }
}

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

const propertyIdentity = (property) => ({
  id: property.id,
  name: property.name || '',
  address: property.address || '',
  postcode: property.postcode || '',
})

const propertyLoans = (state, property) => {
  const summary = summarizePropertyLoans(property, state.loans, state.settings?.rateShock || 0)
  return {
    property: propertyIdentity(property),
    loans: summary.loans,
    summary: {
      loanCount: summary.loanCount,
      loanAmount: summary.loanAmount,
      monthlyPayment: summary.monthlyPayment,
      monthlyInterestCost: summary.monthlyInterestCost,
      weightedRate: summary.weightedRate,
      lenders: summary.lenders,
      repaymentMode: summary.repaymentMode,
      nextRemortgage: summary.nextRemortgage,
    },
  }
}

const propertyTenants = (state, property) => ({
  property: propertyIdentity(property),
  tenants: state.tenants.filter((tenant) => tenant.propertyId === property.id),
})

const propertyFinancialSummary = (state, property) => {
  const financed = withPropertyLoans([property], state.loans)[0]
  const calculated = calculateProperty(financed, state.settings)
  const management = state.settings?.fullyManaged
    ? Number(calculated.rent || 0) * Number(state.settings?.managementRate || 0)
    : 0
  return {
    property: propertyIdentity(property),
    metric: 'operating_cashflow',
    metricLabel: 'Operating cash flow / month',
    operatingCashflow: propertyOperatingCashflow(calculated, state.settings),
    components: {
      rent: calculated.rent,
      mortgagePayment: calculated.monthlyPayment,
      fixedCosts: calculated.fixedCosts,
      variableCosts: calculated.variableCosts,
      management,
    },
    excludes: ['portfolio or company tax', 'company-level costs and extractions'],
  }
}

export function executePortfolioAction(rawState, rawArgs = {}, { confirmed = false } = {}) {
  const state = ensureState(clone(rawState || {}))
  const operation = clean(rawArgs.operation)
  const target = rawArgs.target == null ? '' : clean(rawArgs.target)
  const data = rawArgs.data && typeof rawArgs.data === 'object' ? rawArgs.data : {}

  if (!LUNA_PHASE_ONE_OPERATIONS.includes(operation)) throw new Error(`Unsupported Luna operation: ${operation}`)

  if (operation === 'portfolio.summary') return readResult(listSummary(state))
  if (operation === 'portfolio.context') return readResult(contextCollections(state, target, data))
  if (operation === 'portfolio.financial_summary') return readResult(financialSummary(state, data))
  if (operation === 'portfolio.projection') return readResult(portfolioProjection(state, data))
  if (operation === 'property.context') return readResult(linkedContext(state, resolveProperty(state, target)))

  if (operation === 'expense.filtered') {
    const filters = data || {}
    const allowed = new Set(['property', 'category', 'recurrence', 'type', 'from', 'to', 'query', 'limit', 'offset'])
    const invalid = Object.keys(filters).filter((key) => !allowed.has(key))
    if (invalid.length) throw new Error('Unsupported expense filter(s): ' + invalid.join(', '))
    const property = target || filters.property ? resolveProperty(state, target || filters.property) : null
    const maxItems = filters.limit === undefined ? 100 : Number(filters.limit)
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 200) throw new Error('Expense limit must be 1 to 200.')
    const offset = filters.offset === undefined ? 0 : Number(filters.offset)
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new Error('Expense offset must be 0 to 100000.')
    const scoped = property ? linkedExpenses(state, property) : state.expenses
    const items = filterExpenses(scoped, { ...filters, property: '' })
    return readResult({
      scope: property ? propertyIdentity(property) : 'all properties',
      total: items.length, summary: summarizeExpenses(items), items: items.slice(offset, offset + maxItems),
      nextOffset: items.length > offset + maxItems ? offset + maxItems : null,
    })
  }
  if (operation === 'timeline.view') {
    const property = resolveProperty(state, target)
    return readResult(buildPropertyTimeline({
      property: withPropertyLoans([property], state.loans)[0],
      loans: state.loans, tenants: state.tenants, contractors: state.contractors,
      expenses: state.expenses, timelineEvents: state.propertyTimelineEvents,
    }))
  }

  if (operation === 'portfolio.batch') {
    const actions = data.actions
    if (!Array.isArray(actions) || actions.length < 1 || actions.length > 12) throw new Error('Batch must contain 1 to 12 actions.')
    if (actions.some((action) => !action || typeof action !== 'object' || action.operation === 'portfolio.batch'
      || !LUNA_PHASE_ONE_OPERATIONS.includes(action.operation) || !/^(property|tenant|loan|expense|contractor|contractor_tag|settings|company_cost|extraction|timeline|acquisition|remortgage|performance_event|notification|next_btl)\.(create|update|delete|set_active|clone|duplicate|reorder|dismiss|snooze)$/.test(action.operation))) {
      throw new Error('Unsupported operation in portfolio batch.')
    }
    if (!confirmed && actions.some((action) => LUNA_DESTRUCTIVE_OPERATIONS.has(action.operation))) {
      return requiresConfirmation('property.delete', false, state, 'execute the batch containing deletions')
    }
    let working = state
    const results = []
    for (const action of actions) {
      const outcome = executePortfolioAction(working, action, { confirmed })
      if (!outcome.mutated) throw new Error('A batch action did not write: ' + action.operation)
      working = outcome.state
      results.push(outcome.result)
    }
    return writeResult(working, 'Applied ' + results.length + ' actions atomically.', { actions: results })
  }
  if (operation === 'property.list') return readResult(state.properties)
  if (operation === 'property.get') return readResult(resolveProperty(state, target))
  if (operation === 'property.loans') {
    const property = resolveProperty(state, target)
    return readResult(propertyLoans(state, property))
  }
  if (operation === 'property.tenants') {
    const property = resolveProperty(state, target)
    return readResult(propertyTenants(state, property))
  }
  if (operation === 'property.financial_summary') {
    const property = resolveProperty(state, target)
    return readResult(propertyFinancialSummary(state, property))
  }
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


  if (operation === 'acquisition.create') {
    const fields = validatedAcquisition(data)
    const name = fields.name || nextAcquisitionName(state.properties.length, state.acquisitionScenarios)
    const item = createAcquisition({ ...fields, name }, state.settings.taxJurisdiction === 'scotland' ? 'scotland' : 'england-ni')
    state.acquisitionScenarios.unshift(item)
    return writeResult(state, 'Created acquisition scenario ' + item.name + '.', { entity: item })
  }
  if (operation === 'acquisition.update') {
    const before = requireEntity(state.acquisitionScenarios, target, 'Acquisition', ['name'])
    const fields = validatedAcquisition(data)
    if (!Object.keys(fields).length) throw new Error('Specify acquisition fields to update.')
    const item = { ...before, ...fields }
    state.acquisitionScenarios = state.acquisitionScenarios.map((candidate) => candidate.id === item.id ? item : candidate)
    return writeResult(state, 'Updated acquisition scenario ' + item.name + '.', { entity: item })
  }
  if (operation === 'acquisition.duplicate') {
    const before = requireEntity(state.acquisitionScenarios, target, 'Acquisition', ['name'])
    const fields = validatedAcquisition(data)
    const item = createAcquisition({ ...before, ...fields, id: crypto.randomUUID(), name: fields.name || (before.name + ' copy') })
    state.acquisitionScenarios.unshift(item)
    return writeResult(state, 'Duplicated acquisition scenario ' + before.name + '.', { entity: item })
  }
  if (operation === 'acquisition.reorder') {
    const before = requireEntity(state.acquisitionScenarios, target, 'Acquisition', ['name'])
    const fromIndex = state.acquisitionScenarios.findIndex((item) => item.id === before.id)
    const toIndex = Number(data.index)
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= state.acquisitionScenarios.length || Object.keys(data).some((key) => key !== 'index')) {
      throw new Error('Specify a valid acquisition destination index.')
    }
    state.acquisitionScenarios = reorderAcquisitions(state.acquisitionScenarios, fromIndex, toIndex)
    return writeResult(state, 'Reordered acquisitions.')
  }
  if (operation === 'acquisition.delete') {
    const before = requireEntity(state.acquisitionScenarios, target, 'Acquisition', ['name'])
    const pending = requiresConfirmation(operation, confirmed, state, 'delete acquisition ' + before.name)
    if (pending) return pending
    state.acquisitionScenarios = state.acquisitionScenarios.filter((item) => item.id !== before.id)
    return writeResult(state, 'Deleted acquisition ' + before.name + '.')
  }


  if (operation === 'remortgage.create') {
    const propRef = target || data?.property
    const property = propRef ? resolveProperty(state, propRef) : null
    const base = createRemortgageComparison(property ? withPropertyLoans([property], state.loans)[0] : null)
    const { property: ignored, ...fields } = data || {}
    const item = updatedComparison(base, fields)
    state.remortgageComparisons.unshift(item)
    return writeResult(state, 'Created remortgage comparison ' + item.name + '.', { entity: item })
  }
  if (operation === 'remortgage.update') {
    const before = requireEntity(state.remortgageComparisons, target, 'Remortgage comparison', ['name'])
    const item = updatedComparison(before, data)
    if (JSON.stringify(before) === JSON.stringify(item)) throw new Error('No remortgage comparison changes requested.')
    state.remortgageComparisons = state.remortgageComparisons.map((candidate) => candidate.id === before.id ? item : candidate)
    return writeResult(state, 'Updated remortgage comparison ' + item.name + '.', { entity: item })
  }
  if (operation === 'remortgage.compare') {
    const item = requireEntity(state.remortgageComparisons, target, 'Remortgage comparison', ['name'])
    return readResult({ name: item.name, comparison: compareRemortgageScenarios(item.left, item.right) })
  }
  if (operation === 'remortgage.duplicate') {
    const before = requireEntity(state.remortgageComparisons, target, 'Remortgage comparison', ['name'])
    const item = duplicateRemortgageComparison(before)
    state.remortgageComparisons.unshift(item)
    return writeResult(state, 'Duplicated remortgage comparison ' + before.name + '.', { entity: item })
  }
  if (operation === 'remortgage.delete') {
    const before = requireEntity(state.remortgageComparisons, target, 'Remortgage comparison', ['name'])
    const pending = requiresConfirmation(operation, confirmed, state, 'delete remortgage comparison ' + before.name)
    if (pending) return pending
    state.remortgageComparisons = state.remortgageComparisons.filter((item) => item.id !== before.id)
    return writeResult(state, 'Deleted remortgage comparison ' + before.name + '.')
  }


  if (operation === 'performance_event.create') {
    const property = target || data?.property || data?.propertyId
    const propertyId = property ? propertyIdFrom(state, property) : ''
    const event = updatedPerformanceEvent(createPerformanceEvent(propertyId), data, state)
    state.performanceEvents.push(event)
    return writeResult(state, 'Created performance event ' + (event.title || event.id) + '.', { entity: event })
  }
  if (operation === 'performance_event.update') {
    const before = requireEntity(state.performanceEvents, target, 'Performance event', ['title'])
    const event = updatedPerformanceEvent(before, data, state)
    state.performanceEvents = state.performanceEvents.map((candidate) => candidate.id === event.id ? event : candidate)
    return writeResult(state, 'Updated performance event ' + (event.title || event.id) + '.', { entity: event })
  }
  if (operation === 'performance_event.delete') {
    const before = requireEntity(state.performanceEvents, target, 'Performance event', ['title'])
    const pending = requiresConfirmation(operation, confirmed, state, 'delete performance event ' + (before.title || before.id))
    if (pending) return pending
    state.performanceEvents = state.performanceEvents.filter((candidate) => candidate.id !== before.id)
    return writeResult(state, 'Deleted performance event ' + (before.title || before.id) + '.')
  }


  if (operation === 'next_btl.get') return readResult(normalizeNextBtlPreferences(state.nextBtlPreferences))
  if (operation === 'next_btl.update') {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length) {
      throw new Error('Specify Next BTL preferences to change.')
    }
    const invalid = Object.keys(data).filter((key) => !NEXT_BTL_FIELDS.has(key))
    if (invalid.length) throw new Error('Unsupported Next BTL preference(s): ' + invalid.join(', '))
    const next = normalizeNextBtlPreferences({ ...state.nextBtlPreferences, ...data })
    for (const key of Object.keys(data)) if (!Object.prototype.hasOwnProperty.call(next, key)) {
      throw new Error('Invalid Next BTL preference: ' + key)
    }
    state.nextBtlPreferences = next
    return writeResult(state, 'Updated Next BTL preferences.', { preferences: next })
  }
  if (operation === 'notification.list') {
    const properties = withPropertyLoans(state.properties, state.loans)
    return readResult({
      scheduled: complianceDiaryItems(properties),
      actionable: actionableNotifications({
        properties, preferences: state.notificationPreferences,
        enabled: state.settings.notificationsEnabled !== false,
      }),
      preferences: state.notificationPreferences || {},
    })
  }
  if (operation === 'notification.dismiss' || operation === 'notification.snooze') {
    const event = findComplianceEvent(state, clean(target || data?.key))
    if (operation === 'notification.dismiss') {
      state.notificationPreferences = dismissNotification(state.notificationPreferences, event)
    } else {
      const days = data?.days === undefined ? 7 : Number(data.days)
      if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Snooze days must be 1–30.')
      state.notificationPreferences = snoozeNotification(state.notificationPreferences, event, new Date(), days)
    }
    return writeResult(state, (operation === 'notification.dismiss' ? 'Dismissed ' : 'Snoozed ') + event.label + ' for ' + event.propertyName + '.', { event })
  }

  if (operation === 'property.create') {
    const name = clean(data.name) || `BTL${state.properties.length + 1}`
    const property = { ...createBlankProperty(name), ...validatedPropertyPatch({ ...data, name }) }
    state.properties.push(property)
    return writeResult(state, `Created ${property.name}.`, { entity: property })
  }

  if (operation === 'property.update') {
    const previous = resolveProperty(state, target)
    const patch = validatedPropertyPatch(data)
    const linkedLoans = state.loans.filter((loan) => loan.propertyId === previous.id)
    if (hasOwn(patch, 'mortgageNumber') && linkedLoans.length > 1) {
      throw new Error('Property has multiple loans. Update the intended loan mortgage number explicitly.')
    }
    if (hasOwn(patch, 'mortgageNumber') && linkedLoans.length === 1) {
      state.loans = state.loans.map((loan) => loan.id === linkedLoans[0].id
        ? { ...loan, mortgageNumber: patch.mortgageNumber } : loan)
    }
    const draft = { ...previous, ...patch }
    const synced = syncPropertyTenant(draft, state.tenants)
    state.properties = state.properties.map((item) => item.id === previous.id ? synced.property : item)
    state.tenants = synced.tenants
    state.propertyTimelineEvents.push(...propertyChangeEvents(previous, synced.property))
    return writeResult(state, 'Updated ' + synced.property.name + ': ' + Object.keys(patch).join(', ') + '.', {
      entity: synced.property,
      changes: Object.fromEntries(Object.keys(patch).map((key) => [key, synced.property[key]])),
      linkedLoanUpdated: hasOwn(patch, 'mortgageNumber') && linkedLoans.length === 1,
    })
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
      factorsAccountNumber: '',
      buildingsInsurancePolicyNumber: '',
      buildingsInsuranceInsuredValue: '',
      depositScheme: '',
      depositRegistrationNumber: '',
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
    const tenant = { ...createTenant(property.id), ...patchFrom(data, TENANT_FIELDS, { extra: ['property'] }), propertyId: property.id }
    state.tenants.push(tenant)
    return writeResult(state, `Added tenant ${tenant.name || 'record'} to ${property.name}.`, { entity: tenant })
  }

  if (operation === 'tenant.update') {
    const previous = requireEntity(state.tenants, target, 'Tenant', ['name', 'email', 'phone'])
    const patch = patchFrom(data, TENANT_FIELDS, { extra: ['property'] })
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
    const raw = { ...createBlankLoan(), ...patchFrom(data, LOAN_FIELDS, { extra: ['property'] }) }
    if (data.property || raw.propertyId) raw.propertyId = propertyIdFrom(state, data.property || raw.propertyId)
    if (Object.prototype.hasOwnProperty.call(raw, 'rate')) raw.rate = normalizeRate(raw.rate)
    const next = applyLoanToPortfolio(state, raw)
    const loan = next.loans.find((item) => item.id === raw.id)
    return writeResult(next, `Added loan ${loan?.lender || loan?.id || ''}.`.trim(), { entity: loan })
  }

  if (operation === 'loan.update') {
    const previous = requireEntity(state.loans, target, 'Loan', ['lender', 'mortgageNumber'])
    const patch = patchFrom(data, LOAN_FIELDS, { extra: ['property'] })
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
      ...patchFrom(data, TIMELINE_FIELDS, { extra: ['property'] }),
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
    const patch = patchFrom(data, TIMELINE_FIELDS, { extra: ['property'] })
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
