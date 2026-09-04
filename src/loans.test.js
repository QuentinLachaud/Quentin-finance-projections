import { describe, expect, it } from 'vitest'
import {
  applyLoanToPortfolio,
  createLoanFromProperty,
  inferLtvBand,
  normalizeLoans,
  syncPropertyMortgage,
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
      id: 'loan-btl-1', propertyId: 'btl-1', lender: 'Paragon', loanAmount: 172500,
      rate: 0.0484, fixedRateMonths: 60, fixedStartDate: '2026-02-28', ltvBand: 70,
    })
    expect(normalizeLoans([], [property])).toEqual([])
  })

  it('infers the next practical five-point LTV product band', () => {
    expect(inferLtvBand(172500, 250000)).toBe(70)
    expect(inferLtvBand(181000, 250000)).toBe(75)
    expect(inferLtvBand(0, 250000)).toBe(0)
  })

  it('writes linked loan changes to the BTL and only the current remortgage side', () => {
    const rightBefore = structuredClone(comparison.right)
    const loan = {
      ...createLoanFromProperty(property),
      lender: 'TMW',
      loanAmount: 180000,
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
      lender: 'TMW', loanAmount: 180000, baseRate: 0.0419, fixedRateMonths: 24,
      latestRemortgage: '2026-09-01', mortgageFeeMode: 'amount', mortgageFeeValue: 1495,
      mortgageFeeAddedToLoan: true, mortgageLtvBand: 75,
    })
    expect(next.remortgageComparisons[0].left).toMatchObject({
      propertyValue: 250000, loanAmount: 180000, ltv: 72, loanBasis: 'loan', rate: 4.19,
    })
    expect(next.remortgageComparisons[0].right).toEqual(rightBefore)
  })

  it('syncs later BTL edits back into the linked loan while preserving stored fee metadata', () => {
    const existingLoan = {
      ...createLoanFromProperty(property),
      feeMode: 'amount', feeValue: 999, addFeeToLoan: true, ltvBand: 75,
    }
    const editedProperty = { ...property, lender: 'Kent Reliance', loanAmount: 175000, baseRate: 0.0399 }
    const synced = syncPropertyMortgage({ property: editedProperty, loans: [existingLoan], comparisons: [comparison] })
    expect(synced.loans[0]).toMatchObject({
      lender: 'Kent Reliance', loanAmount: 175000, rate: 0.0399,
      feeMode: 'amount', feeValue: 999, addFeeToLoan: true, ltvBand: 75,
    })
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
