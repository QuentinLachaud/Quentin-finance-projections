import { describe, expect, it } from 'vitest'
import { annualDebtService, buildCompanyFinancialSnapshot, companyFromCompaniesHouse } from './companyFinancialSummary.js'
const p = (id, value = 200000, rent = 1000) => ({ id, name: id, active: true, latestValuation: value, rent })
const l = (id, propertyId, balance, rate, interestOnly = true) => ({ id, propertyId, currentBalance: balance, principalAmount: balance, rate, interestOnly, termMonths: 300, fixedRateMonths: 60, fixedStartDate: '2025-01-01' })
const base = { company: { registeredName: 'Test SPV Ltd', companyNumber: 'SC123456', shareholders: [{ name: 'A', percentage: 100 }] }, settings: { cashHeld: 20000 }, tenants: [], transactions: [], reportingDate: '2026-09-09', periodStart: '2025-09-10' }
describe('company financial summary', () => {
  it('includes every mortgage and uses aggregate rather than average LTV', () => { const s = buildCompanyFinancialSnapshot({ ...base, properties: [p('A', 300000), p('B', 100000)], loans: [l('1','A',120000,.04), l('2','A',30000,.06), l('3','B',50000,.05)] }); expect(s.portfolio.mortgageDebt).toBe(200000); expect(s.portfolio.aggregateLtv).toBeCloseTo(.5); expect(s.portfolio.grossPropertyEquity).toBe(200000); expect(s.portfolio.weightedRate).toBeCloseTo(.0475) })
  it('hydrates official identity and PSC ownership/control from Companies House', () => {
    const company = companyFromCompaniesHouse({
      profile: { company_name: 'REGISTER PROPERTY LTD', company_number: 'SC654321', date_of_creation: '2024-09-17', jurisdiction: 'scotland', sic_codes: ['68209'] },
      officers: { items: [{ name: 'Alex Example', officer_role: 'director' }, { name: 'Former Director', resigned_on: '2026-01-01' }] },
      psc: { items: [{ name: 'Alex Example', natures_of_control: ['ownership-of-shares-75-to-100-percent', 'voting-rights-75-to-100-percent', 'right-to-appoint-and-remove-directors'] }] },
    }, { registeredName: 'Fallback Ltd', companyNumber: 'SC000000', directors: [], shareholders: [] })
    expect(company.registeredName).toBe('REGISTER PROPERTY LTD')
    expect(company.companyNumber).toBe('SC654321')
    expect(company.incorporationDate).toBe('2024-09-17')
    expect(company.jurisdiction).toBe('Scotland')
    expect(company.directors).toEqual(['Alex Example'])
    expect(company.ownershipSummary).toBe('Alex Example — 75–100% of shares, 75–100% of voting rights, right to appoint/remove directors')
    expect(company.ownershipSource).toBe('Companies House PSC register')
  })
  it('omits ownership content and ownership warnings when no ownership information exists', () => {
    const company = companyFromCompaniesHouse({ profile: { company_name: 'NO PSC LTD', company_number: 'SC111111' }, officers: { items: [] }, psc: { items: [] } }, { shareholders: [] })
    expect(company.ownershipSummary).toBe('')
    const s = buildCompanyFinancialSnapshot({ ...base, company, properties: [p('A')], loans: [] })
    expect(s.warnings.join(' ')).not.toMatch(/ownership/i)
  })
  it('handles zero debt safely', () => { const s = buildCompanyFinancialSnapshot({ ...base, properties: [p('A')], loans: [] }); expect(s.portfolio.aggregateLtv).toBe(0); expect(s.portfolio.weightedRate).toBe(0); expect(s.resilience.icr).toBe(null) })
  it('keeps actual banking separate from annualised theoretical values and excludes transfers/financing', () => { const tx = [{ amount: 1000, category:'rent', bookedAt:'2026-08-01' }, { amount:-100, category:'repairs', bookedAt:'2026-08-02' }, { amount:5000, category:'transfer', bookedAt:'2026-08-03' }, { amount:-90000, category:'mortgage', bookedAt:'2026-08-04' }]; const s = buildCompanyFinancialSnapshot({ ...base, properties:[p('A',200000,1200)], loans:[l('1','A',100000,.05)], transactions:tx }); expect(s.actual.operatingIncome).toBe(1000); expect(s.actual.netCashFlow).toBe(900); expect(s.actual.debtServiceCash).toBe(90000); expect(s.runRate.annualRent).toBe(14400) })
  it('does not treat positive mortgage funding as debt-service cash', () => { const tx = [{ amount:90000, category:'mortgage', bookedAt:'2026-08-04' }]; const s = buildCompanyFinancialSnapshot({ ...base, properties:[p('A')], loans:[l('1','A',100000,.05)], transactions:tx }); expect(s.actual.debtServiceCash).toBe(0); expect(s.actual.operatingIncome).toBe(0); expect(s.actual.operatingOutflow).toBe(0) })
  it('does not double count owner extractions when excluded', () => { const tx = [{ amount:-500, category:'cash_extraction', bookedAt:'2026-08-01' }]; const s = buildCompanyFinancialSnapshot({ ...base, properties:[p('A')], loans:[], transactions:tx, includeExtractions:false }); expect(s.actual.operatingOutflow).toBe(0) })
  it('calculates IO and repayment debt service through authoritative loan maths', () => { expect(annualDebtService([l('1','A',120000,.06,true)])).toBeCloseTo(7200); expect(annualDebtService([l('2','A',120000,.06,false)])).toBeGreaterThan(7200) })
  it('flags missing values rather than treating them as verified zeroes', () => { const s = buildCompanyFinancialSnapshot({ ...base, company:{registeredName:'X'}, properties:[p('A',0,0)], loans:[] }); expect(s.warnings.join(' ')).toMatch(/valuation is missing/); expect(s.warnings.join(' ')).toMatch(/current rent is missing/); expect(s.warnings.join(' ')).toMatch(/registration number is missing/) })
  it('computes cash buffer and stressed ICR numerically', () => { const s = buildCompanyFinancialSnapshot({ ...base, properties:[p('A',200000,2000)], loans:[l('1','A',100000,.05)] }); expect(s.resilience.bufferMonths).toBeGreaterThan(0); expect(s.resilience.stressedIcr).toBeLessThan(s.resilience.icr) })
})
