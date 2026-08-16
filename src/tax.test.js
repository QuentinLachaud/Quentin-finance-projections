import { describe, expect, it } from 'vitest'
import {
  calculateIncomeTax, calculatePrivateLandlordTax, personalAllowance, TAX_YEAR,
} from './tax.js'

describe('2026–27 UK income tax', () => {
  it('uses the official 2026–27 tax year and tapers the personal allowance', () => {
    expect(TAX_YEAR).toBe('2026–27')
    expect(personalAllowance(100000)).toBe(12570)
    expect(personalAllowance(110000)).toBe(7570)
    expect(personalAllowance(125140)).toBe(0)
    expect(personalAllowance(150000)).toBe(0)
  })

  it.each([
    [0, 0],
    [12570, 0],
    [50270, 7540],
    [60000, 11432],
    [110000, 33432],
    [125140, 42516],
    [130000, 44703],
  ])('calculates England tax at £%i as £%i', (income, expectedTax) => {
    expect(calculateIncomeTax(income, 'england').totalTax).toBeCloseTo(expectedTax, 2)
  })

  it.each([
    [12570, 0],
    [16537, 753.73],
    [29526, 3351.53],
    [43662, 6320.09],
    [75000, 19482.05],
  ])('calculates Scotland tax at £%i using all six bands', (income, expectedTax) => {
    expect(calculateIncomeTax(income, 'scotland').totalTax).toBeCloseTo(expectedTax, 2)
  })

  it('falls back safely to England for an unknown jurisdiction', () => {
    expect(calculateIncomeTax(60000, 'unknown')).toEqual(calculateIncomeTax(60000, 'england'))
  })
})

describe('private residential landlord tax', () => {
  it('stacks rental profit on England income and applies 20% finance-cost relief', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 12000, financeCosts: 6000, jurisdiction: 'england' })
    expect(tax.incrementalTaxBeforeRelief).toBe(2400)
    expect(tax.financeCostTaxReduction).toBe(1200)
    expect(tax.propertyIncomeTax).toBe(1200)
  })

  it('uses Scottish non-savings, non-dividend bands for property income', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 12000, financeCosts: 6000, jurisdiction: 'scotland' })
    expect(tax.incrementalTaxBeforeRelief).toBeCloseTo(2520)
    expect(tax.financeCostTaxReduction).toBe(1200)
    expect(tax.propertyIncomeTax).toBeCloseTo(1320)
  })

  it('limits finance-cost relief to the lowest statutory cap', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 15000, propertyProfit: 2000, financeCosts: 10000, jurisdiction: 'england' })
    expect(tax.relievableFinanceCosts).toBe(2000)
    expect(tax.financeCostTaxReduction).toBe(400)
    expect(tax.propertyIncomeTax).toBe(0)
  })

  it('never creates a negative property tax or refund', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 0, propertyProfit: 1000, financeCosts: 10000, jurisdiction: 'scotland' })
    expect(tax.propertyIncomeTax).toBe(0)
    expect(tax.financeCostTaxReduction).toBe(0)
  })
})
