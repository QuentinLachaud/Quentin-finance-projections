import { describe, expect, it } from 'vitest'
import { assumptions } from './data.js'
import {
  anchorMortgageOverride, calculatePortfolio, calculateProperty, migrateMortgageOverride,
  mortgageInterestPayment, projectPortfolio,
} from './calculations.js'

const fixedNow = new Date('2026-08-15T12:00:00')
const costs = { legionella: 2.75, gasCertificate: 8.33, eicr: 2.5, repairs: 50, applianceReserve: 13.33 }
const testProperties = [
  { id: 'one', name: 'BTL1', latestValuation: 261924, loanAmount: 181587, homeReportPurchase: 235000, rent: 1650, baseRate: 0.045, factorsFees: 150, fixedRateMonths: 24, latestRemortgage: '2025-02-28', purchaseDate: '2020-12-19', active: true, ...costs },
  { id: 'two', name: 'BTL2', latestValuation: 150018, loanAmount: 112307, homeReportPurchase: 145000, rent: 1100, baseRate: 0.045, factorsFees: 90, fixedRateMonths: 24, latestRemortgage: '2025-08-01', purchaseDate: '2025-08-29', active: true, ...costs },
  { id: 'three', name: 'BTL3', latestValuation: 184000, loanAmount: 138750, homeReportPurchase: 184000, rent: 1100, baseRate: 0.045, factorsFees: 90, fixedRateMonths: 24, latestRemortgage: '2024-11-20', purchaseDate: '2025-08-29', active: true, ...costs },
]

describe('Quark sheet calculations', () => {
  it('matches the sheet mortgage and headline metrics for BTL1', () => {
    const btl = calculateProperty(testProperties[0], assumptions, fixedNow)
    expect(btl.monthlyPayment).toBeCloseTo(786.88, 1)
    expect(btl.currentLtv).toBeCloseTo(0.693, 2)
    expect(btl.grossYield).toBeCloseTo(0.0843, 3)
    expect(btl.icr).toBeCloseTo(2.097, 2)
  })

  it('recalculates the portfolio when a BTL is disabled', () => {
    const all = calculatePortfolio(testProperties, assumptions, fixedNow)
    const two = calculatePortfolio(testProperties.map((p, i) => ({ ...p, active: i < 2 })), assumptions, fixedNow)
    expect(all.count).toBe(3)
    expect(all.rent).toBe(3850)
    expect(two.count).toBe(2)
    expect(two.rent).toBe(2750)
  })

  it('supports generic company costs, extractions and expiring cash flows', () => {
    const settings = {
      ...assumptions,
      fullyManaged: false,
      companyCosts: [{ id: 'finance', name: 'Temporary finance', amount: 547, monthsRemaining: 12, enabled: true }],
      extractions: [{ id: 'benefit', name: 'Owner benefit', amount: 925, enabled: true }],
    }
    const portfolio = calculatePortfolio(testProperties, settings, fixedNow)
    const projection = projectPortfolio(testProperties, settings, 24, fixedNow)
    expect(portfolio.companyCosts).toBe(547)
    expect(portfolio.extractionTotal).toBe(925)
    expect(projection).toHaveLength(25)
    const beforeExpiry = projection[12].scenarios[0].cashflow - projection[11].scenarios[0].cashflow
    const afterExpiry = projection[13].scenarios[0].cashflow - projection[12].scenarios[0].cashflow
    expect(afterExpiry - beforeExpiry).toBeCloseTo(547, 1)
  })

  it('excludes company costs and applies private-landlord income tax', () => {
    const sharedSettings = {
      ...assumptions,
      companyCosts: [{ id: 'accountancy', name: 'Accountancy', amount: 200, enabled: true }],
      extractions: [],
    }
    const company = calculatePortfolio(testProperties, { ...sharedSettings, accountType: 'company' }, fixedNow)
    const privateLandlord = calculatePortfolio(testProperties, { ...sharedSettings, accountType: 'private', grossAnnualIncome: 30000, taxJurisdiction: 'scotland' }, fixedNow)

    expect(company.companyCosts).toBe(200)
    expect(company.scenarios[2].tax).toBeGreaterThan(0)
    expect(privateLandlord.companyCosts).toBe(0)
    expect(privateLandlord.scenarios.every((scenario) => scenario.tax > 0)).toBe(true)
    expect(privateLandlord.scenarios[0].privateTax.jurisdiction).toBe('scotland')
    expect(privateLandlord.scenarios[0].cashflow).toBeLessThan(privateLandlord.rent - privateLandlord.propertyFixedCosts - privateLandlord.variableCosts)

    const privateProjection = projectPortfolio(testProperties, {
      ...sharedSettings,
      accountType: 'private',
      grossAnnualIncome: 30000,
      taxJurisdiction: 'scotland',
      companyCosts: [{ id: 'loan', name: 'Company loan', amount: 500, monthsRemaining: 1, enabled: true }],
    }, 12, fixedNow)
    const monthOne = privateProjection[1].scenarios[0].cashflow - privateProjection[0].scenarios[0].cashflow
    const monthTwo = privateProjection[2].scenarios[0].cashflow - privateProjection[1].scenarios[0].cashflow
    expect(monthTwo).toBeCloseTo(monthOne)
  })

  it('keeps mortgage interest out of taxable property profit and applies only basic-rate relief', () => {
    const property = {
      ...testProperties[0],
      rent: 2000,
      loanAmount: 180000,
      baseRate: 0.04,
      factorsFees: 100,
      repairs: 0,
      applianceReserve: 0,
      legionella: 0,
      gasCertificate: 0,
      eicr: 0,
      mortgageAdmin: 0,
      voidsOverride: 0,
    }
    const portfolio = calculatePortfolio([property], {
      ...assumptions,
      accountType: 'private',
      grossAnnualIncome: 30000,
      taxJurisdiction: 'england',
      rateShock: 0,
      fullyManaged: false,
      companyCosts: [],
      extractions: [],
    }, fixedNow)
    const scenario = portfolio.scenarios[0]

    expect(portfolio.financeCosts).toBe(600)
    expect(scenario.taxable).toBe(1900)
    expect(scenario.privateTax.propertyProfit).toBe(22800)
    expect(scenario.privateTax.financeCosts).toBe(7200)
    expect(scenario.privateTax.financeCostTaxReduction).toBe(1440)
    expect(scenario.tax).toBeCloseTo(302.17, 1)
    expect(scenario.cashflow).toBeCloseTo(997.83, 1)
  })

  describe('mortgage interest regression coverage', () => {
    const property = { ...testProperties[0], loanAmount: 180000, baseRate: 0.04 }

    it('calculates interest-only monthly cost from principal and the effective rate', () => {
      expect(mortgageInterestPayment({ ...property, mortgageOverride: '' }, { ...assumptions, rateShock: 0.01 })).toBe(750)
    })

    it('preserves a manual payment at its anchor and applies later property-rate changes', () => {
      const anchored = anchorMortgageOverride(property, 650, { ...assumptions, rateShock: 0 })
      expect(mortgageInterestPayment(anchored, { ...assumptions, rateShock: 0 })).toBe(650)
      expect(mortgageInterestPayment({ ...anchored, baseRate: 0.05 }, { ...assumptions, rateShock: 0 })).toBe(800)
    })

    it('applies rate shock to manually entered mortgage costs', () => {
      const anchored = anchorMortgageOverride(property, 650, { ...assumptions, rateShock: 0 })
      expect(mortgageInterestPayment(anchored, { ...assumptions, rateShock: 0.007 })).toBeCloseTo(755)
      expect(mortgageInterestPayment(anchored, { ...assumptions, rateShock: -0.005 })).toBeCloseTo(575)
    })

    it('applies principal changes without discarding the manual baseline adjustment', () => {
      const anchored = anchorMortgageOverride(property, 650, { ...assumptions, rateShock: 0 })
      expect(mortgageInterestPayment({ ...anchored, loanAmount: 195000 }, { ...assumptions, rateShock: 0 })).toBe(700)
    })

    it('migrates legacy overrides without changing their current displayed payment', () => {
      const legacy = { ...property, mortgageOverride: 683 }
      const settings = { ...assumptions, rateShock: 0.007 }
      const migrated = migrateMortgageOverride(legacy, settings)
      expect(mortgageInterestPayment(migrated, settings)).toBe(683)
      expect(migrated.mortgageOverrideRate).toBeCloseTo(0.047)
      expect(migrated.mortgageOverrideLoanAmount).toBe(180000)
    })

    it('changes fixed costs, cash flow and weighted rate for every active BTL under rate shock', () => {
      const manual = anchorMortgageOverride({ ...testProperties[0], loanAmount: 180000, baseRate: 0.04 }, 650, { ...assumptions, rateShock: 0 })
      const automatic = { ...testProperties[1], loanAmount: 120000, baseRate: 0.05, mortgageOverride: '' }
      const baseline = calculatePortfolio([manual, automatic], { ...assumptions, rateShock: 0 }, fixedNow)
      const shocked = calculatePortfolio([manual, automatic], { ...assumptions, rateShock: 0.01 }, fixedNow)
      const expectedMonthlyIncrease = (180000 + 120000) * 0.01 / 12

      expect(shocked.propertyFixedCosts - baseline.propertyFixedCosts).toBeCloseTo(expectedMonthlyIncrease)
      expect(shocked.scenarios[2].cashflow).toBeLessThan(baseline.scenarios[2].cashflow)
      expect(shocked.weightedRate - baseline.weightedRate).toBeCloseTo(0.01)
      expect(shocked.selected[0].monthlyPayment - baseline.selected[0].monthlyPayment).toBeCloseTo(150)
      expect(shocked.selected[1].monthlyPayment - baseline.selected[1].monthlyPayment).toBeCloseTo(100)
    })
  })
})
