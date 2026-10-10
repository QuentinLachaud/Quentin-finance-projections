import { describe, expect, it } from 'vitest'
import { createBlankProperty } from './data.js'
import { executePortfolioAction } from './lunaCapabilities.js'
import { tenantDepositDetails } from './tenants.js'

const fixture = () => {
  const a = {
    ...createBlankProperty('BTL1'), id: 'btl-one', address: '130 Kelvinhaugh Street',
    postcode: 'G3 8PP', active: true, rent: 1500, latestValuation: 260000, loanAmount: 180000,
    factorsFees: 100, depositScheme: 'SafeDeposits Scotland',
  }
  const b = {
    ...createBlankProperty('BTL2'), id: 'btl-two', address: '20 Rutland Court',
    postcode: 'G51 1JW', active: true, rent: 1100, latestValuation: 150000, loanAmount: 112000,
  }
  const loans = [
    { id: 'loan-one', propertyId: a.id, lender: 'Paragon', principalAmount: 180000, loanAmount: 180000, rate: 0.05, interestOnly: true, termMonths: 300, mortgageNumber: '' },
    { id: 'loan-two', propertyId: b.id, lender: 'TMW', principalAmount: 112000, loanAmount: 112000, rate: 0.04, interestOnly: true, termMonths: 240, mortgageNumber: '' },
  ]
  return {
    properties: [a, b], loans,
    tenants: [{ id: 'tenant-one', propertyId: a.id, name: 'Scott' }, { id: 'tenant-two', propertyId: b.id, name: 'Joaquim' }],
    contractors: [], contractorTags: [], propertyTimelineEvents: [], performanceEvents: [],
    expenses: [{ id: 'expense-one', property: 'BTL1', amount: -100, description: 'Maintenance', date: '2026-09-01' }],
    credentials: [{ id: 'secret', name: 'Hidden', value: 'DO_NOT_EXPOSE' }],
    acquisitionScenarios: [], remortgageComparisons: [],
    settings: { appreciationRate: 0.03, rentGrowthRate: 0.02, rateShock: 0, cashHeld: 12500, companyCosts: [], extractions: [], accountType: 'company' },
  }
}

const execute = (state, operation, target = null, data = null, options = {}) =>
  executePortfolioAction(state, { operation, target, data }, options)

describe('Luna capability parity: atomic writes and portfolio context', () => {
  it('updates every property administration field and its linked mortgage number without modifying unrelated data', () => {
    const source = fixture()
    const fields = {
      factorsProvider: 'Speirs Gumley',
      factorsAccountNumber: '99530067',
      mortgageNumber: '5276550',
      buildingsInsuranceProvider: 'AXA Insurance UK plc',
      buildingsInsurancePolicyNumber: 'LP BDX 7149835/SGP/B135-R',
      buildingsInsuranceInsuredValue: 14099982,
      depositScheme: 'SafeDeposits Scotland',
      depositRegistrationNumber: 'DAN830177',
    }
    const result = execute(source, 'property.update', 'BTL 1', fields)
    expect(result.result.changes).toEqual(fields)
    expect(result.state.properties[0]).toMatchObject(fields)
    expect(result.state.properties[0].rent).toBe(1500)
    expect(result.state.properties[1]).toEqual(source.properties[1])
    expect(result.state.loans[0]).toMatchObject({ mortgageNumber: '5276550', lender: 'Paragon', principalAmount: 180000, rate: 0.05 })
    expect(result.state.loans[1]).toEqual(source.loans[1])
    expect(source.properties[0].factorsAccountNumber).toBe('')
    expect(source.loans[0].mortgageNumber).toBe('')
    expect(tenantDepositDetails(result.state.tenants[0], result.state.properties).registrationNumber).toBe('DAN830177')
  })

  it('updates BTL2 to mydeposits and preserves existing insurance when omitted', () => {
    const source = fixture()
    source.properties[1].buildingsInsurancePolicyNumber = 'Existing policy'
    const result = execute(source, 'property.update', 'BTL2', {
      depositScheme: 'mydeposits Scotland',
      depositRegistrationNumber: 'DPC421785',
      factorsProvider: 'Speirs Gumley',
      mortgageNumber: '22361966',
    })
    expect(result.state.properties[1].buildingsInsurancePolicyNumber).toBe('Existing policy')
    expect(result.state.loans[1].mortgageNumber).toBe('22361966')
    expect(tenantDepositDetails(result.state.tenants[1], result.state.properties)).toMatchObject({
      scheme: 'mydeposits Scotland', registrationNumber: 'DPC421785',
    })
  })

  it('rejects unknown fields, invalid amounts and no-op requests instead of acknowledging a fake success', () => {
    for (const patch of [{ inventedProvider: 'test', factorsProvider: 'Test' }, { buildingsInsuranceInsuredValue: 'not a number' }, {}]) {
      const source = fixture()
      const before = JSON.stringify(source)
      expect(() => execute(source, 'property.update', 'BTL1', patch)).toThrow()
      expect(JSON.stringify(source)).toBe(before)
    }
  })

  it('refuses to guess the intended mortgage when a property has multiple loans', () => {
    const source = fixture()
    source.loans.push({ id: 'loan-more', propertyId: 'btl-one', lender: 'Other', mortgageNumber: 'OLD' })
    expect(() => execute(source, 'property.update', 'BTL1', { mortgageNumber: 'NEW' })).toThrow(/multiple loans/)
    expect(source.loans[0].mortgageNumber).toBe('')
  })

  it('supports atomic multi-property, multi-entity writes, returning all changes together', () => {
    const source = fixture()
    const result = execute(source, 'portfolio.batch', null, { actions: [
      { operation: 'property.update', target: 'BTL1', data: { factorsAccountNumber: '99530067' } },
      { operation: 'property.update', target: 'BTL2', data: { depositScheme: 'mydeposits Scotland', depositRegistrationNumber: 'DPC421785' } },
      { operation: 'expense.create', target: null, data: { property: 'BTL2', description: 'Gas inspection', amount: -90 } },
    ] })
    expect(result.mutated).toBe(true)
    expect(result.result.actions).toHaveLength(3)
    expect(result.state.properties[0].factorsAccountNumber).toBe('99530067')
    expect(result.state.properties[1].depositRegistrationNumber).toBe('DPC421785')
    expect(result.state.expenses).toHaveLength(2)
    expect(source.expenses).toHaveLength(1)
  })

  it('does not partially mutate source state if any batch action fails', () => {
    const source = fixture()
    const original = JSON.stringify(source)
    expect(() => execute(source, 'portfolio.batch', null, { actions: [
      { operation: 'property.update', target: 'BTL1', data: { factorsProvider: 'Valid' } },
      { operation: 'property.update', target: 'BTL2', data: { nonExistentField: 'invalid' } },
    ] })).toThrow(/Unsupported property field/)
    expect(JSON.stringify(source)).toBe(original)
  })

  it('gates destructive batch operations behind confirmation', () => {
    const state = fixture()
    const action = { actions: [{ operation: 'property.delete', target: 'BTL2', data: {} }] }
    const pending = execute(state, 'portfolio.batch', null, action)
    expect(pending.confirmationRequired).toBe(true)
    expect(pending.state.properties).toHaveLength(2)
    const confirmed = execute(state, 'portfolio.batch', null, action, { confirmed: true })
    expect(confirmed.state.properties.map((x) => x.name)).toEqual(['BTL1'])
  })

  it('returns linked property context and scoped portfolio records without leaking credential values', () => {
    const state = fixture()
    const context = execute(state, 'property.context', 'BTL1').result
    expect(context.metrics.monthlyRent).toBe(1500)
    expect(context.loans.map((x) => x.id)).toEqual(['loan-one'])
    expect(context.tenants.map((x) => x.name)).toEqual(['Scott'])
    expect(context.expenses.map((x) => x.id)).toEqual(['expense-one'])
    const catalog = execute(state, 'portfolio.context', 'BTL1', { collections: ['properties', 'loans', 'tenants', 'expenses'] }).result
    expect(catalog.collections.properties.total).toBe(1)
    const paginated = execute(state, 'portfolio.context', null, { collections: ['properties'], limit: 1, offset: 1 }).result
    expect(paginated.collections.properties.items.map((item) => item.name)).toEqual(['BTL2'])
    expect(paginated.collections.properties.nextOffset).toBeNull()
    expect(catalog.collections.expenses.total).toBe(1)
    expect(JSON.stringify(catalog)).not.toContain('DO_NOT_EXPOSE')
    expect(() => execute(state, 'portfolio.context', null, { collections: ['credentials'] })).toThrow()
  })

  it('uses the app calculation engines for whole-portfolio and selected-property totals', () => {
    const state = fixture()
    const all = execute(state, 'portfolio.financial_summary').result
    expect(all.propertyCount).toBe(2)
    expect(all.monthlyRent).toBe(2600)
    expect(all.totalValue).toBe(410000)
    expect(all.totalDebt).toBe(292000)
    expect(all.totalEquity).toBe(118000)
    expect(all.scenarios).toHaveLength(3)
    const selected = execute(state, 'portfolio.financial_summary', null, { properties: ['BTL1'] }).result
    expect(selected.propertyCount).toBe(1)
    expect(selected.monthlyRent).toBe(1500)
    expect(selected.scope).toMatch(/excluding shared company costs/)
  })

  it('creates a bounded forecast from the app projection engine', () => {
    const forecast = execute(fixture(), 'portfolio.projection', null, { months: 24, milestones: [0, 12, 24] }).result
    expect(forecast.milestones.map((x) => x.month)).toEqual([0, 12, 24])
    expect(forecast.milestones[0].scenarios).toHaveLength(3)
    expect(() => execute(fixture(), 'portfolio.projection', null, { months: 600 })).toThrow()
  })

  it('does not clone tenant deposit IDs, mortgage numbers or original insurance policy identity', () => {
    const state = fixture()
    state.properties[0].depositRegistrationNumber = 'ORIGINAL'
    state.properties[0].mortgageNumber = 'ORIGINAL'
    state.properties[0].buildingsInsurancePolicyNumber = 'ORIGINAL'
    const copy = execute(state, 'property.clone', 'BTL1', { name: 'BTL3' }).state.properties.at(-1)
    expect(copy.depositRegistrationNumber).toBe('')
    expect(copy.mortgageNumber).toBe('')
    expect(copy.buildingsInsurancePolicyNumber).toBe('')
  })
})
