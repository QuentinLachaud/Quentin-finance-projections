import { describe, expect, it } from 'vitest'
import {
  buildRealisticEquityReleaseEvents,
  cumulativeRealisticEquityReleaseByMonth,
  loanEventsFromRealisticReleases,
  nextRemortgageDateForProperty,
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

describe('realistic remortgage-gated equity release', () => {
  it('derives the exact next remortgage date from existing property semantics', () => {
    expect(nextRemortgageDateForProperty(property)?.toISOString().slice(0, 10)).toBe('2027-01-01')
  })

  it('creates no date when remortgage metadata is missing instead of inventing one', () => {
    expect(nextRemortgageDateForProperty({ ...property, latestRemortgage: '' })).toBeNull()
    expect(nextRemortgageDateForProperty({ ...property, fixedRateMonths: 0 })).toBeNull()
  })

  it('gates a selected 70% refinance to its six-month remortgage window', () => {
    const events = buildRealisticEquityReleaseEvents({
      properties: [property],
      selections: { p1: { enabled: true, targetLtv: .70 } },
      annualAppreciationRate: 0,
      rateShock: 0,
      now: new Date('2026-07-15T12:00:00'),
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      propertyId: 'p1',
      propertyName: 'BTL1',
      month: 6,
      previousLoanAmount: 120000,
      release: 20000,
      newLoanAmount: 140000,
      modeledRate: .06,
    })
    expect(events[0].monthlyInterestIncrease).toBeCloseTo(100, 8)
  })

  it('keeps release at zero before the event then jumps once and stays fixed', () => {
    const [event] = buildRealisticEquityReleaseEvents({
      properties: [property],
      selections: { p1: { enabled: true, targetLtv: .70 } },
      annualAppreciationRate: 0,
      now: new Date('2026-07-15T12:00:00'),
    })
    const series = cumulativeRealisticEquityReleaseByMonth([event], 12)
    expect(series[0]).toBe(0)
    expect(series[5]).toBe(0)
    expect(series[6]).toBe(20000)
    expect(series[12]).toBe(20000)
  })

  it('does not create a debt event when scheduled release capacity is zero', () => {
    const [event] = buildRealisticEquityReleaseEvents({
      properties: [{ ...property, loanAmount: 150000 }],
      selections: { p1: { enabled: true, targetLtv: .70 } },
      annualAppreciationRate: 0,
      now: new Date('2026-07-15T12:00:00'),
    })
    expect(event.release).toBe(0)
    expect(loanEventsFromRealisticReleases([event])).toEqual([])
  })

  it('ignores unselected properties', () => {
    expect(buildRealisticEquityReleaseEvents({
      properties: [property],
      selections: { p1: { enabled: false, targetLtv: .70 } },
      now: new Date('2026-07-15T12:00:00'),
    })).toEqual([])
  })
})
