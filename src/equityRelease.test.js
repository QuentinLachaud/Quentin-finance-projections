import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EQUITY_RELEASE_TARGET_LTV,
  normalizeEquityReleaseTargetLtv,
  potentialEquityReleaseAtMonth,
  potentialEquityReleaseForProperty,
  projectedExistingPropertyValue,
} from './equityRelease.js'

const btl = { id: 'btl1', name: 'BTL1', latestValuation: 200000, loanAmount: 120000 }

describe('potential equity-release domain model', () => {
  it('defaults the target refinance LTV to 70%', () => {
    expect(DEFAULT_EQUITY_RELEASE_TARGET_LTV).toBe(.70)
    expect(normalizeEquityReleaseTargetLtv(undefined)).toBe(.70)
  })

  it('calculates exact current release to the chosen target LTV', () => {
    const result = potentialEquityReleaseForProperty({ property: btl, targetLtv: .70, month: 0 })
    expect(result.currentLtv).toBeCloseTo(.60, 10)
    expect(result.targetDebt).toBe(140000)
    expect(result.release).toBe(20000)
  })

  it('never reports negative release when debt already exceeds target debt', () => {
    const result = potentialEquityReleaseForProperty({ property: { ...btl, loanAmount: 150000 }, targetLtv: .70 })
    expect(result.currentLtv).toBeCloseTo(.75, 10)
    expect(result.release).toBe(0)
  })

  it('compounds existing-property appreciation over 12 months', () => {
    expect(projectedExistingPropertyValue(btl, .05, 12)).toBeCloseTo(210000, 8)
    const result = potentialEquityReleaseForProperty({ property: btl, targetLtv: .70, annualAppreciationRate: .05, month: 12 })
    expect(result.projectedValue).toBeCloseTo(210000, 8)
    expect(result.release).toBeCloseTo(27000, 8)
  })

  it('supports custom per-property LTV and sums only explicitly enabled BTLs', () => {
    const properties = [btl, { id: 'btl2', name: 'BTL2', latestValuation: 100000, loanAmount: 50000 }]
    const result = potentialEquityReleaseAtMonth({
      properties,
      selections: {
        btl1: { enabled: true, targetLtv: .75 },
        btl2: { enabled: false, targetLtv: .70 },
      },
      month: 0,
    })
    expect(result.selectedCount).toBe(1)
    expect(result.total).toBe(30000)
    expect(result.details[0].targetLtv).toBe(.75)
  })

  it('clamps malformed LTVs and sanitizes malformed financial inputs', () => {
    expect(normalizeEquityReleaseTargetLtv(-2)).toBe(0)
    expect(normalizeEquityReleaseTargetLtv(4)).toBe(1)
    const result = potentialEquityReleaseForProperty({ property: { id: 'bad', latestValuation: -5, loanAmount: -10 }, targetLtv: 'bad' })
    expect(result.currentValue).toBe(0)
    expect(result.loanAmount).toBe(0)
    expect(result.release).toBe(0)
    for (const value of [result.projectedValue, result.targetDebt, result.release]) expect(Number.isFinite(value)).toBe(true)
  })

  it('does not mutate property or selection inputs', () => {
    const property = { ...btl }
    const selections = { btl1: { enabled: true, targetLtv: .70 } }
    const propertyBefore = JSON.stringify(property)
    const selectionsBefore = JSON.stringify(selections)
    potentialEquityReleaseAtMonth({ properties: [property], selections, annualAppreciationRate: .0325, month: 24 })
    expect(JSON.stringify(property)).toBe(propertyBefore)
    expect(JSON.stringify(selections)).toBe(selectionsBefore)
  })
})
