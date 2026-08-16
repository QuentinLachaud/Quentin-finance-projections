import { describe, expect, it } from 'vitest'
import { assumptions } from './data.js'
import {
  calculatePortfolio, calculateProperty, mortgageInterestPayment, projectPortfolio,
} from './calculations.js'

const fixedNow = new Date('2026-08-11T12:00:00')
const costs = { legionella: 2.75, gasCertificate: 8.33, eicr: 2.5, repairs: 50, applianceReserve: 13.33 }
const testProperties = [
  { id: 'one', name: 'BTL1', latestValuation: 261924, loanAmount: 181587, homeReportPurchase: 235000, rent: 1650, baseRate: 0.045, factorsFees: 150, fixedRateMonths: 24, latestRemortgage: '2025-02-28', purchaseDate: '2020-12-19', active: true, ...costs },
  { id: 'two', name: 'BTL2', latestValuation: 150018, loanAmount: 112307, homeReportPurchase: 145000, rent: 1100, baseRate: 0.045, factorsFees: 90, fixedRateMonths: 24, latestRemortgage: '2025-08-01', purchaseDate: '2025-08-29', active: true, ...costs },
  { id: 'three', name: 'BTL3', latestValuation: 184000, loanAmount: 138750, homeReportPurchase: 184000, rent: 1100, baseRate: 0.045, factorsFees: 90, fixedRateMonths: 24, latestRemortgage: '2024-11-20', purchaseDate: '2025-08-29', active: true, ...costs },
]

const companySettings = {
  ...assumptions,
  accountType: 'company',
  fullyManaged: false,
  companyCosts: [],
  extractions: [],
}

describe('property and portfolio calculations', () => {
  it('matches the interest-only mortgage and headline metrics for BTL1', () => {
    const btl = calculateProperty(testProperties[0], companySettings, fixedNow)
    expect(btl.monthlyPayment).toBeCloseTo(786.88, 1)
    expect(btl.currentLtv).toBeCloseTo(0.693, 2)
    expect(btl.grossYield).toBeCloseTo(0.0843, 3)
    expect(btl.icr).toBeCloseTo(2.097, 2)
  })

  it('uses current valuation consistently for forward appreciation', () => {
    const btl = calculateProperty(testProperties[0], companySettings, fixedNow)
    expect(btl.appreciationAnnual).toBeCloseTo(testProperties[0].latestValuation * assumptions.appreciationRate)
  })

  it('recalculates the portfolio when a BTL is disabled', () => {
    const all = calculatePortfolio(testProperties, companySettings, fixedNow)
    const two = calculatePortfolio(testProperties.map((p, i) => ({ ...p, active: i < 2 })), companySettings, fixedNow)
    expect(all.count).toBe(3)
    expect(all.rent).toBe(3850)
    expect(two.count).toBe(2)
    expect(two.rent).toBe(2750)
  })
})

describe('company tax and cash-flow semantics', () => {
  it('treats generic extractions as non-deductible by default and separates company cash from owner value', () => {
    const baseline = calculatePortfolio(testProperties, companySettings, fixedNow)
    const extracted = calculatePortfolio(testProperties, {
      ...companySettings,
      extractions: [{ id: 'owner', name: 'Owner cash', amount: 925, enabled: true }],
    }, fixedNow)

    expect(extracted.scenarios[0].taxable).toBeCloseTo(baseline.scenarios[0].taxable)
    expect(extracted.scenarios[0].tax).toBeCloseTo(baseline.scenarios[0].tax)
    expect(extracted.scenarios[0].bankCashflow - baseline.scenarios[0].bankCashflow).toBeCloseTo(-925)
    expect(extracted.scenarios[0].cashflow).toBeCloseTo(baseline.scenarios[0].cashflow)
  })

  it('only deducts an extraction when its tax treatment is explicitly marked deductible', () => {
    const baseline = calculatePortfolio(testProperties, companySettings, fixedNow)
    const extracted = calculatePortfolio(testProperties, {
      ...companySettings,
      extractions: [{ id: 'salary', name: 'Qualifying remuneration', amount: 925, enabled: true, taxDeductible: true }],
    }, fixedNow)

    expect(baseline.scenarios[0].taxable - extracted.scenarios[0].taxable).toBeCloseTo(925)
    expect(extracted.scenarios[0].tax).toBeLessThan(baseline.scenarios[0].tax)
  })

  it('treats generic company costs as non-deductible until explicitly classified', () => {
    const baseline = calculatePortfolio(testProperties, companySettings, fixedNow)
    const nonDeductible = calculatePortfolio(testProperties, {
      ...companySettings,
      companyCosts: [{ id: 'loan', name: 'Loan principal', amount: 300, enabled: true }],
    }, fixedNow)
    const deductible = calculatePortfolio(testProperties, {
      ...companySettings,
      companyCosts: [{ id: 'accountancy', name: 'Accountancy', amount: 300, enabled: true, taxDeductible: true }],
    }, fixedNow)

    expect(nonDeductible.scenarios[0].tax).toBeCloseTo(baseline.scenarios[0].tax)
    expect(nonDeductible.scenarios[0].bankCashflow - baseline.scenarios[0].bankCashflow).toBeCloseTo(-300)
    expect(deductible.scenarios[0].tax).toBeLessThan(baseline.scenarios[0].tax)
  })

  it('accumulates actual company bank cash in cashPot rather than owner value', () => {
    const settings = {
      ...companySettings,
      cashHeld: 10000,
      extractions: [{ id: 'owner', name: 'Owner cash', amount: 925, enabled: true }],
    }
    const current = calculatePortfolio(testProperties, settings, fixedNow)
    const projection = projectPortfolio(testProperties, settings, 12, fixedNow)
    expect(projection[1].scenarios[0].cashPot).toBeCloseTo(10000 + current.scenarios[0].bankCashflow)
    expect(projection[1].scenarios[0].cashflow).toBeCloseTo(current.scenarios[0].cashflow)
    expect(projection[1].scenarios[0].cashPot - 10000).not.toBeCloseTo(projection[1].scenarios[0].cashflow)
  })

  it('uses the configured Corporation Tax accounting-period length and augmented-profit distributions', () => {
    const portfolio = calculatePortfolio(testProperties, {
      ...companySettings,
      accountingPeriodMonths: 6,
      augmentedProfitDistributions: 8000,
    }, fixedNow)
    const scenario = portfolio.scenarios[2]
    expect(scenario.corporationTax.lowerLimit).toBe(25000)
    expect(scenario.corporationTax.upperLimit).toBe(125000)
    expect(scenario.corporationTax.augmentedProfit).toBeCloseTo(scenario.corporationTax.taxableProfit + 8000)
  })

  it('recalculates Corporation Tax when a temporary deductible company cost expires', () => {
    const settings = {
      ...companySettings,
      companyCosts: [{ id: 'finance', name: 'Temporary deductible cost', amount: 547, monthsRemaining: 12, enabled: true, taxDeductible: true }],
    }
    const projection = projectPortfolio(testProperties, settings, 24, fixedNow)
    const month12Increment = projection[12].scenarios[0].cashflow - projection[11].scenarios[0].cashflow
    const month13Increment = projection[13].scenarios[0].cashflow - projection[12].scenarios[0].cashflow
    expect(month13Increment - month12Increment).toBeCloseTo(547 * (1 - 0.19), 2)
  })
})

describe('scenario expense and tax treatment', () => {
  it('charges percentage management on rent actually collected after void loss', () => {
    const portfolio = calculatePortfolio(testProperties, { ...companySettings, fullyManaged: true }, fixedNow)
    expect(portfolio.scenarios[0].management).toBeCloseTo(portfolio.scenarios[0].collectedRent * assumptions.managementRate)
    expect(portfolio.scenarios[0].management).toBeLessThan(portfolio.scenarios[1].management)
  })

  it('keeps planning reserves out of taxable profit by default but supports an explicit planning toggle', () => {
    const conservative = calculatePortfolio(testProperties, companySettings, fixedNow)
    const deductibleBudgets = calculatePortfolio(testProperties, { ...companySettings, budgetedPropertyCostsTaxDeductible: true }, fixedNow)
    expect(conservative.scenarios[0].taxable - deductibleBudgets.scenarios[0].taxable)
      .toBeCloseTo(conservative.complianceBudget + conservative.financeAdminBudget + conservative.problemBudget)
  })

  it('excludes company costs and extractions entirely for private landlords', () => {
    const privateLandlord = calculatePortfolio(testProperties, {
      ...companySettings,
      accountType: 'private',
      grossAnnualIncome: 30000,
      taxJurisdiction: 'scotland',
      companyCosts: [{ id: 'accountancy', name: 'Accountancy', amount: 200, enabled: true, taxDeductible: true }],
      extractions: [{ id: 'owner', name: 'Owner cash', amount: 500, enabled: true, taxDeductible: true }],
    }, fixedNow)
    expect(privateLandlord.companyCosts).toBe(0)
    expect(privateLandlord.extractionTotal).toBe(0)
    expect(privateLandlord.scenarios[0].privateTax.jurisdiction).toBe('scotland')
  })
})

describe('private-landlord finance costs', () => {
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

  it('keeps mortgage interest out of taxable property profit and applies the finance-cost reducer', () => {
    const portfolio = calculatePortfolio([property], {
      ...companySettings,
      accountType: 'private',
      grossAnnualIncome: 30000,
      taxJurisdiction: 'england',
      rateShock: 0,
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

  it('supports a lower qualifying finance balance for private-tax relief', () => {
    const portfolio = calculatePortfolio([{ ...property, qualifyingFinanceBalance: 90000 }], {
      ...companySettings,
      accountType: 'private',
      grossAnnualIncome: 30000,
      taxJurisdiction: 'england',
      rateShock: 0,
    }, fixedNow)
    expect(portfolio.financeCosts).toBe(600)
    expect(portfolio.qualifyingFinanceCosts).toBe(300)
    expect(portfolio.scenarios[0].privateTax.financeCosts).toBe(3600)
    expect(portfolio.scenarios[0].privateTax.financeCostTaxReduction).toBe(720)
  })

  it('treats deductible residential mortgage-admin costs as finance costs rather than reducing private rental profit', () => {
    const portfolio = calculatePortfolio([{ ...property, mortgageAdmin: 50 }], {
      ...companySettings,
      accountType: 'private',
      grossAnnualIncome: 30000,
      taxJurisdiction: 'england',
      rateShock: 0,
      budgetedPropertyCostsTaxDeductible: true,
    }, fixedNow)
    const scenario = portfolio.scenarios[0]
    expect(scenario.privateTax.propertyProfit).toBe(22800)
    expect(scenario.privateTax.financeCosts).toBe(7800)
    expect(scenario.privateTax.financeCostTaxReduction).toBe(1560)
  })

  it('switches projection tax years when the horizon crosses 6 April', () => {
    const projection = projectPortfolio([property], {
      ...companySettings,
      accountType: 'private',
      grossAnnualIncome: 30000,
      taxJurisdiction: 'england',
      rateShock: 0,
    }, 12, fixedNow)
    expect(projection[7].taxYear).toBe('2026–27')
    expect(projection[8].taxYear).toBe('2027–28')
  })
})

describe('mortgage interest regression coverage', () => {
  const property = { ...testProperties[0], loanAmount: 180000, baseRate: 0.04 }

  it('calculates interest-only monthly cost from principal and the effective rate', () => {
    expect(mortgageInterestPayment(property, { ...assumptions, rateShock: 0.01 })).toBe(750)
  })

  it('ignores stale stored mortgage overrides', () => {
    const stale = { ...property, mortgageOverride: 100, mortgageOverrideRate: 0.01, mortgageOverrideLoanAmount: 50000 }
    expect(mortgageInterestPayment(stale, { ...assumptions, rateShock: 0.01 })).toBe(750)
  })

  it('changes fixed costs, cash flow and weighted rate for every active BTL under rate shock', () => {
    const first = { ...testProperties[0], loanAmount: 180000, baseRate: 0.04, mortgageOverride: 1 }
    const second = { ...testProperties[1], loanAmount: 120000, baseRate: 0.05, mortgageOverride: 1 }
    const baseline = calculatePortfolio([first, second], { ...companySettings, rateShock: 0 }, fixedNow)
    const shocked = calculatePortfolio([first, second], { ...companySettings, rateShock: 0.01 }, fixedNow)
    const expectedMonthlyIncrease = (180000 + 120000) * 0.01 / 12
    expect(shocked.propertyFixedCosts - baseline.propertyFixedCosts).toBeCloseTo(expectedMonthlyIncrease)
    expect(shocked.scenarios[2].cashflow).toBeLessThan(baseline.scenarios[2].cashflow)
    expect(shocked.weightedRate - baseline.weightedRate).toBeCloseTo(0.01)
    expect(shocked.selected[0].monthlyPayment - baseline.selected[0].monthlyPayment).toBeCloseTo(150)
    expect(shocked.selected[1].monthlyPayment - baseline.selected[1].monthlyPayment).toBeCloseTo(100)
  })
})
