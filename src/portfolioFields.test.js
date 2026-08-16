import { describe, expect, it } from 'vitest'
import { formatPropertyAddress, formatRateComposition, shouldSelectZeroInput } from './portfolioFields.js'

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

  it('shows the base rate, shock and effective rate without redundant zero shocks', () => {
    expect(formatRateComposition(0.0484, 0.0584)).toBe('4.84% + 1.00% = 5.84%')
    expect(formatRateComposition(0.0484, 0.0484)).toBe('4.84%')
    expect(formatRateComposition(0.0484, 0.0384)).toBe('4.84% − 1.00% = 3.84%')
  })
})
