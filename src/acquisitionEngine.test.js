import { describe, expect, it } from 'vitest'
import {
  acquisitionCosts,
  maxAffordablePurchasePrice,
  normalizeAcquisitionAssumptions,
} from './acquisitionEngine.js'

describe('canonical acquisition cost engine', () => {
  it('preserves the tested Scottish completion-cash calculation', () => {
    const result = acquisitionCosts({ purchasePrice: 200000, jurisdiction: 'scotland', ltv: 75, adsRate: 8, legalFees: 1500 })
    expect(result).toMatchObject({ baseTax: 1100, supplement: 16000, deposit: 50000, cashRequired: 68600 })
  })

  it('handles progressive Scotland tax boundaries without threshold discontinuity errors', () => {
    expect(acquisitionCosts({ purchasePrice: 145000, jurisdiction: 'scotland', ltv: 100, adsRate: 0, legalFees: 0 }).baseTax).toBe(0)
    expect(acquisitionCosts({ purchasePrice: 145001, jurisdiction: 'scotland', ltv: 100, adsRate: 0, legalFees: 0 }).baseTax).toBeCloseTo(.02, 8)
    expect(acquisitionCosts({ purchasePrice: 250000, jurisdiction: 'scotland', ltv: 100, adsRate: 0, legalFees: 0 }).baseTax).toBe(2100)
    expect(acquisitionCosts({ purchasePrice: 250001, jurisdiction: 'scotland', ltv: 100, adsRate: 0, legalFees: 0 }).baseTax).toBeCloseTo(2100.05, 8)
  })

  it('keeps mortgage product fees in completion cash only when paid upfront', () => {
    const base = { purchasePrice: 200000, jurisdiction: 'scotland', ltv: 75, adsRate: 8, legalFees: 1500, mortgageFee: 2500 }
    expect(acquisitionCosts({ ...base, mortgageFeeAddedToLoan: false }).cashRequired - acquisitionCosts({ ...base, mortgageFeeAddedToLoan: true }).cashRequired).toBe(2500)
  })

  it('is monotonic in purchase price across representative tax regimes', () => {
    for (const jurisdiction of ['scotland', 'england-ni', 'wales']) {
      const assumptions = { jurisdiction, ltv: 75, adsRate: 8, legalFees: 1500 }
      const prices = [0, 100000, 145000, 180000, 250000, 325000, 750000]
      const costs = prices.map((purchasePrice) => acquisitionCosts({ ...assumptions, purchasePrice }).cashRequired)
      for (let index = 1; index < costs.length; index += 1) expect(costs[index]).toBeGreaterThanOrEqual(costs[index - 1])
    }
  })
})

describe('inverse acquisition buying-power solver', () => {
  it('recovers a known Scottish target from its exact completion cash', () => {
    const assumptions = { jurisdiction: 'scotland', ltv: 75, adsRate: 8, legalFees: 1500, mortgageFee: 0, mortgageFeeAddedToLoan: true }
    const affordable = maxAffordablePurchasePrice(68600, assumptions)
    expect(affordable).toBeCloseTo(200000, 2)
  })

  it('satisfies the affordability invariant across cash levels and tax boundaries', () => {
    const assumptions = { jurisdiction: 'scotland', ltv: 75, adsRate: 8, legalFees: 1500 }
    for (const cash of [1500, 10000, 25000, 50000, 68600, 100000, 200000]) {
      const price = maxAffordablePurchasePrice(cash, assumptions, { precision: .01 })
      expect(acquisitionCosts({ ...assumptions, purchasePrice: price }).cashRequired).toBeLessThanOrEqual(cash + .011)
      if (price < 99_999_999) expect(acquisitionCosts({ ...assumptions, purchasePrice: price + .02 }).cashRequired).toBeGreaterThan(cash - .011)
    }
  })

  it('returns zero safely when fixed completion fees alone exceed available cash', () => {
    expect(maxAffordablePurchasePrice(1000, { jurisdiction: 'scotland', ltv: 75, adsRate: 8, legalFees: 1500 })).toBe(0)
  })

  it('normalizes malformed assumptions instead of producing NaN', () => {
    const normalized = normalizeAcquisitionAssumptions({ jurisdiction: 'unknown', ltv: 999, adsRate: -2, legalFees: 'bad', mortgageFee: -5 })
    expect(normalized).toEqual({ jurisdiction: 'england-ni', ltv: 100, adsRate: 0, legalFees: 1500, mortgageFee: 0, mortgageFeeAddedToLoan: true })
    const result = acquisitionCosts({ ...normalized, purchasePrice: 'bad' })
    expect(Number.isFinite(result.cashRequired)).toBe(true)
  })
})
