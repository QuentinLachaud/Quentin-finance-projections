import { describe, expect, it } from 'vitest'
import { contractorDisplayName, normalizeContractor } from './contractors.js'

const properties = [{ id: 'btl-1', name: 'BTL1' }]

describe('contractor canonical name migration', () => {
  it('hydrates legacy first/last names into the canonical name without losing display compatibility', () => {
    const contractor = normalizeContractor({ id: 'c1', firstName: ' Sam ', lastName: ' Smith ', phone: '01234' }, properties)
    expect(contractor.name).toBe('Sam Smith')
    expect(contractorDisplayName(contractor)).toBe('Sam Smith')
  })

  it('accepts a one-field modern name and no longer requires a last name', () => {
    const contractor = normalizeContractor({ id: 'c2', name: 'Madonna', phone: '01234' }, properties)
    expect(contractor.name).toBe('Madonna')
    expect(contractorDisplayName(contractor)).toBe('Madonna')
  })
})
