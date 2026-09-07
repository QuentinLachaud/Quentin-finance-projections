import { describe, expect, it } from 'vitest'
import {
  bankingCashFlowSeries, bankingHistoryBounds, bankingTimelineRange, alignBankingBalanceSeries,
} from './bankingTimeline.js'
import { reconstructBalanceSeries, trueCashFlowTransactions } from './banking.js'

const row = (id, bookedAt, amount, category = 'rent', extra = {}) => ({
  id, accountId: 'current', bookedAt, amount, category, status: 'booked',
  currency: 'GBP', performanceTreatment: 'auto', ...extra,
})
const asOf = '2026-09-07'

describe('Banking full-history alignment', () => {
  it('anchors All to the first booked dealing even when that row is excluded', () => {
    const rows = [
      row('pending', '2025-01-01', 20, 'rent', { status: 'pending' }),
      row('opening', '2025-02-01', -100000, 'property_acquisition', { excludeFromPerformance: true }),
      row('rent', '2025-02-28', 1500),
      row('recent', '2026-09-01', -400, 'repairs'),
      row('other-account', '2024-01-01', 500, 'rent', { accountId: 'savings' }),
    ]
    const bounds = bankingHistoryBounds(rows, ['current'])
    expect(bounds).toEqual({ from: '2025-02-01', to: '2026-09-01' })
    const range = bankingTimelineRange(rows, { accountIds: ['current'], range: 'all', asOf })
    expect(range).toEqual({ from: '2025-02-01', to: asOf, historyStart: '2025-02-01', historyEnd: '2026-09-01' })
    const monthly = bankingCashFlowSeries(trueCashFlowTransactions(rows), { ...range, accountIds: ['current'], period: 'month' })
    expect(monthly).toHaveLength(20)
    expect(monthly[0]).toEqual({ period: '2025-02', inflow: 1500, outflow: 0, net: 1500, count: 1 })
    expect(monthly.find((point) => point.period === '2025-03')).toEqual({ period: '2025-03', inflow: 0, outflow: 0, net: 0, count: 0 })
    expect(monthly.at(-1).net).toBe(-400)
    expect(monthly.reduce((total, point) => total + point.net, 0)).toBe(1100)
    const yearly = bankingCashFlowSeries(trueCashFlowTransactions(rows), { ...range, accountIds: ['current'], period: 'year' })
    expect(yearly.map((point) => [point.period, point.net])).toEqual([['2025', 1500], ['2026', -400]])
  })

  it('keeps the first historical month when every transaction in it is excluded', () => {
    const rows = [row('excluded', '2025-02-05', -100, 'repairs', { excludeFromPerformance: true }), row('rent', '2025-09-06', 1200)]
    const range = bankingTimelineRange(rows, { range: 'all', asOf: '2025-10-01' })
    const points = bankingCashFlowSeries(trueCashFlowTransactions(rows), { ...range, period: 'month' })
    expect(points[0]).toMatchObject({ period: '2025-02', net: 0, count: 0 })
    expect(points.at(-2)).toMatchObject({ period: '2025-09', net: 1200, count: 1 })
    expect(points).toHaveLength(9)
    expect(trueCashFlowTransactions(rows)).toHaveLength(1)
  })

  it('uses complete calendar months for shorter ranges without moving the business commencement', () => {
    const rows = [row('first', '2025-02-28', 100), row('july', '2026-07-01', 200), row('august', '2026-08-31', -50, 'repairs')]
    expect(bankingTimelineRange(rows, { range: '3', asOf }).from).toBe('2026-07-01')
    expect(bankingTimelineRange(rows, { range: '12', asOf }).from).toBe('2025-10-01')
    expect(bankingTimelineRange(rows, { range: 'all', asOf }).from).toBe('2025-02-28')
    expect(bankingTimelineRange([row('new', '2026-08-15', 50)], { range: '12', asOf }).from).toBe('2026-08-15')
  })

  it('honours account scope, validates calendar dates and does not create a false start', () => {
    const rows = [row('bad', '2025-02-30', 1), row('old', '2024-02-29', 10, 'rent', { accountId: 'savings' }), row('first', '2025-03-01', 20)]
    expect(bankingTimelineRange(rows, { accountIds: ['current'], range: 'all', asOf }).from).toBe('2025-03-01')
    expect(bankingTimelineRange(rows, { accountIds: ['savings'], range: 'all', asOf }).from).toBe('2024-02-29')
    expect(bankingTimelineRange(rows, { accountIds: [], range: 'all', asOf }).from).toBe('')
    expect(bankingCashFlowSeries([], { from: '', to: asOf })).toEqual([])
    expect(bankingTimelineRange([], { range: 'all', asOf }).historyStart).toBe('')
  })

  it('uses the Europe/London calendar at midnight, including the BST transition', () => {
    const rows = [row('first', '2025-02-01', 100)]
    expect(bankingTimelineRange(rows, { range: 'all', asOf: new Date('2026-09-30T23:30:00Z') }).to).toBe('2026-10-01')
    expect(bankingTimelineRange(rows, { range: 'all', asOf: new Date('2026-10-25T00:30:00Z') }).to).toBe('2026-10-25')
  })

  it('retains a valid explicitly reviewed operating transaction despite a stale transfer flag', () => {
    const rows = [row('override', '2025-02-06', -45, 'transfer', { isTransfer: true, performanceTreatment: 'operating' })]
    const range = bankingTimelineRange(rows, { range: 'all', asOf: '2025-02-28' })
    expect(bankingCashFlowSeries(trueCashFlowTransactions(rows), { ...range, period: 'month' })[0]).toMatchObject({ net: -45, count: 1 })
  })

  it('preserves true opening balances, excluded-date anchors and shorter-range continuity', () => {
    const accounts = [{ id: 'current', currency: 'GBP', includeInCash: true, currentBalance: 1000, balanceUpdatedAt: asOf }]
    const rows = [
      row('excluded', '2025-02-01', -100, 'repairs', { excludeFromPerformance: true }),
      row('rent', '2025-02-05', 1500),
      row('cost', '2026-09-01', -500, 'repairs'),
    ]
    const full = reconstructBalanceSeries(accounts, rows, { includeExcluded: false, includeOwnerFunding: true })
    expect(full[0]).toEqual({ date: '2025-02-01', balance: 100 })
    expect(full.find((point) => point.date === '2025-02-05').balance).toBe(1600)
    expect(full.at(-1).balance).toBe(1100)
    const window = alignBankingBalanceSeries(full, { from: '2026-07-01', to: asOf })
    expect(window[0]).toEqual({ date: '2026-07-01', balance: 1600 })
    expect(window.at(-1).balance).toBe(1100)
    expect(alignBankingBalanceSeries(full, { from: '2025-02-01', to: asOf })).toEqual(full)
    expect(alignBankingBalanceSeries(full, { from: '2026-07-01', to: '2026-08-01' })).toEqual([{ date: '2026-07-01', balance: 1600 }])
    expect(reconstructBalanceSeries(accounts, rows, { includeExcluded: true, includeOwnerFunding: true }).at(-1).balance).toBe(1000)
    expect(rows[0].excludeFromPerformance).toBe(true)
  })

  it('keeps zero-movement dates without inventing an opening balance for a statement with no balance column', () => {
    const accounts = [{ id: 'current', currency: 'GBP', includeInCash: true, externalAccountId: 'manual:tide:legacy', currentBalance: null }]
    const rows = [row('excluded', '2025-02-01', -100, 'repairs', { excludeFromPerformance: true }), row('rent', '2025-02-06', 500)]
    const series = reconstructBalanceSeries(accounts, rows, { includeExcluded: false })
    expect(series[0]).toEqual({ date: '2025-02-01', balance: 0 })
    expect(series.at(-1).balance).toBe(500)
    expect(alignBankingBalanceSeries(series, { from: '2025-02-01', to: asOf })).toEqual(series)
  })
})
