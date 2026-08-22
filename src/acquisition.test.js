import { describe, expect, it } from 'vitest'
import { acquisitionCosts, createAcquisition } from './acquisition.js'

describe('Acquisition Simulator tax and cash calculations', () => {
  it('calculates Scottish LBTT and editable 8% ADS separately', () => {
    const result = acquisitionCosts(createAcquisition({
      purchasePrice: 200000,
      jurisdiction: 'scotland',
      ltv: 75,
      adsRate: 8,
      legalFees: 1500,
      mortgageFee: 0,
    }))
    expect(result.baseTax).toBe(1100)
    expect(result.supplement).toBe(16000)
    expect(result.transactionTax).toBe(17100)
    expect(result.deposit).toBe(50000)
    expect(result.cashRequired).toBe(68600)
  })

  it('recalculates Scottish ADS when the user edits the rate', () => {
    const result = acquisitionCosts(createAcquisition({
      purchasePrice: 250000,
      jurisdiction: 'scotland',
      adsRate: 6,
      legalFees: 0,
    }))
    expect(result.supplement).toBe(15000)
  })

  it('uses current higher-rate SDLT bands for an England or NI BTL', () => {
    const result = acquisitionCosts(createAcquisition({
      purchasePrice: 300000,
      jurisdiction: 'england-ni',
      legalFees: 0,
      mortgageFee: 0,
    }))
    expect(result.transactionTax).toBe(20000)
  })

  it('uses current Welsh higher residential LTT bands', () => {
    const result = acquisitionCosts(createAcquisition({
      purchasePrice: 260000,
      jurisdiction: 'wales',
      legalFees: 0,
      mortgageFee: 0,
    }))
    expect(result.transactionTax).toBe(15950)
  })

  it('only requires a mortgage product fee in cash when it is not added to the loan', () => {
    const base = {
      purchasePrice: 200000,
      jurisdiction: 'scotland',
      ltv: 75,
      adsRate: 8,
      legalFees: 1500,
      mortgageFee: 2500,
    }
    const financed = acquisitionCosts(createAcquisition({ ...base, mortgageFeeAddedToLoan: true }))
    const upfront = acquisitionCosts(createAcquisition({ ...base, mortgageFeeAddedToLoan: false }))
    expect(upfront.cashRequired - financed.cashRequired).toBe(2500)
    expect(financed.effectiveMortgage - financed.baseMortgage).toBe(2500)
  })

  it('derives gross yield from expected monthly rent when supplied', () => {
    const result = acquisitionCosts(createAcquisition({
      purchasePrice: 200000,
      expectedMonthlyRent: 1500,
    }))
    expect(result.grossYield).toBeCloseTo(0.09)
  })
})
