import { describe, expect, it } from 'vitest'
import {
  buildRealisticEquityReleaseSchedule,
  choosePurchaseEnablingRealisticReleases,
  cumulativeRealisticEquityReleaseByMonth,
  loanEventsFromRealisticReleases,
  nextRemortgageDateForProperty,
  realisticEquityReleaseCandidatesAtMonth,
} from './realisticEquityRelease.js'

const property = {
  id: 'p1',
  name: 'BTL1',
  latestValuation: 200000,
  loanAmount: 120000,
  baseRate: .06,
  latestRemortgage: '2026-01-01',
  fixedRateMonths: 12,
}

const now = new Date('2026-07-15T12:00:00')

describe('realistic equity release eligibility and execution', () => {
  it('derives the exact next remortgage date and creates no invented date', () => {
    expect(nextRemortgageDateForProperty(property)?.toISOString().slice(0, 10)).toBe('2027-01-01')
    expect(nextRemortgageDateForProperty({ ...property, latestRemortgage: '' })).toBeNull()
    expect(nextRemortgageDateForProperty({ ...property, fixedRateMonths: 0 })).toBeNull()
  })

  it('creates eligibility metadata without automatically executing a release', () => {
    const schedule = buildRealisticEquityReleaseSchedule({
      properties: [property],
      selections: { p1: { enabled: true, targetLtv: .70 } },
      rateShock: 0,
      now,
    })
    expect(schedule).toHaveLength(1)
    expect(schedule[0]).toMatchObject({
      propertyId: 'p1',
      propertyName: 'BTL1',
      eligibleFromMonth: 6,
      targetLtv: .70,
      modeledRate: .06,
    })
    expect(schedule[0]).not.toHaveProperty('release')
  })

  it('has no candidate before remortgage eligibility and recalculates capacity later', () => {
    const schedule = buildRealisticEquityReleaseSchedule({
      properties: [property],
      selections: { p1: { enabled: true, targetLtv: .70 } },
      now,
    })
    expect(realisticEquityReleaseCandidatesAtMonth({
      properties: [property],
      schedule,
      annualAppreciationRate: .12,
      month: 5,
      now,
    })).toEqual([])

    const atGate = realisticEquityReleaseCandidatesAtMonth({
      properties: [property],
      schedule,
      annualAppreciationRate: .12,
      month: 6,
      now,
    })[0]
    const later = realisticEquityReleaseCandidatesAtMonth({
      properties: [property],
      schedule,
      annualAppreciationRate: .12,
      month: 12,
      now,
    })[0]

    expect(atGate.release).toBeGreaterThan(20000)
    expect(later.release).toBeGreaterThan(atGate.release)
    expect(later.month).toBe(12)
    expect(later.executionDate).toBeInstanceOf(Date)
  })

  it('chooses the smallest full-release bundle that completely covers the shortfall', () => {
    const candidates = [
      { propertyId: 'a', propertyIndex: 0, release: 20000 },
      { propertyId: 'b', propertyIndex: 1, release: 35000 },
      { propertyId: 'c', propertyIndex: 2, release: 50000 },
    ]
    expect(choosePurchaseEnablingRealisticReleases(candidates, 45000).map((item) => item.propertyId)).toEqual(['c'])
    expect(choosePurchaseEnablingRealisticReleases(candidates, 52000).map((item) => item.propertyId)).toEqual(['a', 'b'])
    expect(choosePurchaseEnablingRealisticReleases(candidates, 120000)).toEqual([])
  })

  it('creates cumulative cash and loan events only from actually executed releases', () => {
    const event = { propertyId: 'p1', month: 9, release: 20000 }
    const series = cumulativeRealisticEquityReleaseByMonth([event], 12)
    expect(series[8]).toBe(0)
    expect(series[9]).toBe(20000)
    expect(series[12]).toBe(20000)
    expect(loanEventsFromRealisticReleases([event])).toEqual([{ propertyId: 'p1', month: 9, loanDelta: 20000 }])
  })

  it('ignores unselected properties', () => {
    expect(buildRealisticEquityReleaseSchedule({
      properties: [property],
      selections: { p1: { enabled: false, targetLtv: .70 } },
      now,
    })).toEqual([])
  })
})
