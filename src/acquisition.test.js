import { describe, expect, it } from 'vitest'
import { acquisitionCosts, createAcquisition, nextAcquisitionName, prependAcquisition } from './acquisition.js'

describe('Acquisition calculations', () => {
  it('calculates Scottish cash required', () => {
    const result = acquisitionCosts(createAcquisition({ purchasePrice: 200000, jurisdiction: 'scotland', ltv: 75, adsRate: 8, legalFees: 1500 }))
    expect(result.baseTax).toBe(1100); expect(result.supplement).toBe(16000); expect(result.deposit).toBe(50000); expect(result.cashRequired).toBe(68600)
  })
  it('calculates current England/NI SDLT and Wales LTT', () => {
    expect(acquisitionCosts(createAcquisition({ purchasePrice: 300000, jurisdiction: 'england-ni', legalFees: 0 })).baseTax).toBe(20000)
    expect(acquisitionCosts(createAcquisition({ purchasePrice: 260000, jurisdiction: 'wales', legalFees: 0 })).baseTax).toBe(15950)
  })
  it('adds a mortgage fee to completion cash only when paid upfront', () => {
    const base = { purchasePrice: 200000, jurisdiction: 'scotland', mortgageFee: 2500 }
    const financed = acquisitionCosts(createAcquisition({ ...base, mortgageFeeAddedToLoan: true }))
    const upfront = acquisitionCosts(createAcquisition({ ...base, mortgageFeeAddedToLoan: false }))
    expect(upfront.cashRequired - financed.cashRequired).toBe(2500)
  })
  it('calculates gross yield from user-entered rent', () => expect(acquisitionCosts(createAcquisition({ purchasePrice: 200000, expectedMonthlyRent: 1200 })).grossYield).toBeCloseTo(.072))
})

describe('Simplified acquisition model', () => {
  it('does not store scraped physical metadata', () => {
    const item = createAcquisition({ name:'BTL3', purchasePrice:180000, expectedMonthlyRent:1200, address:'x', postcode:'G3 8PP', bedrooms:2, epc:'B', areaSqm:68, propertyType:'Flat' })
    expect(item).toMatchObject({ name:'BTL3', purchasePrice:180000, expectedMonthlyRent:1200 })
    for (const key of ['address','postcode','bedrooms','epc','areaSqm','propertyType']) expect(item).not.toHaveProperty(key)
  })
  it('names from existing BTL count and avoids duplicate potential names', () => {
    expect(nextAcquisitionName(2, [])).toBe('BTL3')
    expect(nextAcquisitionName(2, [{ name:'BTL3' }])).toBe('BTL4')
  })
  it('prepends confirmed acquisitions', () => expect(prependAcquisition([{id:'old'}], {id:'new'}).map((item) => item.id)).toEqual(['new','old']))
})
