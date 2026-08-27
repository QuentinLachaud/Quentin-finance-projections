import { describe, expect, it } from 'vitest'
import { confirmPrivateIncome, privateIncomeIsKnown } from './accountMode.js'

describe('ownership-mode private income confirmation', () => {
  it('treats a positive existing gross annual income as known', () => {
    expect(privateIncomeIsKnown({ grossAnnualIncome: 65000 })).toBe(true)
  })

  it('treats explicitly confirmed zero as known', () => {
    expect(privateIncomeIsKnown({ grossAnnualIncome: 0, privateIncomeConfirmed: true })).toBe(true)
  })

  it('requires confirmation for missing/unconfirmed zero', () => {
    expect(privateIncomeIsKnown({ grossAnnualIncome: 0 })).toBe(false)
    expect(privateIncomeIsKnown({})).toBe(false)
  })

  it('confirms private mode while preserving unrelated settings', () => {
    const next = confirmPrivateIncome({
      accountType: 'company',
      companyName: 'Example Holdings Ltd',
      appreciationRate: 0.03,
    }, 72000)
    expect(next).toMatchObject({
      accountType: 'private',
      companyName: 'Example Holdings Ltd',
      appreciationRate: 0.03,
      grossAnnualIncome: 72000,
      privateIncomeConfirmed: true,
    })
  })

  it('clamps invalid and negative confirmed income to zero', () => {
    expect(confirmPrivateIncome({ companyName: 'Keep me' }, -10)).toMatchObject({
      grossAnnualIncome: 0,
      privateIncomeConfirmed: true,
      companyName: 'Keep me',
    })
    expect(confirmPrivateIncome({}, 'bad').grossAnnualIncome).toBe(0)
  })
})
