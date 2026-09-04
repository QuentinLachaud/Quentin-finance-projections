import { describe, expect, it } from 'vitest'
import {
  applyLoanToPortfolio,
  createLoanFromProperty,
  effectiveLoanAmount,
  inferLtvBand,
  loanCostSummary,
  loanProductFeeAmount,
  normalizeLoan,
  normalizeLoans,
  reconcileLoanPortfolio,
  syncPropertyMortgage,
  updatePropertyMortgageInput,
} from './loans.js'

const property = {
  id: 'btl-1',
  name: 'BTL1',
  latestValuation: 250000,
  loanAmount: 172500,
  lender: 'Paragon',
  baseRate: 0.0484,
  fixedRateMonths: 60,
  latestRemortgage: '2026-02-28',
}

const comparison = {
  id: 'cmp-1',
  sourcePropertyId: 'btl-1',
  left: { propertyValue: 240000, loanAmount: 170000, ltv: 70.8, loanBasis: 'loan', rate: 5.1, feeMode: 'percent', feeValue: 0, addFeeToLoan: false },
  right: { propertyValue: 250000, loanAmount: 187500, ltv: 75, loanBasis: 'loan', rate: 4.25, feeMode: 'amount', feeValue: 999, addFeeToLoan: true },
}

describe('loan and mortgage synchronization', () => {
  it('precreates linked loans from legacy BTL mortgage data but respects an explicitly empty collection', () => {
    const migrated = normalizeLoans(undefined, [property])
    expect(migrated).toHaveLength(1)
    expect(migrated[0]).toMatchObject({
      id: 'loan-btl-1', propertyId: 'btl-1', lender: 'Paragon', principalAmount: 172500, loanAmount: 172500,
      rate: 0.0484, fixedRateMonths: 60, fixedStartDate: '2026-02-28', ltvBand: 70,
    })
    expect(normalizeLoans([], [property])).toEqual([])
  })

  it('capitalises fixed and percentage fees from principal without compounding across edits or toggles', () => {
    const fixed = normalizeLoan({ loanAmount: 100000, feeMode: 'amount', feeValue: 1000, addFeeToLoan: false })
    expect(fixed).toMatchObject({ principalAmount: 100000, loanAmount: 100000 })
    const financed = normalizeLoan({ ...fixed, addFeeToLoan: true })
    expect(financed.loanAmount).toBe(101000)
    const largerFee = normalizeLoan({ ...financed, feeValue: 2000 })
    expect(largerFee.loanAmount).toBe(102000)
    const upfrontAgain = normalizeLoan({ ...largerFee, addFeeToLoan: false })
    expect(upfrontAgain.loanAmount).toBe(100000)
    expect(normalizeLoan({ ...upfrontAgain, addFeeToLoan: true }).loanAmount).toBe(102000)

    const percent = normalizeLoan({ loanAmount: 100000, feeMode: 'percent', feeValue: 3, addFeeToLoan: true })
    expect(percent).toMatchObject({ principalAmount: 100000, loanAmount: 103000 })
    expect(loanProductFeeAmount(percent)).toBe(3000)
    expect(effectiveLoanAmount({ ...percent, feeValue: 4 })).toBe(104000)
  })

  it('migrates legacy capitalised records once and remains idempotent on subsequent normalizations', () => {
    const legacyLoan = { id: 'legacy', propertyId: 'btl-1', lender: 'Paragon', loanAmount: 100000, rate: 0.05, feeMode: 'amount', feeValue: 1000, addFeeToLoan: true }
    const legacyProperty = { ...property, loanAmount: 100000, mortgageFeeMode: 'amount', mortgageFeeValue: 1000, mortgageFeeAddedToLoan: true }
    const first = reconcileLoanPortfolio({ properties: [legacyProperty], loans: [legacyLoan], comparisons: [comparison] })
    expect(first.loans[0]).toMatchObject({ principalAmount: 100000, loanAmount: 101000 })
    expect(first.properties[0]).toMatchObject({ mortgagePrincipalAmount: 100000, loanAmount: 101000 })
    expect(first.comparisons[0].left.loanAmount).toBe(101000)
    expect(first.comparisons[0].left.ltv).toBeCloseTo(40.4)

    const second = reconcileLoanPortfolio({ properties: first.properties, loans: first.loans, comparisons: first.comparisons })
    expect(second.loans[0]).toMatchObject({ principalAmount: 100000, loanAmount: 101000 })
    expect(second.properties[0]).toMatchObject({ mortgagePrincipalAmount: 100000, loanAmount: 101000 })
  })

  it('infers the next practical five-point LTV product band from the effective balance', () => {
    expect(inferLtvBand(172500, 250000)).toBe(70)
    expect(inferLtvBand(181000, 250000)).toBe(75)
    expect(inferLtvBand(0, 250000)).toBe(0)
  })

  it('uses the effective financed balance for monthly and fixed-period interest cost while excluding principal', () => {
    const percentFeeLoan = normalizeLoan({ loanAmount: 181587, rate: 0.0484, fixedRateMonths: 60, feeMode: 'percent', feeValue: 3, addFeeToLoan: true })
    const costs = loanCostSummary(percentFeeLoan)
    expect(costs.principalAmount).toBe(181587)
    expect(costs.effectiveBalance).toBeCloseTo(187034.61)
    expect(costs.monthlyCost).toBeCloseTo(754.372927)
    expect(costs.totalInterestCost).toBeCloseTo(45262.37562)
    expect(costs.productFee).toBeCloseTo(5447.61)
    expect(costs.totalCost).toBeCloseTo(50709.98562)
    expect(loanProductFeeAmount({ ...percentFeeLoan, feeMode: 'amount', feeValue: 1495 })).toBe(1495)
  })

  it('writes principal and effective balance to the BTL and only the current remortgage side', () => {
    const rightBefore = structuredClone(comparison.right)
    const loan = {
      ...createLoanFromProperty(property),
      lender: 'TMW',
      principalAmount: 180000,
      rate: 0.0419,
      fixedRateMonths: 24,
      fixedStartDate: '2026-09-01',
      feeMode: 'amount',
      feeValue: 1495,
      addFeeToLoan: true,
      ltvBand: 75,
    }
    const next = applyLoanToPortfolio({ properties: [property], loans: [createLoanFromProperty(property)], remortgageComparisons: [comparison] }, loan)
    expect(next.properties[0]).toMatchObject({
      lender: 'TMW', mortgagePrincipalAmount: 180000, loanAmount: 181495, baseRate: 0.0419, fixedRateMonths: 24,
      latestRemortgage: '2026-09-01', mortgageFeeMode: 'amount', mortgageFeeValue: 1495,
      mortgageFeeAddedToLoan: true, mortgageLtvBand: 75,
    })
    expect(next.remortgageComparisons[0].left).toMatchObject({
      propertyValue: 250000, loanAmount: 181495, ltv: 72.598, loanBasis: 'loan', rate: 4.19,
    })
    expect(next.remortgageComparisons[0].right).toEqual(rightBefore)
  })

  it('treats a direct property Loan amount edit as pre-fee principal and preserves linked fee metadata', () => {
    const existingLoan = normalizeLoan({
      ...createLoanFromProperty(property),
      principalAmount: 172500,
      feeMode: 'amount', feeValue: 999, addFeeToLoan: true, ltvBand: 75,
    }, [property])
    const propertyWithLoan = {
      ...property,
      mortgagePrincipalAmount: existingLoan.principalAmount,
      loanAmount: existingLoan.loanAmount,
      mortgageFeeMode: 'amount', mortgageFeeValue: 999, mortgageFeeAddedToLoan: true,
    }
    const editedProperty = updatePropertyMortgageInput(propertyWithLoan, 175000)
    expect(editedProperty).toMatchObject({ mortgagePrincipalAmount: 175000, loanAmount: 175999 })

    const synced = syncPropertyMortgage({ property: { ...editedProperty, lender: 'Kent Reliance', baseRate: 0.0399 }, loans: [existingLoan], comparisons: [comparison] })
    expect(synced.property).toMatchObject({ mortgagePrincipalAmount: 175000, loanAmount: 175999 })
    expect(synced.loans[0]).toMatchObject({
      lender: 'Kent Reliance', principalAmount: 175000, loanAmount: 175999, rate: 0.0399,
      feeMode: 'amount', feeValue: 999, addFeeToLoan: true, ltvBand: 75,
    })
    expect(synced.comparisons[0].left.loanAmount).toBe(175999)
    expect(synced.comparisons[0].left.rate).toBeCloseTo(3.99)
    expect(synced.comparisons[0].right).toEqual(comparison.right)
  })

  it('keeps manual loans independent and deconflicts duplicate property links without deleting rows', () => {
    const linked = createLoanFromProperty(property)
    const manual = { ...linked, id: 'manual', propertyId: '', lender: 'Director loan' }
    const manualResult = applyLoanToPortfolio({ properties: [property], loans: [linked], remortgageComparisons: [comparison] }, manual)
    expect(manualResult.properties[0]).toEqual(property)
    expect(manualResult.remortgageComparisons[0]).toEqual(comparison)

    const replacement = { ...linked, id: 'replacement', lender: 'New lender' }
    const linkedResult = applyLoanToPortfolio({ properties: [property], loans: [linked, replacement], remortgageComparisons: [] }, replacement)
    expect(linkedResult.loans).toHaveLength(2)
    expect(linkedResult.loans.find((loan) => loan.id === linked.id).propertyId).toBe('')
    expect(linkedResult.loans.find((loan) => loan.id === replacement.id).propertyId).toBe('btl-1')
  })
})
