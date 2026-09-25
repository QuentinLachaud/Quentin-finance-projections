import { resolveLunaProperty } from './lunaCapabilities.js'
import {
  LUNA_PROPERTY_WORKSPACES,
  LUNA_WORKSPACE_IDS,
  LUNA_WORKSPACES,
  validateAcquisitionSimulatorFields,
  validateClientUiActions,
} from './lunaUiActions.js'

export const LUNA_UI_OPERATIONS = Object.freeze([
  'workspace.open',
  'property.open',
  'acquisition.simulate',
])

const clean = (value) => String(value ?? '').trim()
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const workspaceLabel = (workspace) => LUNA_WORKSPACES[workspace] || 'Settings'

export function executeLunaUiOperation(portfolio = {}, rawArgs = {}) {
  if (!isRecord(rawArgs)
    || Object.keys(rawArgs).some((key) => !['operation', 'workspace', 'target', 'data'].includes(key))
    || typeof rawArgs.operation !== 'string'
    || typeof rawArgs.workspace !== 'string'
    || (rawArgs.target != null && typeof rawArgs.target !== 'string')
    || (rawArgs.data != null && !isRecord(rawArgs.data))) {
    throw new Error('Invalid Luna UI operation payload.')
  }
  const operation = clean(rawArgs.operation)
  const workspace = clean(rawArgs.workspace)
  const target = rawArgs.target == null ? '' : clean(rawArgs.target)
  const data = rawArgs.data && typeof rawArgs.data === 'object' && !Array.isArray(rawArgs.data) ? rawArgs.data : {}
  const accountType = portfolio?.settings?.accountType || 'company'

  if (!LUNA_UI_OPERATIONS.includes(operation)) throw new Error(`Unsupported Luna UI operation: ${operation}`)

  if (operation === 'workspace.open') {
    if (target || Object.keys(data).length) throw new Error('Workspace navigation does not accept a target or data.')
    const actions = validateClientUiActions([{ type: 'navigate', workspace }], { accountType })
    return { ok: true, message: `Opened ${workspaceLabel(workspace)}.`, actions }
  }

  if (operation === 'property.open') {
    if (!LUNA_PROPERTY_WORKSPACES.includes(workspace)) throw new Error('That workspace does not support property selection.')
    if (Object.keys(data).length) throw new Error('Property navigation does not accept form data.')
    const property = resolveLunaProperty(portfolio, target)
    if (property.id == null || !clean(property.id)) throw new Error('The resolved property has no stable identifier.')
    const actions = validateClientUiActions([
      { type: 'navigate', workspace },
      { type: 'open_entity', workspace, entityType: 'property', entityId: String(property.id) },
    ], { accountType, properties: portfolio.properties || [] })
    return {
      ok: true,
      message: `Opened ${workspaceLabel(workspace)} for ${property.name || property.address || property.id}.`,
      property: { id: property.id, name: property.name || '' },
      actions,
    }
  }

  if (workspace !== 'acquisition' || target) throw new Error('Acquisition simulation must target the Acquisition Simulator.')
  const fields = validateAcquisitionSimulatorFields(data)
  const actions = validateClientUiActions([
    { type: 'navigate', workspace: 'acquisition' },
    { type: 'set_form_fields', form: 'acquisition_simulator', fields },
    { type: 'run_existing_simulation', simulator: 'acquisition' },
  ], { accountType })
  return {
    ok: true,
    message: `Opened Acquisition Simulator${fields.purchasePrice ? ` with a £${fields.purchasePrice.toLocaleString('en-GB')} purchase price` : ''} and recalculated the scenario.`,
    actions,
  }
}

export { LUNA_WORKSPACE_IDS }
