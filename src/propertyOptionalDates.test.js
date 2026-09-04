import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { addMonths, calculateProperty, shortDate } from './calculations.js'
import { createBlankProperty, editableSections } from './data.js'
import { calendarDate, dateInputValue } from './dateUtils.js'
import { syncPropertyTenant, tenantTenure } from './tenants.js'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

const optionalDateKeys = [
  'purchaseDate',
  'latestRemortgage',
  'gasExpiry',
  'eicrExpiry',
  'epcExpiry',
  'patExpiry',
  'tenantMoveIn',
  'tenantMoveOut',
]

const fieldByKey = new Map(editableSections.flatMap((section) => section.fields).map((field) => [field[0], field]))

describe('optional property and compliance dates', () => {
  it('keeps all property-editor calendar dates optional and blank by default', () => {
    const property = createBlankProperty('Test BTL')
    for (const key of optionalDateKeys) {
      expect(property[key]).toBe('')
      expect(fieldByKey.get(key)?.[2]).toBe('date')
      expect(fieldByKey.get(key)?.[3]).toBe(true)
    }
  })

  it('parses date-only and persisted ISO datetime values as the same calendar date', () => {
    expect(dateInputValue('2027-03-14')).toBe('2027-03-14')
    expect(dateInputValue('2027-03-14T00:00:00.000Z')).toBe('2027-03-14')
    expect(shortDate('2027-03-14')).toBe('14 Mar 2027')
    expect(shortDate('2027-03-14T00:00:00.000Z')).toBe('14 Mar 2027')
    expect(shortDate('')).toBe('—')
    expect(calendarDate('not-a-date')).toBeNull()
  })

  it('keeps remortgage date arithmetic compatible with stored ISO values', () => {
    const result = addMonths('2027-03-14T00:00:00.000Z', 24)
    expect(dateInputValue(result)).toBe('2029-03-14')
  })

  it('preserves compliance dates while syncing an open-ended tenant', () => {
    const property = {
      ...createBlankProperty('Test BTL'),
      latestValuation: 150000,
      loanAmount: 100000,
      rent: 1000,
      baseRate: 0.05,
      tenantName: 'Current tenant',
      tenantMoveIn: '2026-01-10',
      tenantMoveOut: '',
      gasExpiry: '2027-01-01',
      eicrExpiry: '2028-02-02T00:00:00.000Z',
      patExpiry: '2027-03-03',
      epcExpiry: '2030-04-04',
    }

    const synced = syncPropertyTenant(property, [])
    expect(synced.property.tenantMoveOut).toBe('')
    expect(synced.property.gasExpiry).toBe('2027-01-01')
    expect(synced.property.eicrExpiry).toBe('2028-02-02T00:00:00.000Z')
    expect(synced.property.patExpiry).toBe('2027-03-03')
    expect(synced.property.epcExpiry).toBe('2030-04-04')
    expect(tenantTenure(synced.tenants[0], new Date('2026-08-30T12:00:00Z')).live).toBe(true)

    const calculated = calculateProperty(synced.property, { rateShock: 0, appreciationRate: 0.03 })
    expect(calculated.eicrExpiry).toBe('2028-02-02T00:00:00.000Z')
    expect(shortDate(calculated.eicrExpiry)).toBe('02 Feb 2028')
  })

  it('renders the explicit optional-date UX and uses shared parsing in the Compliance diary', () => {
    expect(app).toContain('const renderField = ([key, label, type, optional = false]) =>')
    expect(app).toContain('{section.fields.map(renderField)}')
    expect(app).toContain("type === 'date' ? dateInputValue(draft[key])")
    expect(app).toContain('aria-label={`Clear ${label}`}')
    expect(app).toContain("onClick={(event) => { event.preventDefault(); update(key, '', type) }}")
    expect(app).toContain('date:calendarDate(date)')
    expect(app).not.toContain('date:new Date(date instanceof Date ? date : `${date}T12:00:00`)')
  })
})
