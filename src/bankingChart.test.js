import { describe, expect, it } from 'vitest'
import {
  balanceAxis, balanceCoordinates, balanceMonthTicks, formatAxisMoney,
  formatBusinessMonth, formatCashPeriod, nearestBalancePoint,
} from './bankingChart.js'

const points = [
  { date: '2026-01-12', balance: 10420 },
  { date: '2026-02-18', balance: 12150 },
  { date: '2026-03-20', balance: 14780 },
  { date: '2026-04-11', balance: 17950 },
]

describe('Banking chart presentation helpers', () => {
  it('uses rounded financial graduations instead of arbitrary interpolated values', () => {
    const axis = balanceAxis(points, 5)
    expect(axis.step).toBe(2000)
    expect(axis.ticks).toEqual([10000, 12000, 14000, 16000, 18000])
    expect(formatAxisMoney(10000)).toBe('£10K')
    expect(formatAxisMoney(1_200_000)).toBe('£1.2M')
  })

  it('labels calendar months as business month plus year and formats cash-flow periods the same way', () => {
    expect(formatBusinessMonth('2026-09-14')).toBe('Sep 2026')
    expect(formatCashPeriod('2026-09')).toBe('Sep 2026')
    expect(balanceMonthTicks(points, 3).map((tick) => tick.label)).toEqual(['Jan 2026', 'Mar 2026', 'Apr 2026'])
  })

  it('maps the balance series onto time and snaps hover position to the nearest real balance point', () => {
    const geometry = { width: 500, height: 220, pad: { top: 20, right: 20, bottom: 40, left: 50 } }
    const axis = balanceAxis(points, 5)
    const coordinates = balanceCoordinates(points, axis, geometry)
    expect(coordinates[0].x).toBe(50)
    expect(coordinates.at(-1).x).toBe(480)
    const nearMarch = nearestBalancePoint(coordinates, coordinates[2].x + 4)
    expect(nearMarch.date).toBe('2026-03-20')
    expect(nearMarch.balance).toBe(14780)
  })
})
