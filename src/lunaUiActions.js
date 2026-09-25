const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const exactKeys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key))

export const LUNA_WORKSPACES = Object.freeze({
  overview: 'Overview',
  properties: 'Properties',
  performance: 'Performance',
  loans: 'Loans',
  tenants: 'Tenants',
  contractors: 'Contractors',
  costs: 'Costs & Cash Flows',
  expenses: 'Documents & Expenses',
  banking: 'Banking',
  projections: 'Projections',
  acquisition: 'Acquisition Simulator',
  remortgage: 'Remortgage Simulator',
  compliance: 'Compliance',
  company_summary: 'Company Financial Summary',
  companies_house: 'Companies House',
  credentials: 'IDs & Credentials',
  plan: 'Plan & billing',
  settings: null,
})

export const LUNA_WORKSPACE_IDS = Object.freeze(Object.keys(LUNA_WORKSPACES))

export const LUNA_PROPERTY_WORKSPACES = Object.freeze([
  'properties',
  'performance',
  'loans',
  'tenants',
  'contractors',
  'expenses',
  'remortgage',
  'compliance',
])

const companyOnlyWorkspaces = new Set(['company_summary', 'companies_house'])
const propertyWorkspaces = new Set(LUNA_PROPERTY_WORKSPACES)

export const ACQUISITION_SIMULATOR_FIELDS = Object.freeze([
  'purchasePrice',
  'appreciationPercent',
  'scenarioIndex',
  'preserveBuffer',
  'includeExtraction',
  'includeRentGrowth',
  'jurisdiction',
  'ltv',
  'adsRate',
  'legalFees',
  'mortgageFee',
  'mortgageFeeAddedToLoan',
])

const finiteInRange = (value, minimum, maximum) => typeof value === 'number'
  && Number.isFinite(value)
  && value >= minimum
  && value <= maximum

export function validateAcquisitionSimulatorFields(rawFields) {
  if (!isRecord(rawFields) || !Object.keys(rawFields).length) {
    throw new Error('Acquisition simulator fields must be a non-empty object.')
  }
  if (!exactKeys(rawFields, ACQUISITION_SIMULATOR_FIELDS)) {
    throw new Error('Unsupported acquisition simulator field.')
  }

  const fields = { ...rawFields }
  for (const key of ['purchasePrice', 'legalFees', 'mortgageFee']) {
    if (key in fields && !finiteInRange(fields[key], key === 'purchasePrice' ? 1 : 0, 100000000)) {
      throw new Error(`Invalid acquisition simulator field: ${key}`)
    }
  }
  for (const key of ['ltv', 'adsRate']) {
    if (key in fields && !finiteInRange(fields[key], 0, 100)) throw new Error(`Invalid acquisition simulator field: ${key}`)
  }
  if ('appreciationPercent' in fields) {
    if (!finiteInRange(fields.appreciationPercent, -20, 30)) throw new Error('Invalid acquisition simulator field: appreciationPercent')
  }
  if ('scenarioIndex' in fields) {
    const scenario = fields.scenarioIndex
    if (!Number.isInteger(scenario) || scenario < 0 || scenario > 2) throw new Error('Invalid acquisition simulator field: scenarioIndex')
    fields.scenarioIndex = scenario
  }
  for (const key of ['preserveBuffer', 'includeExtraction', 'includeRentGrowth', 'mortgageFeeAddedToLoan']) {
    if (key in fields && typeof fields[key] !== 'boolean') throw new Error(`Invalid acquisition simulator field: ${key}`)
  }
  if ('jurisdiction' in fields && !['scotland', 'england-ni'].includes(fields.jurisdiction)) {
    throw new Error('Invalid acquisition simulator field: jurisdiction')
  }
  return fields
}

export function validateClientUiAction(rawAction, context = {}) {
  if (!isRecord(rawAction) || typeof rawAction.type !== 'string') throw new Error('Invalid Luna UI action.')

  if (rawAction.type === 'navigate') {
    if (!exactKeys(rawAction, ['type', 'workspace']) || !LUNA_WORKSPACE_IDS.includes(rawAction.workspace)) {
      throw new Error('Unsupported Luna workspace.')
    }
    if (context.accountType === 'private' && companyOnlyWorkspaces.has(rawAction.workspace)) {
      throw new Error('This workspace is unavailable for private-landlord accounts.')
    }
    return { type: 'navigate', workspace: rawAction.workspace }
  }

  if (rawAction.type === 'open_entity') {
    if (!exactKeys(rawAction, ['type', 'workspace', 'entityType', 'entityId'])
      || rawAction.entityType !== 'property'
      || !propertyWorkspaces.has(rawAction.workspace)
      || typeof rawAction.entityId !== 'string'
      || !rawAction.entityId.trim()) {
      throw new Error('Unsupported Luna entity action.')
    }
    if (Array.isArray(context.properties)
      && !context.properties.some((property) => String(property?.id) === rawAction.entityId)) {
      throw new Error('The Luna entity no longer exists.')
    }
    return { type: 'open_entity', workspace: rawAction.workspace, entityType: 'property', entityId: rawAction.entityId }
  }

  if (rawAction.type === 'set_form_fields') {
    if (!exactKeys(rawAction, ['type', 'form', 'fields']) || rawAction.form !== 'acquisition_simulator') {
      throw new Error('Unsupported Luna form action.')
    }
    return { type: 'set_form_fields', form: 'acquisition_simulator', fields: validateAcquisitionSimulatorFields(rawAction.fields) }
  }

  if (rawAction.type === 'run_existing_simulation') {
    if (!exactKeys(rawAction, ['type', 'simulator']) || rawAction.simulator !== 'acquisition') {
      throw new Error('Unsupported Luna simulation action.')
    }
    return { type: 'run_existing_simulation', simulator: 'acquisition' }
  }

  throw new Error(`Unsupported Luna UI action: ${rawAction.type}`)
}

export const validateClientUiActions = (actions, context = {}) => {
  if (!Array.isArray(actions)) throw new Error('Luna UI actions must be an array.')
  return actions.map((action) => validateClientUiAction(action, context))
}

export function dispatchClientUiActions(rawActions, context = {}, handlers = {}) {
  const accepted = []
  const rejected = []
  const pendingForms = new Map()

  for (const rawAction of Array.isArray(rawActions) ? rawActions : []) {
    let action
    try {
      action = validateClientUiAction(rawAction, context)
    } catch (error) {
      rejected.push({ action: rawAction, error: error.message })
      continue
    }

    accepted.push(action)
    if (action.type === 'navigate') handlers.navigateWorkspace?.(action.workspace)
    if (action.type === 'open_entity') handlers.openEntity?.(action)
    if (action.type === 'set_form_fields') {
      pendingForms.set(action.form, action.fields)
      handlers.setFormFields?.(action.form, action.fields)
    }
    if (action.type === 'run_existing_simulation') {
      handlers.runSimulation?.(action.simulator, pendingForms.get('acquisition_simulator') || null)
    }
  }

  return { accepted, rejected }
}
