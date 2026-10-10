import { describe, expect, it } from 'vitest'
import { createBlankProperty } from './data.js'
import { executePortfolioAction } from './lunaCapabilities.js'

const state = () => ({
  properties: [{
    ...createBlankProperty('BTL1'), id: 'btla', active: true, rent: 1200, latestValuation: 250000,
    loanAmount: 175000, gasExpiry: '2099-06-01',
  }],
  loans: [{ id: 'loan-a', propertyId: 'btla', lender: 'Bank', principalAmount: 175000, currentBalance: 175000, rate: 0.05, interestOnly: true, termMonths: 240 }],
  tenants: [], expenses: [], credentials: [], contractors: [], contractorTags: [],
  acquisitionScenarios: [], remortgageComparisons: [], performanceEvents: [], propertyTimelineEvents: [],
  settings: { taxJurisdiction: 'scotland', appreciationRate: 0.03, rentGrowthRate: 0.02, rateShock: 0, companyCosts: [], extractions: [] },
})

const execute = (source, operation, target = null, data = {}, options = {}) =>
  executePortfolioAction(source, { operation, target, data }, options)

describe('Luna saved-planning and compliance operations', () => {
  it('creates, updates, duplicates, reorders and confirmation-gates acquisition scenarios', () => {
    let current = state()
    current = execute(current, 'acquisition.create', null, { name: 'Offer 1', purchasePrice: 190000, jurisdiction: 'scotland' }).state
    current = execute(current, 'acquisition.create', null, { name: 'Offer 2', purchasePrice: 150000 }).state
    current = execute(current, 'acquisition.update', 'Offer 1', { mortgageFee: 2500 }).state
    expect(current.acquisitionScenarios.find((item) => item.name === 'Offer 1').mortgageFee).toBe(2500)
    current = execute(current, 'acquisition.reorder', 'Offer 1', { index: 0 }).state
    expect(current.acquisitionScenarios[0].name).toBe('Offer 1')
    current = execute(current, 'acquisition.duplicate', 'Offer 1', { name: 'Offer 1 copy' }).state
    expect(current.acquisitionScenarios).toHaveLength(3)
    expect(new Set(current.acquisitionScenarios.map((item) => item.id)).size).toBe(3)
    expect(execute(current, 'acquisition.delete', 'Offer 1').confirmationRequired).toBe(true)
    current = execute(current, 'acquisition.delete', 'Offer 1', {}, { confirmed: true }).state
    expect(current.acquisitionScenarios).toHaveLength(2)
    expect(() => execute(current, 'acquisition.update', 'Offer 2', { invented: 123 })).toThrow(/Unsupported/)
  })

  it('compares remortgage scenarios with canonical calculation functions', () => {
    let current = state()
    current = execute(current, 'remortgage.create', 'BTL1', {
      name: 'BTL1 alternatives',
      right: { rate: 5.66, feeMode: 'amount', feeValue: 2000, addFeeToLoan: false },
    }).state
    const comparison = execute(current, 'remortgage.compare', 'BTL1 alternatives').result.comparison
    expect(comparison.right.rate).toBe(5.66)
    expect(comparison.right.fee).toBe(2000)
    expect(comparison.annualCashFlowChange).toBeCloseTo(comparison.monthlyCashFlowChange * 12)
    current = execute(current, 'remortgage.update', 'BTL1 alternatives', { right: { rate: 5.4 } }).state
    expect(current.remortgageComparisons[0].right.rate).toBe(5.4)
    current = execute(current, 'remortgage.duplicate', 'BTL1 alternatives').state
    expect(current.remortgageComparisons).toHaveLength(2)
    expect(execute(current, 'remortgage.delete', 'BTL1 alternatives').confirmationRequired).toBe(true)
    expect(() => execute(current, 'remortgage.update', 'BTL1 alternatives', { right: { impossible: 42 } })).toThrow(/Unsupported/)
  })

  it('creates and edits canonical signed manual performance events', () => {
    let current = state()
    current = execute(current, 'performance_event.create', 'BTL1', {
      title: 'Corporation tax bill', type: 'tax', amount: 250, occurredAt: '2026-08-15',
    }).state
    expect(current.performanceEvents[0]).toMatchObject({
      propertyId: 'btla', type: 'tax', amount: -250, occurredAt: '2026-08-15',
    })
    current = execute(current, 'performance_event.update', 'Corporation tax bill', { notes: 'FY2025' }).state
    expect(current.performanceEvents[0].notes).toBe('FY2025')
    expect(execute(current, 'performance_event.delete', 'Corporation tax bill').confirmationRequired).toBe(true)
    current = execute(current, 'performance_event.delete', 'Corporation tax bill', {}, { confirmed: true }).state
    expect(current.performanceEvents).toEqual([])
  })

  it('updates Next BTL preferences with the existing normalizer and reads generated reminders', () => {
    let current = state()
    current = execute(current, 'next_btl.update', null, {
      targetPrice: 190000, scenarioIndex: 1, preserveBuffer: true,
    }).state
    expect(execute(current, 'next_btl.get').result).toMatchObject({
      targetPrice: 190000, scenarioIndex: 1, preserveBuffer: true,
    })
    const reminders = execute(current, 'notification.list').result
    const event = reminders.scheduled.find((item) => item.type === 'gas')
    expect(event).toMatchObject({ propertyName: 'BTL1', dueDate: '2099-06-01' })
    current = execute(current, 'notification.dismiss', event.key).state
    expect(current.notificationPreferences.dismissed).toHaveProperty(event.key)
    current = execute(current, 'notification.snooze', event.key, { days: 4 }).state
    expect(current.notificationPreferences.dismissed).not.toHaveProperty(event.key)
    expect(current.notificationPreferences.snoozedUntil).toHaveProperty(event.key)
    expect(() => execute(current, 'next_btl.update', null, { impossible: true })).toThrow(/Unsupported/)
  })

  it('can atomically edit acquisition and property administration in a single batch', () => {
    const result = execute(state(), 'portfolio.batch', null, { actions: [
      { operation: 'acquisition.create', target: null, data: { name: 'BTL opportunity', purchasePrice: 190000 } },
      { operation: 'property.update', target: 'BTL1', data: { factorsProvider: 'Speirs Gumley' } },
    ] })
    expect(result.state.acquisitionScenarios).toHaveLength(1)
    expect(result.state.properties[0].factorsProvider).toBe('Speirs Gumley')
  })
})
