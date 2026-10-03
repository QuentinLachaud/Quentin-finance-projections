import { describe, expect, it } from 'vitest'
import { reorderList, reorderVisibleLoans } from './loanReordering.js'

const loan = (id, propertyId) => ({ id, propertyId, lender: id })

describe('loan presentation reordering', () => {
  it('reorders a complete ungrouped list without mutating the input', () => {
    const source = [loan('a', 'p1'), loan('b', 'p2'), loan('c', 'p1')]
    const next = reorderVisibleLoans(source, source, 0, 2)
    expect(next.map((item) => item.id)).toEqual(['b', 'c', 'a'])
    expect(source.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(next.find((item) => item.id === 'a').propertyId).toBe('p1')
  })

  it('reorders only loans in the visible BTL group and preserves every other slot', () => {
    const a = loan('a', 'p1')
    const x = loan('x', 'p2')
    const b = loan('b', 'p1')
    const y = loan('y', 'p3')
    const source = [a, x, b, y]
    const next = reorderVisibleLoans(source, [a, b], 0, 1)
    expect(next.map((item) => item.id)).toEqual(['b', 'x', 'a', 'y'])
    expect(next[1]).toBe(x)
    expect(next[3]).toBe(y)
    expect(next[0].propertyId).toBe('p1')
    expect(next[2].propertyId).toBe('p1')
  })

  it('fails safely for invalid moves and duplicate visible ids', () => {
    const source = [loan('a', 'p1'), loan('b', 'p1')]
    expect(reorderList(source, -1, 1).map((item) => item.id)).toEqual(['a', 'b'])
    expect(reorderList(source, 0, 9).map((item) => item.id)).toEqual(['a', 'b'])
    expect(reorderVisibleLoans(source, [source[0], { ...source[0] }], 0, 1).map((item) => item.id)).toEqual(['a', 'b'])
  })
})
