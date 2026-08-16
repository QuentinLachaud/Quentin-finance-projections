import { describe, expect, it } from 'vitest'
import {
  activeOfficers, activePsc, companyDeadlines, daysUntil, formatCompanyAddress,
  identityVerificationSummary, officialCompanyUrl, outstandingCharges,
} from './companiesHouse.js'

const now = new Date('2026-08-16T12:00:00')

describe('Companies House presentation helpers', () => {
  it('formats official addresses without empty separators', () => {
    expect(formatCompanyAddress({ premises: '10', address_line_1: 'High Street', locality: 'Glasgow', postal_code: 'G1 1AA' })).toBe('10, High Street, Glasgow, G1 1AA')
    expect(formatCompanyAddress({})).toBe('')
  })

  it('builds an encoded official company URL', () => {
    expect(officialCompanyUrl('SC 123')).toBe('https://find-and-update.company-information.service.gov.uk/company/SC%20123')
  })

  it('calculates deadline distance from calendar dates', () => {
    expect(daysUntil('2026-08-16', now)).toBe(0)
    expect(daysUntil('2026-09-15', now)).toBe(30)
    expect(daysUntil('2026-08-15', now)).toBe(-1)
    expect(daysUntil('', now)).toBeNull()
  })

  it('classifies overdue, due-soon and upcoming statutory deadlines', () => {
    const deadlines = companyDeadlines({
      accounts: { next_due: '2026-08-01', overdue: true },
      confirmation_statement: { next_due: '2026-09-15', overdue: false },
    }, now)
    expect(deadlines).toEqual([
      expect.objectContaining({ id: 'accounts', days: -15, status: 'overdue' }),
      expect.objectContaining({ id: 'confirmation', days: 30, status: 'due-soon' }),
    ])
    expect(companyDeadlines({ accounts: { next_due: '2027-01-01' } }, now)[0].status).toBe('upcoming')
  })

  it('filters inactive officers, ceased PSCs and satisfied charges', () => {
    expect(activeOfficers({ items: [{ name: 'Active' }, { name: 'Former', resigned_on: '2025-01-01' }] }).map((item) => item.name)).toEqual(['Active'])
    expect(activePsc({ items: [{ name: 'Active' }, { name: 'Former', ceased: true }] }).map((item) => item.name)).toEqual(['Active'])
    expect(outstandingCharges({ items: [{ id: 1, status: 'outstanding' }, { id: 2, status: 'fully-satisfied' }] }).map((item) => item.id)).toEqual([1])
  })

  it('summarises only identity-verification information published by Companies House', () => {
    const summary = identityVerificationSummary({ items: [
      { name: 'Verified', identity_verification_details: { identity_verified_on: '2026-01-01' } },
      { name: 'Due', identity_verification_details: { appointment_verification_statement_due_on: '2026-10-01' } },
      { name: 'Not published' },
    ] }, { items: [] })
    expect(summary).toEqual({ total: 3, published: 2, verified: 1, due: 1 })
  })
})
