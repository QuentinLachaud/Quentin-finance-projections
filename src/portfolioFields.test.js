import { describe, expect, it } from 'vitest'
import { formatPropertyAddress, formatRateComposition, includedPortfolioProperties, shouldSelectZeroInput, tenantsForIncludedProperties, visiblePropertyRows } from './portfolioFields.js'

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

  it('keeps advanced property metrics out of Basic view', () => {
    const rows = [
      ['Current LTV', () => 0.7, 'percent'],
      ['Expected LTV at remortgage', () => 0.68, 'percent', true],
      ['Releasable equity at 75% LTV', () => 10000, 'money-positive', true],
    ]

    expect(visiblePropertyRows(rows, false).map(([label]) => label)).toEqual(['Current LTV'])
    expect(visiblePropertyRows(rows, true).map(([label]) => label)).toEqual([
      'Current LTV',
      'Expected LTV at remortgage',
      'Releasable equity at 75% LTV',
    ])
  })


  it('uses the property active flag as the master portfolio inclusion switch', () => {
    const properties = [
      { id: 'one', name: 'BTL1', active: true },
      { id: 'two', name: 'BTL2', active: false },
      { id: 'three', name: 'BTL3', active: true },
    ]
    const tenants = [
      { id: 'tenant-one', propertyId: 'one' },
      { id: 'tenant-two', propertyId: 'two' },
    ]

    expect(includedPortfolioProperties(properties).map((property) => property.id)).toEqual(['one', 'three'])
    expect(tenantsForIncludedProperties(tenants, properties).map((tenant) => tenant.id)).toEqual(['tenant-one'])
  })

})
