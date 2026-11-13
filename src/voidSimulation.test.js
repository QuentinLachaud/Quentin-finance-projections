import { describe, expect, it } from 'vitest'
import { calculatePortfolio, calculateProperty, projectPortfolio } from './calculations.js'
import { calculateMultiCompanyPortfolio, createPortfolioCompany } from './multiCompany.js'
import { applySimulatedVoids } from './voidSimulation.js'

const now = new Date('2026-11-13T12:00:00Z')
const property = (id, companyId, rent, options = {}) => ({
  id, companyId, name: id.toUpperCase(), active: true, rent,
  latestValuation: 150000, homeReportPurchase: 140000,
  loanAmount: 100000, baseRate: 0.06, mortgageInterestOnly: true,
  factorsFees: 95, repairs: 50, applianceReserve: 15,
  legionella: 2, gasCertificate: 9, eicr: 3, mortgageAdmin: 4,
  voidsOverride: '', ...options,
})
const properties = [
  property('one', 'a', 1500),
  property('two', 'a', 1100),
  property('three', 'b', 1000),
]
const company = {
  accountType: 'company', taxJurisdiction: 'scotland',
  fullyManaged: true, managementRate: 0.1,
  appreciationRate: 0.03, rentGrowthRate: 0.025,
  bufferMonths: 6, cashHeld: 9000,
  accountingPeriodMonths: 12, associatedCompanies: 0,
  companyCosts: [{ amount: 80, enabled: true, taxDeductible: true }],
  extractions: [{ amount: 90, enabled: true, taxDeductible: false }],
}
const voided = (...ids) => applySimulatedVoids(properties, new Set(ids))
const calc = (items, settings = company) => calculatePortfolio(items, settings, now)

describe('per-property simulated rent voids', () => {
  it('keeps contracted rent and input records unchanged and does not persist a modelling flag', () => {
    const original = structuredClone(properties)
    const model = voided('one')
    expect(model).not.toBe(properties)
    expect(model[0]).not.toBe(properties[0])
    expect(model[0]).toMatchObject({ rent: 1500, simulatedVoid: true })
    expect(model[1]).toMatchObject({ rent: 1100, simulatedVoid: false })
    expect(properties).toEqual(original)
    expect(properties[0]).not.toHaveProperty('simulatedVoid')
    const calculated = calculateProperty(model[0], company, now)
    expect(calculated).toMatchObject({ rent: 0, contractualRent: 1500, simulatedVoid: true, voids: 0 })
    expect(calculated.loanAmount).toBe(100000)
    expect(calculated.monthlyPayment).toBeGreaterThan(0)
  })

  it('keeps baseline results exactly unchanged when no toggles are pressed, and restores them when released', () => {
    const baseline = calc(properties)
    const untouched = calc(voided())
    const restored = calc(applySimulatedVoids(voided('one', 'three'), new Set()))
    expect(untouched).toEqual(baseline)
    expect(restored).toEqual(baseline)
    expect(baseline.simulatedVoidCount).toBe(0)
    expect(baseline.allPropertiesSimulatedVoid).toBe(false)
  })

  it('excludes precisely one voided rent while retaining mortgage, maintenance, equity and reserves', () => {
    const baseline = calc(voided())
    const result = calc(voided('two'))
    expect(result.count).toBe(3)
    expect(result.simulatedVoidCount).toBe(1)
    expect(result.allPropertiesSimulatedVoid).toBe(false)
    expect(result.rent).toBe(2500)
    expect(result.scenarios.map((s) => s.collectedRent)).toEqual([
      2500 - (1500 + 1000) / 12, 2500, 2500,
    ])
    expect(result.scenarios.map((s) => s.voidLoss)).toEqual([
      (1500 + 1000) / 12, 0, 0,
    ])
    expect(result.voids).toBeCloseTo((1500 + 1000) / 12)
    expect(result.propertyFixedCosts).toBeCloseTo(baseline.propertyFixedCosts)
    expect(result.problemBudget).toBeCloseTo(baseline.problemBudget)
    expect(result.totalLoans).toBe(baseline.totalLoans)
    expect(result.totalValue).toBe(baseline.totalValue)
    expect(result.totalEquity).toBe(baseline.totalEquity)
    expect(result.selected.find((p) => p.id === 'two')).toMatchObject({ rent: 0, voids: 0 })
  })

  it('applies the normal estimated void allowance to only the single remaining rented BTL', () => {
    const result = calc(voided('one', 'two'))
    expect(result.rent).toBe(1000)
    expect(result.simulatedVoidCount).toBe(2)
    expect(result.scenarios[0].voidLoss).toBeCloseTo(1000 / 12)
    expect(result.scenarios[0].collectedRent).toBeCloseTo(1000 * 11 / 12)
    expect(result.scenarios[1].collectedRent).toBe(1000)
    expect(result.scenarios[2].collectedRent).toBe(1000)
    expect(result.scenarios[0].cashflow).toBeLessThan(result.scenarios[1].cashflow)
  })

  it('accounts for all properties void with zero rent and zero additional void estimates in all three cards', () => {
    const result = calc(voided('one', 'two', 'three'))
    expect(result).toMatchObject({
      count: 3, rent: 0, voids: 0, simulatedVoidCount: 3,
      allPropertiesSimulatedVoid: true,
    })
    for (const scenario of result.scenarios) {
      expect(scenario.collectedRent).toBe(0)
      expect(scenario.voidLoss).toBe(0)
      expect(scenario.management).toBe(0)
      expect(scenario.tax).toBeGreaterThanOrEqual(0)
      expect(scenario.corporationTax.tax).toBeGreaterThanOrEqual(0)
      expect(scenario.cashflow).toBeLessThan(0)
    }
    expect(result.scenarios[0].cashflow).toBeCloseTo(result.scenarios[1].cashflow)
    expect(result.scenarios[2].cashflow).toBeGreaterThan(result.scenarios[0].cashflow)
    expect(result.scenarios[0].tax).toBe(0)
    expect(result.scenarios[0].taxable).toBeLessThan(0)
    expect(result.propertyFixedCosts).toBeGreaterThan(0)
  })

  it('does not double-count a configured void allowance override once that flat is void', () => {
    const withOverrides = [
      property('one', 'a', 1500, { voidsOverride: 400 }),
      property('two', 'a', 1100, { voidsOverride: 90 }),
    ]
    const baseline = calc(withOverrides)
    const result = calc(applySimulatedVoids(withOverrides, new Set(['one'])))
    expect(baseline.scenarios[0].voidLoss).toBe(490)
    expect(result.scenarios[0].voidLoss).toBe(90)
    expect(result.scenarios[0].collectedRent).toBe(1010)
    expect(result.selected.find((p) => p.id === 'one').voids).toBe(0)
    const all = calc(applySimulatedVoids(withOverrides, new Set(['one', 'two'])))
    expect(all.scenarios[0].voidLoss).toBe(0)
  })

  it('recalculates Corporation Tax from actual scenario rent, not contractual rent, with no negative tax credit', () => {
    for (const ids of [[], ['one'], ['one', 'two'], ['one', 'two', 'three']]) {
      const result = calc(voided(...ids))
      for (const scenario of result.scenarios) {
        const expectedTaxable = scenario.collectedRent
          - result.financeCosts - result.factorsCosts - scenario.management
          - result.deductibleCompanyCosts - result.deductibleExtractions
        expect(scenario.taxable).toBeCloseTo(expectedTaxable)
        expect(scenario.tax).toBeGreaterThanOrEqual(0)
        expect(scenario.corporationTax.tax).toBeGreaterThanOrEqual(0)
        expect(scenario.cashflow).toBeCloseTo(
          scenario.collectedRent - result.propertyFixedCosts
          - scenario.management - scenario.problemBudget - result.companyCosts - scenario.tax,
        )
      }
    }
    const baseline = calc(voided())
    const oneVoid = calc(voided('one'))
    expect(oneVoid.scenarios[0].tax).toBeLessThanOrEqual(baseline.scenarios[0].tax)
  })

  it('handles private landlord tax without restoring rent or adding simulated voids to the allowance', () => {
    const privateSettings = {
      ...company, accountType: 'private', grossAnnualIncome: 67000,
      propertyLossBroughtForward: 0, financeCostsBroughtForward: 0,
    }
    for (const ids of [[], ['one'], ['one', 'two'], ['one', 'two', 'three']]) {
      const result = calc(voided(...ids), privateSettings)
      expect(result.scenarios[0].voidLoss).toBeCloseTo(
        properties.filter((p) => !ids.includes(p.id)).reduce((sum, p) => sum + p.rent / 12, 0),
      )
      for (const scenario of result.scenarios) {
        expect(scenario.privateTax).not.toBeNull()
        expect(scenario.corporationTax).toBeNull()
        expect(Number.isFinite(scenario.tax)).toBe(true)
        expect(Number.isFinite(scenario.cashflow)).toBe(true)
      }
    }
  })

  it('does not mistake excluded properties or empty portfolio for all active properties void', () => {
    const filtered = calc([
      { ...properties[0], active: false, simulatedVoid: true },
      { ...properties[1], simulatedVoid: false },
    ])
    expect(filtered.simulatedVoidCount).toBe(0)
    expect(filtered.allPropertiesSimulatedVoid).toBe(false)
    expect(calc([]).allPropertiesSimulatedVoid).toBe(false)
    const only = calc([
      { ...properties[0], active: false },
      { ...properties[1], simulatedVoid: true },
    ])
    expect(only.count).toBe(1)
    expect(only.allPropertiesSimulatedVoid).toBe(true)
  })

  it('keeps rent voided throughout forward projection despite rent growth and retains amortisation', () => {
    const active = voided('one', 'two')
    const timeline = projectPortfolio(active, company, 24, now)
    expect(timeline).toHaveLength(25)
    expect(timeline[0].rent).toBe(1000)
    expect(timeline[1].rent).toBeCloseTo(1000 * 1.025 ** (1 / 12))
    expect(timeline[12].rent).toBeCloseTo(1025)
    expect(timeline[24].rent).toBeCloseTo(1000 * 1.025 ** 2)
    for (const point of timeline) {
      expect(point.rent).toBeLessThan(1100)
      expect(point.scenarios.every((scenario) => Number.isFinite(scenario.cashPot))).toBe(true)
    }
    const everyVoid = projectPortfolio(voided('one', 'two', 'three'), company, 12, now)
    expect(everyVoid.every((point) => point.rent === 0)).toBe(true)
    expect(everyVoid[12].scenarios[0].cashPot).toBeLessThan(everyVoid[0].scenarios[0].cashPot)
  })
})

describe('independent companies with simulated voids', () => {
  const companies = [
    { ...createPortfolioCompany('a', 'Alpha'), settings: { ...company, cashHeld: 3000 } },
    { ...createPortfolioCompany('b', 'Beta'), settings: { ...company, cashHeld: 6000 } },
  ]
  const combined = (items, entities = companies) =>
    calculateMultiCompanyPortfolio(items, entities, company, now)

  it('sums individual company cashflows and tax and counts voided properties once', () => {
    const result = combined(voided('one', 'three'))
    expect(result.rent).toBe(1100)
    expect(result.count).toBe(3)
    expect(result.simulatedVoidCount).toBe(2)
    expect(result.allPropertiesSimulatedVoid).toBe(false)
    expect(result.scenarios[0].voidLoss).toBeCloseTo(1100 / 12)
    expect(result.scenarios[0].tax).toBeCloseTo(result.byCompany.reduce(
      (sum, item) => sum + item.portfolio.scenarios[0].tax, 0,
    ))
    expect(result.scenarios[0].cashflow).toBeCloseTo(result.byCompany.reduce(
      (sum, item) => sum + item.portfolio.scenarios[0].cashflow, 0,
    ))
    expect(result.byCompany.find(({ company }) => company.id === 'b').portfolio.rent).toBe(0)
    expect(result.scenarios[0].corporationTax).toBeNull()
  })

  it('detects all voids across companies and respects disabling a company without miscounting', () => {
    const all = combined(voided('one', 'two', 'three'))
    expect(all.allPropertiesSimulatedVoid).toBe(true)
    expect(all.simulatedVoidCount).toBe(3)
    expect(all.scenarios.every((s) => s.collectedRent === 0 && s.voidLoss === 0)).toBe(true)

    const onlyA = combined(voided('one', 'two'), [companies[0], { ...companies[1], enabled: false }])
    expect(onlyA.allPropertiesSimulatedVoid).toBe(true)
    expect(onlyA.simulatedVoidCount).toBe(2)
    expect(onlyA.count).toBe(2)
    expect(onlyA.rent).toBe(0)

    const emptyCompany = combined(voided('one', 'two'), [
      companies[0], companies[1],
      { ...createPortfolioCompany('empty'), settings: company },
    ])
    expect(emptyCompany.allPropertiesSimulatedVoid).toBe(false)
    expect(emptyCompany.count).toBe(3)
    const noEnabled = combined(properties, companies.map((c) => ({ ...c, enabled: false })))
    expect(noEnabled.allPropertiesSimulatedVoid).toBe(false)
    expect(noEnabled.simulatedVoidCount).toBe(0)
  })
})
