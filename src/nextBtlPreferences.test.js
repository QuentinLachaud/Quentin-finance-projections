import { describe, expect, it } from 'vitest'
import { NEXT_BTL_PREFERENCES_VERSION, normalizeNextBtlPreferences } from './nextBtlPreferences.js'

describe('next-BTL persisted preferences', () => {
  it('returns a stable versioned safe shape for absent or malformed values', () => {
    expect(normalizeNextBtlPreferences(null)).toEqual({ version: NEXT_BTL_PREFERENCES_VERSION, equityReleaseOptions: {} })
    expect(normalizeNextBtlPreferences('bad')).toEqual({ version: NEXT_BTL_PREFERENCES_VERSION, equityReleaseOptions: {} })
  })

  it('keeps only supported planner inputs and drops derived/unknown output fields', () => {
    const result = normalizeNextBtlPreferences({
      targetSource: 'saved',
      selectedAcquisitionId: 'btl-4',
      targetPrice: 190000,
      scenarioIndex: 2,
      preserveBuffer: false,
      includeExtraction: true,
      appreciationPercent: 4.25,
      crossingMonth: 17,
      buyingPower: 240000,
      arbitrary: 'drop-me',
    })
    expect(result).toMatchObject({
      targetSource: 'saved',
      selectedAcquisitionId: 'btl-4',
      targetPrice: 190000,
      scenarioIndex: 2,
      preserveBuffer: false,
      includeExtraction: true,
      appreciationPercent: 4.25,
    })
    expect(result).not.toHaveProperty('crossingMonth')
    expect(result).not.toHaveProperty('buyingPower')
    expect(result).not.toHaveProperty('arbitrary')
  })

  it('validates scenario and booleans and clamps appreciation', () => {
    const high = normalizeNextBtlPreferences({ scenarioIndex: 4, preserveBuffer: 'true', includeExtraction: 1, appreciationPercent: 80 })
    expect(high).not.toHaveProperty('scenarioIndex')
    expect(high).not.toHaveProperty('preserveBuffer')
    expect(high).not.toHaveProperty('includeExtraction')
    expect(high.appreciationPercent).toBe(30)

    const low = normalizeNextBtlPreferences({ appreciationPercent: -80 })
    expect(low.appreciationPercent).toBe(-20)
  })

  it('allowlists manual purchase assumptions', () => {
    const result = normalizeNextBtlPreferences({
      assumptions: {
        jurisdiction: 'scotland',
        ltv: 75,
        adsRate: 8,
        legalFees: 1500,
        mortgageFee: 999,
        mortgageFeeAddedToLoan: false,
        cashRequired: 999999,
        extra: 'no',
      },
    })
    expect(result.assumptions).toEqual({
      jurisdiction: 'scotland',
      ltv: 75,
      adsRate: 8,
      legalFees: 1500,
      mortgageFee: 999,
      mortgageFeeAddedToLoan: false,
    })
  })

  it('sanitizes per-property equity-release choices and clamps target LTV', () => {
    const result = normalizeNextBtlPreferences({
      equityReleaseOptions: {
        p1: { enabled: true, targetLtv: 70 },
        p2: { enabled: 'yes', targetLtv: 120 },
        p3: { enabled: false, targetLtv: -10 },
        p4: 'bad',
      },
    })
    expect(result.equityReleaseOptions).toEqual({
      p1: { enabled: true, targetLtv: 70 },
      p2: { enabled: false, targetLtv: 100 },
      p3: { enabled: false, targetLtv: 0 },
    })
  })
})
