import { describe, expect, it } from 'vitest'
import {
  calculateCorporationTax, calculateIncomeTax, calculatePrivateLandlordTax,
  personalAllowance, TAX_YEAR, taxYearForDate,
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
    [0, 0], [12570, 0], [50270, 7540], [60000, 11432], [110000, 33432], [125140, 42516], [130000, 44703],
  ])('calculates England tax at £%i as £%i', (income, expectedTax) => {
    expect(calculateIncomeTax(income, 'england').totalTax).toBeCloseTo(expectedTax, 2)
  })

  it.each([
    [12570, 0], [16537, 753.73], [29526, 3351.53], [43662, 6320.09], [75000, 19482.05],
  ])('calculates Scotland tax at £%i using all six bands', (income, expectedTax) => {
    expect(calculateIncomeTax(income, 'scotland').totalTax).toBeCloseTo(expectedTax, 2)
  })

  it('switches tax years on 6 April', () => {
    expect(taxYearForDate(new Date(2027, 3, 5, 12))).toBe('2026–27')
    expect(taxYearForDate(new Date(2027, 3, 6, 12))).toBe('2027–28')
  })

  it('falls back safely to England for an unknown jurisdiction', () => {
    expect(calculateIncomeTax(60000, 'unknown')).toEqual(calculateIncomeTax(60000, 'england'))
  })
})

describe('Corporation Tax', () => {
  it('uses the small-profits, marginal-relief and main-rate regimes', () => {
    expect(calculateCorporationTax({ taxableProfit: 40000 })).toMatchObject({ tax: 7600, rateType: 'small-profits' })
    expect(calculateCorporationTax({ taxableProfit: 90000 })).toMatchObject({ tax: 20100, rateType: 'marginal-relief' })
    expect(calculateCorporationTax({ taxableProfit: 300000 })).toMatchObject({ tax: 75000, rateType: 'main' })
  })

  it('reduces thresholds for associated companies', () => {
    const result = calculateCorporationTax({ taxableProfit: 90000, associatedCompanies: 1 })
    expect(result.lowerLimit).toBe(25000)
    expect(result.upperLimit).toBe(125000)
    expect(result.tax).toBeCloseTo(21975)
  })

  it('charges a close investment-holding company at the main rate', () => {
    expect(calculateCorporationTax({ taxableProfit: 40000, closeInvestmentHoldingCompany: true })).toMatchObject({ tax: 10000, rateType: 'main-cihc' })
  })


  it('scales thresholds for a short accounting period and uses augmented profit for marginal relief', () => {
    const shortPeriod = calculateCorporationTax({ taxableProfit: 45000, accountingPeriodMonths: 6 })
    expect(shortPeriod).toMatchObject({ lowerLimit: 25000, upperLimit: 125000, rateType: 'marginal-relief' })
    expect(shortPeriod.tax).toBeCloseTo(10050)

    const withDistribution = calculateCorporationTax({ taxableProfit: 90000, augmentedProfit: 98000 })
    expect(withDistribution.tax).toBeCloseTo(20406.12, 1)
  })
})

describe('private residential landlord tax', () => {
  it('stacks 2026–27 rental profit on England income and applies 20% finance-cost relief', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 12000, financeCosts: 6000, jurisdiction: 'england' })
    expect(tax.incrementalTaxBeforeRelief).toBe(2400)
    expect(tax.financeCostTaxReduction).toBe(1200)
    expect(tax.propertyIncomeTax).toBe(1200)
    expect(tax.financeCostsCarryForward).toBe(0)
  })

  it('uses Scottish non-savings, non-dividend bands for 2026–27 property income', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 12000, financeCosts: 6000, jurisdiction: 'scotland' })
    expect(tax.incrementalTaxBeforeRelief).toBeCloseTo(2520)
    expect(tax.financeCostTaxReduction).toBe(1200)
    expect(tax.propertyIncomeTax).toBeCloseTo(1320)
  })

  it('carries property losses forward and uses them before taxing later property profit', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 3000, propertyLossBroughtForward: 5000, financeCosts: 6000, jurisdiction: 'england' })
    expect(tax.propertyLossUsed).toBe(3000)
    expect(tax.propertyProfit).toBe(0)
    expect(tax.propertyLossCarryForward).toBe(2000)
    expect(tax.propertyIncomeTax).toBe(0)
  })

  it('carries restricted finance costs forward when the profit cap prevents relief', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 15000, propertyProfit: 2000, financeCosts: 10000, financeCostsBroughtForward: 1000, jurisdiction: 'england' })
    expect(tax.relievedFinanceCosts).toBe(2000)
    expect(tax.financeCostTaxReduction).toBe(400)
    expect(tax.financeCostsCarryForward).toBe(9000)
  })

  it('uses the separate 22% England property rate and 22% finance reducer from 2027–28', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 12000, financeCosts: 6000, jurisdiction: 'england', taxYear: '2027–28' })
    expect(tax.incrementalTaxBeforeRelief).toBe(2640)
    expect(tax.financeReliefRate).toBe(0.22)
    expect(tax.financeCostTaxReduction).toBe(1320)
    expect(tax.propertyIncomeTax).toBe(1320)
  })

  it('flags future Scottish rates as an explicit planning assumption rather than pretending they are known', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 12000, financeCosts: 6000, jurisdiction: 'scotland', taxYear: '2027–28' })
    expect(tax.futureRatesAssumed).toBe(true)
    expect(tax.policyNote).toContain('Future Scottish property-income rates')
  })


  it('flags years after 2027–28 when carrying forward the last known England property rates', () => {
    const tax = calculatePrivateLandlordTax({ grossIncome: 30000, propertyProfit: 12000, financeCosts: 6000, jurisdiction: 'england', taxYear: '2030–31' })
    expect(tax.futureRatesAssumed).toBe(true)
    expect(tax.policyNote).toContain('2027–28 England/Wales/NI property rates')
  })
})
