import { validateClientUiActions } from './lunaUiActions.js'

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key))
const clean = (value) => String(value ?? '').trim()

export function validateLunaChatAction(rawDescriptor, context = {}) {
  if (!isRecord(rawDescriptor) || !exactKeys(rawDescriptor, ['label', 'actions'])) {
    throw new Error('Invalid Luna chat action.')
  }
  const label = clean(rawDescriptor.label)
  if (!label || label.length > 64 || /[\u0000-\u001f\u007f]/.test(label)) {
    throw new Error('Invalid Luna chat action label.')
  }
  if (!Array.isArray(rawDescriptor.actions) || !rawDescriptor.actions.length || rawDescriptor.actions.length > 3) {
    throw new Error('Invalid Luna chat action sequence.')
  }
  return { label, actions: validateClientUiActions(rawDescriptor.actions, context) }
}

export const safeLunaChatActions = (rawActions, context = {}) => {
  if (!Array.isArray(rawActions)) return []
  const accepted = []
  for (const rawAction of rawActions.slice(0, 3)) {
    try {
      accepted.push(validateLunaChatAction(rawAction, context))
    } catch {
      // Invalid or stale descriptors fail closed and are not rendered.
    }
  }
  return accepted
}

const propertyAction = (portfolio, property, workspace, label) => {
  const entityId = clean(property?.id)
  if (!entityId) return null
  return validateLunaChatAction({
    label,
    actions: [
      { type: 'navigate', workspace },
      { type: 'open_entity', workspace, entityType: 'property', entityId },
    ],
  }, {
    accountType: portfolio?.settings?.accountType || 'company',
    properties: portfolio?.properties || [],
  })
}

const workspaceAction = (portfolio, workspace, label) => validateLunaChatAction({
  label,
  actions: [{ type: 'navigate', workspace }],
}, { accountType: portfolio?.settings?.accountType || 'company' })

export function chatActionsForPortfolioResult(portfolio = {}, args = {}, result = null) {
  const operation = clean(args?.operation)
  const property = operation === 'property.get' ? result : result?.property

  if (operation === 'property.get') {
    const action = propertyAction(portfolio, property, 'properties', `Open ${clean(property?.name) || 'property'}`)
    return action ? [action] : []
  }
  if (operation === 'property.loans') {
    const action = propertyAction(portfolio, property, 'loans', 'Open loans')
    return action ? [action] : [workspaceAction(portfolio, 'loans', 'Open loans')]
  }
  if (operation === 'property.tenants') {
    const action = propertyAction(portfolio, property, 'tenants', 'Open tenants')
    return action ? [action] : [workspaceAction(portfolio, 'tenants', 'Open tenants')]
  }
  if (operation === 'property.financial_summary') {
    const propertyName = clean(property?.name) || 'property'
    const actions = [propertyAction(portfolio, property, 'properties', `Open ${propertyName}`)]
    actions.push(propertyAction(portfolio, property, 'performance', 'Open performance'))
    return actions.filter(Boolean)
  }
  if (operation.startsWith('loan.')) return [workspaceAction(portfolio, 'loans', 'Open loans')]
  if (operation.startsWith('tenant.')) return [workspaceAction(portfolio, 'tenants', 'Open tenants')]
  if (operation.startsWith('expense.')) return [workspaceAction(portfolio, 'expenses', 'Open expenses')]
  if (operation.startsWith('company_cost.') || operation.startsWith('extraction.')) {
    return [workspaceAction(portfolio, 'costs', 'Open costs & cash flows')]
  }
  return []
}

export const mergeLunaChatActions = (...groups) => {
  const merged = []
  const seen = new Set()
  for (const descriptor of groups.flat()) {
    if (!descriptor) continue
    const key = JSON.stringify(descriptor.actions)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(descriptor)
    if (merged.length === 3) break
  }
  return merged
}
