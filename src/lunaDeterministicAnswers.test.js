import { describe, expect, it } from 'vitest'
import {
  answerDeterministicPortfolioQuestion,
  detectDeterministicPortfolioRead,
} from './lunaDeterministicAnswers.js'

const portfolio = {
  properties: [
    {
      id: 'property-btl1', name: 'BTL1', address: '1 Main Street', postcode: 'G1 1AA',
      rent: 1500, latestValuation: 220000, active: true, factorsFees: 80, repairs: 40,
      applianceReserve: 20, legionella: 5, gasCertificate: 5, eicr: 5,
      mortgageAdmin: 10, voidsOverride: 100,
    },
    { id: 'property-btl10', name: 'BTL10', address: '10 Main Street', postcode: 'G10 1AA', rent: 2100, active: true },
  ],
  loans: [
    { id: 'loan-1', propertyId: 'property-btl1', lender: 'Alpha', currentBalance: 100000, principalAmount: 100000, rate: 0.048, interestOnly: true, termMonths: 240 },
    { id: 'loan-2', propertyId: 'property-btl1', lender: 'Beta', currentBalance: 25000, principalAmount: 30000, rate: 0.05, interestOnly: false, termMonths: 180 },
  ],
  tenants: [
    { id: 'tenant-1', propertyId: 'property-btl1', name: 'Alex' },
    { id: 'tenant-2', propertyId: 'property-btl10', name: 'Morgan' },
  ],
  settings: { accountType: 'company', rateShock: 0, fullyManaged: false, companyCosts: [], extractions: [] },
}

describe('Luna deterministic obvious-property questions', () => {
  it.each([
    ['what is rent for BTL1?', 'property.get'],
    ['BTL1 loan?', 'property.loans'],
    ['what loan does BTL1 have?', 'property.loans'],
    ['what is BTL1 net monthly income?', 'property.financial_summary'],
    ['who is the tenant for BTL1?', 'property.tenants'],
    ['who are the tenants?', 'tenant.list'],
  ])('selects the deterministic read for “%s”', (question, operation) => {
    expect(detectDeterministicPortfolioRead(portfolio, question)?.operation).toBe(operation)
  })

  it('returns stored rent and a validated follow-up action without navigation side effects', () => {
    const answer = answerDeterministicPortfolioQuestion(portfolio, 'what is rent for BTL1?')
    expect(answer.operation).toBe('property.get')
    expect(answer.message).toContain('£1,500')
    expect(answer.chatActions).toEqual([{
      label: 'Open BTL1',
      actions: [
        { type: 'navigate', workspace: 'properties' },
        { type: 'open_entity', workspace: 'properties', entityType: 'property', entityId: 'property-btl1' },
      ],
    }])
  })

  it('reports every loan linked to the resolved property and no unrelated loan', () => {
    const answer = answerDeterministicPortfolioQuestion(portfolio, 'BTL1 loan?')
    expect(answer.message).toContain('2 linked loans')
    expect(answer.message).toContain('Alpha')
    expect(answer.message).toContain('Beta')
    expect(answer.message).not.toContain('BTL10')
    expect(answer.chatActions[0].label).toBe('Open loans')
  })

  it('reports only tenants linked to BTL1', () => {
    const answer = answerDeterministicPortfolioQuestion(portfolio, 'who is the tenant for BTL1?')
    expect(answer.message).toContain('Alex')
    expect(answer.message).not.toContain('Morgan')
  })

  it('does not confuse BTL1 with BTL10 or choose when both are named', () => {
    expect(detectDeterministicPortfolioRead(portfolio, 'what is rent for BTL10?')).toMatchObject({
      operation: 'property.get', target: 'property-btl10',
    })
    expect(detectDeterministicPortfolioRead(portfolio, 'compare the loans for BTL1 and BTL10')).toBeNull()
  })
})
