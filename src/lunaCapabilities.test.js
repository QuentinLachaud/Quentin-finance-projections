import { describe, expect, it } from 'vitest'
import { executePortfolioAction, LUNA_PHASE_ONE_OPERATIONS, resolveLunaProperty } from './lunaCapabilities.js'
import { calculateProperty } from './calculations.js'
import { withPropertyLoans } from './loans.js'
import { propertyOperatingCashflow } from './portfolioFields.js'

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
  it('publishes the audited operations plus property-centric reads without duplicates', () => {
    expect(LUNA_PHASE_ONE_OPERATIONS).toHaveLength(53)
    expect(new Set(LUNA_PHASE_ONE_OPERATIONS).size).toBe(53)
    expect(LUNA_PHASE_ONE_OPERATIONS).toEqual(expect.arrayContaining([
      'property.loans', 'property.tenants', 'property.financial_summary',
    ]))
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

  it('resolves BTL1 exactly before finding its related loans and tenants', () => {
    const state = {
      ...blank(),
      properties: [
        { id: 'property-1', name: 'BTL1', address: '1 Main Street', postcode: 'G1 1AA', rent: 1450, active: true },
        { id: 'property-10', name: 'BTL10', address: '10 Main Street', postcode: 'G10 1AA', rent: 2100, active: true },
      ],
      loans: [
        { id: 'loan-a', propertyId: 'property-1', lender: 'Alpha Bank', principalAmount: 100000, currentBalance: 90000, rate: 0.04, interestOnly: true, termMonths: 240 },
        { id: 'loan-b', propertyId: 'property-1', lender: 'Beta Bank', principalAmount: 30000, currentBalance: 25000, rate: 0.05, interestOnly: false, termMonths: 180 },
        { id: 'loan-other', propertyId: 'property-10', lender: 'Other Bank', principalAmount: 150000, rate: 0.04 },
      ],
      tenants: [
        { id: 'tenant-a', propertyId: 'property-1', name: 'Alex' },
        { id: 'tenant-other', propertyId: 'property-10', name: 'Morgan' },
      ],
    }

    expect(resolveLunaProperty(state, 'BTL 1').id).toBe('property-1')
    expect(run(state, 'property.get', 'BTL1').result.rent).toBe(1450)

    const loans = run(state, 'property.loans', 'BTL1').result
    expect(loans.property.id).toBe('property-1')
    expect(loans.loans.map((loan) => loan.id)).toEqual(['loan-a', 'loan-b'])
    expect(loans.summary.loanCount).toBe(2)

    const tenants = run(state, 'property.tenants', 'BTL1').result
    expect(tenants.tenants).toEqual([expect.objectContaining({ id: 'tenant-a', name: 'Alex' })])
  })

  it('uses the UI calculation path for property net monthly income', () => {
    const property = {
      id: 'property-1', name: 'BTL1', rent: 1500, active: true, latestValuation: 220000,
      factorsFees: 80, repairs: 45, applianceReserve: 20, legionella: 5,
      gasCertificate: 6, eicr: 4, mortgageAdmin: 10, voidsOverride: 100,
    }
    const state = {
      ...blank(),
      properties: [property],
      loans: [{
        id: 'loan-a', propertyId: 'property-1', lender: 'Alpha Bank', principalAmount: 120000,
        currentBalance: 120000, rate: 0.05, interestOnly: true, termMonths: 240,
      }],
      settings: { ...blank().settings, fullyManaged: true, managementRate: 0.1, rateShock: 0 },
    }
    const calculated = calculateProperty(withPropertyLoans(state.properties, state.loans)[0], state.settings)
    const expected = propertyOperatingCashflow(calculated, state.settings)
    const summary = run(state, 'property.financial_summary', 'BTL1').result

    expect(summary.metricLabel).toBe('Operating cash flow / month')
    expect(summary.operatingCashflow).toBeCloseTo(expected)
    expect(summary.components).toMatchObject({ rent: 1500, mortgagePayment: 500, management: 150 })
  })
})
