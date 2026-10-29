import { describe, expect, it } from 'vitest'
import {
  LEGACY_COMPANY_ID, calculateMultiCompanyPortfolio, companySettings,
  createPortfolioCompany, includedCompanyProperties, normalizeCompanyPortfolio,
  removeEmptyCompany, setPropertyCompany,
} from './multiCompany.js'

const property = (id, companyId, rent, active = true) => ({
  id, companyId, name: id, active, rent, latestValuation: 150000,
  loanAmount: 0, mortgageInterestOnly: true, baseRate: 0,
  factorsFees: 0, repairs: 0, applianceReserve: 0, legionella: 0,
  gasCertificate: 0, eicr: 0, mortgageAdmin: 0, homeReportPurchase: 150000,
  purchasePrice: 150000, voidsOverride: 0,
})
const baseSettings = { accountType: 'company', bufferMonths: 6, appreciationRate: 0, managementRate: 0 }

describe('multi-company portfolio ownership', () => {
  it('migrates the single-company JSON without changing property or relationship IDs', () => {
    const legacy = {
      properties: [{ id: 'btl1', active: true, tenantId: 'tenant1' }, { id: 'btl2', active: false }],
      loans: [{ id: 'loan1', propertyId: 'btl1' }],
      tenants: [{ id: 'tenant1', propertyId: 'btl1' }],
      expenses: [{ id: 'receipt', propertyId: 'btl2' }],
      settings: { companyName: 'QUARK HOLDINGS LTD', companyNumber: 'SC822916', cashHeld: 14000, companyCosts: [{ id: 'a', amount: 100 }] },
    }
    const migrated = normalizeCompanyPortfolio(legacy)
    expect(migrated.companies).toHaveLength(1)
    expect(migrated.companies[0]).toMatchObject({ id: LEGACY_COMPANY_ID, name: 'QUARK HOLDINGS LTD', companyNumber: 'SC822916' })
    expect(migrated.companies[0].settings).toMatchObject({ cashHeld: 14000, companyCosts: [{ id: 'a', amount: 100 }] })
    expect(migrated.properties.map((p) => [p.id, p.companyId])).toEqual([['btl1', LEGACY_COMPANY_ID], ['btl2', LEGACY_COMPANY_ID]])
    expect(migrated.loans).toEqual(legacy.loans)
    expect(migrated.tenants).toEqual(legacy.tenants)
    expect(migrated.expenses).toEqual(legacy.expenses)
    expect(normalizeCompanyPortfolio(migrated)).toEqual(migrated)
  })

  it('rejects orphaned ownership and duplicate company IDs instead of silently mixing data', () => {
    expect(() => normalizeCompanyPortfolio({ companies: [createPortfolioCompany('a')], properties: [property('p', 'missing', 1)] })).toThrow(/unknown company/)
    expect(() => normalizeCompanyPortfolio({ companies: [createPortfolioCompany('a'), createPortfolioCompany('a')] })).toThrow(/duplicate/)
  })

  it('preserves exactly one owner on transfer and prevents deleting an occupied company', () => {
    const start = normalizeCompanyPortfolio({ companies: [createPortfolioCompany('a'), createPortfolioCompany('b')], properties: [property('p', 'a', 1000)] })
    const moved = setPropertyCompany(start, 'p', 'b')
    expect(moved.properties).toHaveLength(1)
    expect(moved.properties[0].companyId).toBe('b')
    expect(() => setPropertyCompany(start, 'p', 'missing')).toThrow(/unknown company/)
    expect(() => removeEmptyCompany(start, 'a')).toThrow(/Reassign/)
    expect(removeEmptyCompany(moved, 'a').companies.map((c) => c.id)).toEqual(['b'])
    expect(() => removeEmptyCompany(moved, 'b')).toThrow(/Reassign|At least/)
  })

  it('hides disabled companies without changing ownership, and still applies BTL toggles', () => {
    const a = createPortfolioCompany('a')
    const b = { ...createPortfolioCompany('b'), enabled: false }
    const properties = [property('x', 'a', 1000), property('y', 'b', 1200), property('z', 'a', 500, false)]
    expect(includedCompanyProperties(properties, [a, b]).map((p) => p.id)).toEqual(['x'])
    expect(includedCompanyProperties(properties, [a, { ...b, enabled: true }]).map((p) => p.id)).toEqual(['x', 'y'])
    expect(properties[1].companyId).toBe('b')
  })

  it('calculates Corporation Tax per entity before combining cashflow', () => {
    const a = { ...createPortfolioCompany('a'), settings: { cashHeld: 6000, companyCosts: [], extractions: [], associatedCompanies: 0 } }
    const b = { ...createPortfolioCompany('b'), settings: { cashHeld: 12000, companyCosts: [], extractions: [], associatedCompanies: 0 } }
    const props = [property('one', 'a', 5000), property('two', 'b', 5000)]
    const combined = calculateMultiCompanyPortfolio(props, [a, b], baseSettings, new Date('2026-10-29T12:00:00Z'))
    const each = combined.byCompany.map((x) => x.portfolio)
    expect(combined.count).toBe(2)
    expect(combined.cashHeld).toBe(18000)
    expect(combined.totalEquity).toBe(300000)
    expect(combined.scenarios[0].tax).toBeCloseTo(each[0].scenarios[0].tax + each[1].scenarios[0].tax, 5)
    expect(combined.scenarios[0].cashflow).toBeCloseTo(each[0].scenarios[0].cashflow + each[1].scenarios[0].cashflow, 5)
    expect(combined.scenarios[0].corporationTax).toBeNull()
    expect(combined.scenarios[0].tax).toBeGreaterThan(0)
    const exclude = calculateMultiCompanyPortfolio(props, [a, { ...b, enabled: false }], baseSettings)
    expect(exclude.count).toBe(1)
    expect(exclude.cashHeld).toBe(6000)
  })

  it('keeps company-level cash, deductions and official register identity independent', () => {
    const one = { ...createPortfolioCompany('1', 'A Ltd'), companyNumber: 'SC111111', settings: { cashHeld: 123, companyCosts: [{ amount: 40 }] } }
    const two = { ...createPortfolioCompany('2', 'B Ltd'), companyNumber: 'SC222222', settings: { cashHeld: 456, companyCosts: [{ amount: 70 }] } }
    expect(companySettings(one, baseSettings)).toMatchObject({ cashHeld: 123, companyNumber: 'SC111111', companyName: 'A Ltd' })
    expect(companySettings(two, baseSettings)).toMatchObject({ cashHeld: 456, companyNumber: 'SC222222', companyName: 'B Ltd' })
  })
})
