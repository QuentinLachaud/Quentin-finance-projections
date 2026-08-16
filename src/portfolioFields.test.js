import { describe, expect, it } from 'vitest'
import { formatPropertyAddress, shouldSelectZeroInput } from './portfolioFields.js'

describe('portfolio field behaviour', () => {
  it('formats addresses without leading or empty separators', () => {
    expect(formatPropertyAddress('', '1/1, 281 Dumbarton Road')).toBe('1/1, 281 Dumbarton Road')
    expect(formatPropertyAddress('1/1', '281 Dumbarton Road')).toBe('1/1, 281 Dumbarton Road')
    expect(formatPropertyAddress('', '', 'G11 6AB')).toBe('G11 6AB')
  })

  it('selects numeric zero values for replacement but preserves other values', () => {
    expect(shouldSelectZeroInput({ type: 'number', value: '0' })).toBe(true)
    expect(shouldSelectZeroInput({ type: 'number', value: '0.00' })).toBe(true)
    expect(shouldSelectZeroInput({ type: 'number', value: '10' })).toBe(false)
    expect(shouldSelectZeroInput({ type: 'text', value: '0' })).toBe(false)
  })
})

