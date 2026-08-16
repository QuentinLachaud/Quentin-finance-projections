import { describe, expect, it } from 'vitest'
import { assumptions, createBlankProperty, newAccountDefaults } from './data.js'

describe('new account defaults', () => {
  it('starts cash held and rate shock at zero', () => {
    expect(newAccountDefaults).toMatchObject({ cashHeld: 0, rateShock: 0 })
  })

  it('uses conservative tax defaults that do not silently deduct planning budgets', () => {
    expect(assumptions).toMatchObject({
      associatedCompanies: 0,
      accountingPeriodMonths: 12,
      augmentedProfitDistributions: 0,
      closeInvestmentHoldingCompany: false,
      budgetedPropertyCostsTaxDeductible: false,
      propertyLossBroughtForward: 0,
      financeCostsBroughtForward: 0,
    })
    expect(assumptions).not.toHaveProperty('corporationTaxRate')
  })

  it('leaves the private-tax qualifying finance balance blank so the full loan is used by default', () => {
    expect(createBlankProperty('BTL1').qualifyingFinanceBalance).toBe('')
  })
})
