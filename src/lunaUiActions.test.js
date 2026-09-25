import { describe, expect, it, vi } from 'vitest'
import {
  dispatchClientUiActions,
  validateClientUiAction,
  validateClientUiActions,
} from './lunaUiActions.js'
import { executeLunaUiOperation } from './lunaUiOperations.js'
import { safeLunaChatActions, validateLunaChatAction } from './lunaChatActions.js'

const portfolio = {
  properties: [
    { id: 'property-btl-1', name: 'BTL1', address: '1 Main Street', active: true },
    { id: 'property-btl-2', name: 'BTL2', address: '2 Main Street', active: true },
  ],
  settings: { accountType: 'company' },
}

describe('Luna semantic UI action validation', () => {
  it('accepts only allow-listed workspaces, real entities and acquisition fields', () => {
    expect(validateClientUiActions([
      { type: 'navigate', workspace: 'performance' },
      { type: 'open_entity', workspace: 'performance', entityType: 'property', entityId: 'property-btl-1' },
      { type: 'set_form_fields', form: 'acquisition_simulator', fields: { purchasePrice: 200000, ltv: 75 } },
      { type: 'run_existing_simulation', simulator: 'acquisition' },
    ], portfolio)).toHaveLength(4)

    expect(() => validateClientUiAction({ type: 'navigate', workspace: 'https://evil.example' })).toThrow('Unsupported Luna workspace')
    expect(() => validateClientUiAction({ type: 'navigate', workspace: 'performance', script: 'alert(1)' })).toThrow()
    expect(() => validateClientUiAction({ type: 'open_entity', workspace: 'performance', entityType: 'property', entityId: 'invented' }, portfolio)).toThrow('no longer exists')
    expect(() => validateClientUiAction({ type: 'set_form_fields', form: 'acquisition_simulator', fields: { purchasePrice: 200000, selector: '#root' } })).toThrow('Unsupported acquisition simulator field')
    expect(() => validateClientUiAction({ type: 'run_existing_simulation', simulator: 'javascript' })).toThrow('Unsupported Luna simulation action')
  })

  it('safely rejects unknown actions while dispatching recognised semantic actions only', () => {
    const navigateWorkspace = vi.fn()
    const runSimulation = vi.fn()
    const arbitrary = vi.fn()
    const result = dispatchClientUiActions([
      { type: 'execute_javascript', code: 'arbitrary()' },
      { type: 'navigate', workspace: 'acquisition' },
      { type: 'set_form_fields', form: 'acquisition_simulator', fields: { purchasePrice: 200000 } },
      { type: 'run_existing_simulation', simulator: 'acquisition' },
    ], portfolio, { navigateWorkspace, runSimulation, arbitrary })

    expect(result.accepted).toHaveLength(3)
    expect(result.rejected).toHaveLength(1)
    expect(navigateWorkspace).toHaveBeenCalledWith('acquisition')
    expect(runSimulation).toHaveBeenCalledWith('acquisition', { purchasePrice: 200000 })
    expect(arbitrary).not.toHaveBeenCalled()
  })

  it('validates chat chip labels and rejects unknown or stale action descriptors', () => {
    expect(validateLunaChatAction({
      label: 'Open BTL1',
      actions: [
        { type: 'navigate', workspace: 'properties' },
        { type: 'open_entity', workspace: 'properties', entityType: 'property', entityId: 'property-btl-1' },
      ],
    }, portfolio).label).toBe('Open BTL1')

    expect(safeLunaChatActions([
      { label: 'Unknown', actions: [{ type: 'execute_javascript', code: 'alert(1)' }] },
      { label: 'Stale property', actions: [{ type: 'open_entity', workspace: 'properties', entityType: 'property', entityId: 'missing' }] },
    ], portfolio)).toEqual([])
  })
})

describe('Luna server-side UI operation resolution', () => {
  it('resolves a spaced BTL reference to the real property ID for Performance', () => {
    expect(executeLunaUiOperation(portfolio, {
      operation: 'property.open',
      workspace: 'performance',
      target: 'BTL 1',
      data: null,
    })).toMatchObject({
      property: { id: 'property-btl-1', name: 'BTL1' },
      actions: [
        { type: 'navigate', workspace: 'performance' },
        { type: 'open_entity', workspace: 'performance', entityType: 'property', entityId: 'property-btl-1' },
      ],
    })
  })

  it('returns the complete deterministic acquisition action sequence', () => {
    expect(executeLunaUiOperation(portfolio, {
      operation: 'acquisition.simulate',
      workspace: 'acquisition',
      target: null,
      data: { purchasePrice: 200000 },
    }).actions).toEqual([
      { type: 'navigate', workspace: 'acquisition' },
      { type: 'set_form_fields', form: 'acquisition_simulator', fields: { purchasePrice: 200000 } },
      { type: 'run_existing_simulation', simulator: 'acquisition' },
    ])
  })

  it('does not silently choose an ambiguous property', () => {
    const ambiguous = { ...portfolio, properties: [
      { id: 'one', name: 'BTL North' },
      { id: 'two', name: 'BTL South' },
    ] }
    expect(() => executeLunaUiOperation(ambiguous, {
      operation: 'property.open', workspace: 'performance', target: 'BTL', data: null,
    })).toThrow('not found or ambiguous')
  })
})
