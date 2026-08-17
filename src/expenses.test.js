import { describe, expect, it } from 'vitest'
import {
  filterExpenses, inferExpenseType, mergeExpenseImports, normalizeExpenseDate,
  parseExpenseAmount, parseExpenseImport, summarizeExpenses,
} from './expenses.js'

describe('expenses ledger', () => {
  it('infers transaction type from the amount sign', () => {
    expect(inferExpenseType(100)).toBe('income')
    expect(inferExpenseType(-100)).toBe('expense')
    expect(inferExpenseType(0)).toBe('neutral')
    expect(inferExpenseType('')).toBe('unspecified')
  })

  it('parses UK currency amounts including accounting parentheses', () => {
    expect(parseExpenseAmount('£ 1,000.00')).toBe(1000)
    expect(parseExpenseAmount('£ (495.0)')).toBe(-495)
    expect(parseExpenseAmount('')).toBe('')
  })

  it('normalizes valid UK dates and leaves unknown or invalid dates blank', () => {
    expect(normalizeExpenseDate('21/07/2026')).toBe('2026-07-21')
    expect(normalizeExpenseDate('2026-08-17')).toBe('2026-08-17')
    expect(normalizeExpenseDate('?')).toBe('')
    expect(normalizeExpenseDate('8/3/0202')).toBe('')
  })

  it('imports tab-separated data while ignoring an explicit Type column', () => {
    const parsed = parseExpenseImport([
      'Date\tProperty\tType\tCategory\tAmount (£)\tDescription\tRecurrence\tNotes\tReceipt Link',
      '6/2/2025\tAll\tincome\tDLA\t£ 1,000.0\tDLA\tadhoc\t\t',
      '6/2/2025\tKelvinhaugh\tincome\tprofessional fee\t£ (495.0)\tBroker fee\tone-off\tNote\thttps://example.com/r',
    ].join('\n'))
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ date: '2025-02-06', property: 'All', category: 'DLA', amount: 1000 })
    expect(parsed[1]).toMatchObject({ amount: -495, receiptLink: 'https://example.com/r' })
    expect(inferExpenseType(parsed[1].amount)).toBe('expense')
  })

  it('filters by text, property, inferred type, category, recurrence and date range', () => {
    const rows = [
      { id: '1', date: '2025-02-06', property: 'All', category: 'DLA', amount: 1000, description: 'Director loan', recurrence: 'Ad hoc', notes: '', receiptLink: '' },
      { id: '2', date: '2025-08-21', property: 'Kelvinhaugh', category: 'compliance', amount: -200.1, description: 'Gas and legionella', recurrence: 'Annually', notes: '', receiptLink: '' },
      { id: '3', date: '2026-06-15', property: 'Rutland', category: 'professional fee', amount: -60, description: 'OpenRent referencing', recurrence: 'Ad hoc', notes: 'invoice', receiptLink: '' },
    ]
    expect(filterExpenses(rows, { type: 'expense' })).toHaveLength(2)
    expect(filterExpenses(rows, { property: 'Rutland' })).toHaveLength(1)
    expect(filterExpenses(rows, { property: 'All' })).toHaveLength(1)
    expect(filterExpenses(rows, { category: 'compliance' })[0].id).toBe('2')
    expect(filterExpenses(rows, { recurrence: 'Annually' })[0].id).toBe('2')
    expect(filterExpenses(rows, { from: '2026-01-01', to: '2026-12-31' })[0].id).toBe('3')
    expect(filterExpenses(rows, { query: 'openrent' })[0].id).toBe('3')
  })

  it('summarizes income, absolute expenses and net cash movement', () => {
    expect(summarizeExpenses([{ amount: 1000 }, { amount: -400 }, { amount: -100 }, { amount: '' }]))
      .toEqual({ income: 1000, expense: 500, net: 500, count: 4 })
  })

  it('deduplicates repeated imports', () => {
    const original = { id: 'a', date: '2026-01-01', property: 'All', category: 'fee', amount: -10, description: 'Fee', recurrence: '', notes: '', receiptLink: '' }
    const duplicate = { ...original, id: 'b' }
    const fresh = { ...original, id: 'c', description: 'Different fee' }
    const merged = mergeExpenseImports([original], [duplicate, fresh])
    expect(merged.added).toBe(1)
    expect(merged.duplicates).toBe(1)
    expect(merged.expenses).toHaveLength(2)
  })
})
