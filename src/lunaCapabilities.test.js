import { describe, expect, it } from 'vitest'
import { executePortfolioAction, LUNA_PHASE_ONE_OPERATIONS } from './lunaCapabilities.js'

const blank = () => ({
  properties: [],
  loans: [],
  tenants: [],
  contractors: [],
  contractorTags: [],
  propertyTimelineEvents: [],
  performanceEvents: [],
  expenses: [],
  credentials: [],
  acquisitionScenarios: [],
  remortgageComparisons: [],
  settings: { companyCosts: [], extractions: [], cashHeld: 0 },
})

const run = (state, operation, target = null, data = {}, options = {}) =>
  executePortfolioAction(state, { operation, target, data }, options)

describe('Luna phase-one portfolio capabilities', () => {
  it('publishes exactly the first 50 audited operations', () => {
    expect(LUNA_PHASE_ONE_OPERATIONS).toHaveLength(50)
    expect(new Set(LUNA_PHASE_ONE_OPERATIONS).size).toBe(50)
  })

  it('creates, updates and confirmation-gates deletion of a property', () => {
    const created = run(blank(), 'property.create', null, { name: 'BTL1', rent: 1500, postcode: 'G66' })
    expect(created.state.properties[0]).toMatchObject({ name: 'BTL1', rent: 1500, postcode: 'G66' })

    const updated = run(created.state, 'property.update', 'BTL1', { rent: 1650 })
    expect(updated.state.properties[0].rent).toBe(1650)

    const pending = run(updated.state, 'property.delete', 'BTL1')
    expect(pending.confirmationRequired).toBe(true)
    expect(pending.state.properties).toHaveLength(1)

    const deleted = run(updated.state, 'property.delete', 'BTL1', {}, { confirmed: true })
    expect(deleted.state.properties).toHaveLength(0)
  })

  it('supports tenant, expense, loan and contractor CRUD against a named BTL', () => {
    let state = run(blank(), 'property.create', null, { name: 'BTL1', latestValuation: 240000 }).state

    const tenant = run(state, 'tenant.create', 'BTL1', { name: 'Alex', rentPaymentDay: 6 })
    state = tenant.state
    expect(state.tenants[0]).toMatchObject({ name: 'Alex', rentPaymentDay: 6 })

    const expense = run(state, 'expense.create', null, { description: 'Boiler repair', property: 'BTL1', amount: -240 })
    state = expense.state
    expect(state.expenses[0].amount).toBe(-240)

    const loan = run(state, 'loan.create', null, { property: 'BTL1', lender: 'Test Bank', principalAmount: 180000, rate: 4.84 })
    state = loan.state
    expect(state.loans[0].rate).toBeCloseTo(0.0484)
    expect(state.loans[0].propertyId).toBe(state.properties[0].id)

    const contractor = run(state, 'contractor.create', null, { name: 'Pat Plumber', trade: 'Plumber', propertyIds: [state.properties[0].id] })
    state = contractor.state
    expect(state.contractors[0].name).toBe('Pat Plumber')

    state = run(state, 'tenant.update', 'Alex', { phone: '07000000000' }).state
    state = run(state, 'expense.update', 'Boiler repair', { notes: 'Invoice received' }).state
    state = run(state, 'loan.update', 'Test Bank', { rate: 5.1 }).state
    state = run(state, 'contractor.update', 'Pat Plumber', { phone: '07111111111' }).state

    expect(state.tenants[0].phone).toBe('07000000000')
    expect(state.expenses[0].notes).toBe('Invoice received')
    expect(state.loans[0].rate).toBeCloseTo(0.051)
    expect(state.contractors[0].phone).toBe('07111111111')
  })

  it('updates assumptions, cash-flow lines and manual timeline events', () => {
    let state = run(blank(), 'property.create', null, { name: 'BTL1' }).state
    state = run(state, 'settings.update', null, { appreciationRate: 3, cashHeld: 10000 }).state
    expect(state.settings.appreciationRate).toBeCloseTo(0.03)
    expect(state.settings.cashHeld).toBe(10000)

    state = run(state, 'company_cost.create', null, { name: 'Accountant', amount: 50 }).state
    state = run(state, 'extraction.create', null, { name: 'Landlord salary', amount: 750 }).state
    expect(state.settings.companyCosts[0].name).toBe('Accountant')
    expect(state.settings.extractions[0].name).toBe('Landlord salary')

    state = run(state, 'timeline.create', 'BTL1', { title: 'Boiler serviced', date: '2026-09-25', amount: 120 }).state
    expect(state.propertyTimelineEvents[0]).toMatchObject({ title: 'Boiler serviced', occurredAt: '2026-09-25' })
  })
})
