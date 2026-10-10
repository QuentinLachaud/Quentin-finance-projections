import { describe, expect, it } from 'vitest'
import { calculatePortfolio, projectPortfolio, propertiesWithProjectedLoanEvents } from './calculations.js'
import { potentialEquityReleaseForProperty } from './equityRelease.js'
import { withPropertyLoans, projectLoan, projectedPropertyLoanBalance } from './loans.js'
import { projectTimeToNextBtl } from './nextBtlProjection.js'
import { buildRealisticEquityReleaseSchedule, realisticEquityReleaseCandidatesAtMonth } from './realisticEquityRelease.js'

const flat = {
  id: 'flat', name: 'Flat', active: true,
  latestValuation: 200000, loanAmount: 130000, rent: 0,
  factorsFees: 0, legionella: 0, gasCertificate: 0, eicr: 0,
  repairs: 0, applianceReserve: 0, mortgageAdmin: 0, voidsOverride: 0,
  latestRemortgage: '2026-01-01', fixedRateMonths: 12, baseRate: 0.05,
}
const repayment = {
  id: 'repayment', propertyId: 'flat', principalAmount: 100000,
  currentBalance: 100000, rate: 0.05, interestOnly: false, termMonths: 300,
  feeMode: 'amount', feeValue: 0, addFeeToLoan: false,
}
const interestOnly = {
  id: 'interest-only', propertyId: 'flat', principalAmount: 30000,
  currentBalance: 30000, rate: 0.05, interestOnly: true, termMonths: 300,
}
const linked = withPropertyLoans([flat], [repayment, interestOnly])[0]
const settings = {
  accountType: 'company', cashHeld: 0, appreciationRate: 0, rentGrowthRate: 0,
  rateShock: 0, fullyManaged: false, companyCosts: [], extractions: [],
}
const now = new Date('2026-07-15T12:00:00')
const targetLtv = 0.70

describe('repayment loans contribute to flat equity', () => {
  it('keeps recorded balances authoritative today; only projected months amortise', () => {
    const property = calculatePortfolio([linked], settings, now).selected[0]
    expect(property.loanAmount).toBe(130000)
    expect(property.equity).toBe(70000)
    expect(property.principalPayment).toBeGreaterThan(0)

    const paid = 100000 - projectLoan(repayment, 12).currentBalance
    const future = propertiesWithProjectedLoanEvents([linked], [], 12)[0]
    expect(future.loanAmount).toBeCloseTo(130000 - paid, 6)
    expect(future.financeLoans[1].currentBalance).toBe(30000)
    expect(200000 - future.loanAmount).toBeCloseTo(70000 + paid, 6)
    expect(projectedPropertyLoanBalance(linked, 0)).toBe(130000)
    expect(projectedPropertyLoanBalance(linked, 12)).toBeCloseTo(future.loanAmount, 6)
  })

  it('includes every pound of amortised principal in future releasable equity, without counting interest', () => {
    const nowRelease = potentialEquityReleaseForProperty({ property: linked, targetLtv, month: 0 })
    const later = potentialEquityReleaseForProperty({ property: linked, targetLtv, month: 12 })
    const paid = repayment.currentBalance - projectLoan(repayment, 12).currentBalance
    expect(nowRelease.release).toBeCloseTo(10000, 7)
    expect(later.projectedValue).toBe(200000)
    expect(later.currentLtv).toBeCloseTo(0.65, 8)
    expect(later.loanAmount).toBeCloseTo(130000 - paid, 6)
    expect(later.release - nowRelease.release).toBeCloseTo(paid, 6)
    const stressed = potentialEquityReleaseForProperty({ property: linked, targetLtv, month: 12, rateShock: 0.02 })
    expect(stressed.loanAmount).toBeCloseTo(projectedPropertyLoanBalance(linked, 12, 0.02), 6)
  })

  it('keeps interest-only debt unchanged and never amortises below zero', () => {
    expect(projectedPropertyLoanBalance(withPropertyLoans([flat], [interestOnly])[0], 60)).toBe(30000)
    const shortLoan = { ...repayment, currentBalance: 2400, termMonths: 3, rate: 0 }
    const p = withPropertyLoans([flat], [shortLoan])[0]
    expect(projectedPropertyLoanBalance(p, 2)).toBeCloseTo(800, 6)
    expect(projectedPropertyLoanBalance(p, 3)).toBe(0)
    expect(projectedPropertyLoanBalance(p, 30)).toBe(0)
  })

  it('also projects a legacy single repayment mortgage while leaving interest-only unchanged', () => {
    const legacy = { ...flat, loanAmount: 100000, mortgageInterestOnly: false, mortgageTermMonths: 300 }
    const unchanged = { ...legacy, mortgageInterestOnly: true }
    expect(projectedPropertyLoanBalance(legacy, 12)).toBeCloseTo(projectLoan({
      currentBalance: 100000, rate: 0.05, interestOnly: false, termMonths: 300,
    }, 12).currentBalance, 6)
    expect(propertiesWithProjectedLoanEvents([legacy], [], 12)[0].loanAmount).toBeLessThan(100000)
    expect(propertiesWithProjectedLoanEvents([unchanged], [], 12)[0].loanAmount).toBe(100000)
    expect(potentialEquityReleaseForProperty({ property: unchanged, targetLtv, month: 12 }).release).toBe(40000)
  })

  it('increases smooth next-BTL capacity as principal is repaid even at zero appreciation', () => {
    const p = projectTimeToNextBtl({
      properties: [linked], settings, portfolio: { cashHeld: 0, fixedCosts: 0, variableCosts: 0 },
      projectionPoints: Array.from({ length: 13 }, (_, month) => ({
        month, scenarios: [0, 1, 2].map(() => ({ cashPot: 0, cashflow: 0 })),
      })),
      targetPriceToday: 1000000, annualAppreciationRate: 0,
      acquisitionAssumptions: { jurisdiction: 'scotland', ltv: 75, adsRate: 0, legalFees: 0, mortgageFee: 0 },
      preserveBuffer: false, equityReleaseSelections: { flat: { enabled: true, targetLtv } },
      maxMonths: 12, now,
    })
    const paid = repayment.currentBalance - projectLoan(repayment, 12).currentBalance
    expect(p.points[0].potentialEquityRelease).toBeCloseTo(10000, 6)
    expect(p.points[12].potentialEquityRelease).toBeCloseTo(10000 + paid, 6)
    expect(p.points[12].availableCash - p.points[0].availableCash).toBeCloseTo(paid, 6)
  })

  it('uses amortised balance at realistic refinance eligibility, not the original principal', () => {
    const schedule = buildRealisticEquityReleaseSchedule({
      properties: [linked], selections: { flat: { enabled: true, targetLtv } }, now,
    })
    expect(realisticEquityReleaseCandidatesAtMonth({
      properties: [linked], schedule, month: 5, now,
    })).toEqual([])
    const [candidate] = realisticEquityReleaseCandidatesAtMonth({
      properties: [linked], schedule, month: 6, now,
    })
    const paid = repayment.currentBalance - projectLoan(repayment, 6).currentBalance
    expect(candidate.previousLoanAmount).toBeCloseTo(130000 - paid, 6)
    expect(candidate.release).toBeCloseTo(10000 + paid, 6)
    expect(candidate.newLoanAmount).toBeCloseTo(140000, 6)
  })

  it('counts scheduled principal as equity gain, not additional cash flow', () => {
    const base = calculatePortfolio([linked], settings, now)
    const economicGain = base.scenarios[0].totalGain
    expect(economicGain).toBeCloseTo(base.scenarios[0].cashflow + base.appreciation + base.selected[0].principalPayment, 6)
    const projected = projectPortfolio([linked], settings, 1, now)
    const first = projected[1].scenarios[0]
    const repaid = base.selected[0].principalPayment
    expect(first.totalGain).toBeCloseTo(first.cashflow + repaid, 6)
    expect(first.cashPot).toBeCloseTo(first.cashflow, 6)
  })
})
