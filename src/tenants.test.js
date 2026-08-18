import { describe, expect, it, vi } from 'vitest'
import { applyTenantToProperty, importPropertyTenants, propertyVoidHistory, removeTenantsForProperty, syncPropertyTenant, tenantBelongsToProperty, tenantTenure } from './tenants.js'

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-tenant-id') })

describe('tenant records', () => {
  const property = { id: 'btl-1', tenantName: 'John Smith', tenantMoveIn: '2025-09-01', tenantEmail: 'john@example.com' }

  it('imports BTL tenant details once and links the record to its property', () => {
    const properties = [{ ...property }]
    const first = importPropertyTenants(properties, [])
    const second = importPropertyTenants(properties, first)
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(first[0]).toMatchObject({ propertyId: 'btl-1', name: 'John Smith', importedFromProperty: true })
    expect(properties[0].tenantId).toBe('generated-tenant-id')
  })

  it('updates the imported tenant when a BTL is edited', () => {
    const result = syncPropertyTenant({ ...property, tenantId: 'tenant-1', tenantPhone: '07000' }, [{ id: 'tenant-1', propertyId: 'btl-1', importedFromProperty: true }])
    expect(result.tenants[0].phone).toBe('07000')
    expect(result.property.tenantId).toBe('tenant-1')
  })

  it('preserves an archived tenant when replacement details are entered on the BTL', () => {
    const archived = { id: 'tenant-1', propertyId: 'btl-1', name: 'John Smith', moveIn: '2025-01-01', moveOut: '2026-01-01', importedFromProperty: true }
    const result = syncPropertyTenant({ ...property, tenantId: 'tenant-1', tenantName: 'Jane Smith', tenantMoveIn: '2026-02-01', tenantMoveOut: '' }, [archived])
    expect(result.tenants).toHaveLength(2)
    expect(result.tenants[0]).toEqual(archived)
    expect(result.tenants[1]).toMatchObject({ name: 'Jane Smith', moveIn: '2026-02-01', moveOut: '' })
    expect(result.property.tenantId).toBe('generated-tenant-id')
  })

  it('reflects edits to an imported tenant back onto the linked BTL', () => {
    const updated = applyTenantToProperty({ id: 'tenant-1', propertyId: 'btl-1', importedFromProperty: true, name: 'Jane Smith', moveIn: '2026-01-01' }, property)
    expect(updated.tenantName).toBe('Jane Smith')
    expect(updated.tenantMoveIn).toBe('2026-01-01')
  })

  it('calculates live tenure from move-in date and the current date', () => {
    expect(tenantTenure({ moveIn: '2025-09-01' }, new Date('2026-11-15T12:00:00'))).toEqual({ live: true, archived: false, label: '1 year 2 months' })
    expect(tenantTenure({ moveIn: '2027-01-01' }, new Date('2026-11-15T12:00:00')).live).toBe(false)
    expect(tenantTenure({ moveIn: '2025-01-01', moveOut: '2026-10-01' }, new Date('2026-11-15T12:00:00')).archived).toBe(true)
  })

  it('calculates void days across historical tenancies without double-counting overlaps', () => {
    const propertyRecord = { id: 'btl-1', purchaseDate: '2025-01-01' }
    const tenants = [
      { propertyId: 'btl-1', moveIn: '2025-01-11', moveOut: '2025-04-11' },
      { propertyId: 'btl-1', moveIn: '2025-04-21', moveOut: '' },
      { propertyId: 'btl-1', moveIn: '2025-05-01', moveOut: '2025-06-01' },
    ]
    const history = propertyVoidHistory(propertyRecord, tenants, new Date('2025-07-01T12:00:00'))
    expect(history.ownedDays).toBe(181)
    expect(history.voidDays).toBe(20)
    expect(history.voidRate).toBeCloseTo(20 / 181)
  })

  it('reports no ownership history when purchase date is absent', () => {
    expect(propertyVoidHistory({ id: 'btl-1' }, [], new Date('2026-01-01T12:00:00'))).toEqual({ voidDays: 0, ownedDays: 0, voidRate: 0 })
  })

  it('rejects orphan links and cascades tenants when a property is removed', () => {
    const tenants = [{ id: 'one', propertyId: 'btl-1' }, { id: 'two', propertyId: 'btl-2' }]
    expect(tenantBelongsToProperty(tenants[0], [{ id: 'btl-1' }])).toBe(true)
    expect(tenantBelongsToProperty({ id: 'orphan', propertyId: '' }, [{ id: 'btl-1' }])).toBe(false)
    expect(removeTenantsForProperty(tenants, 'btl-1')).toEqual([{ id: 'two', propertyId: 'btl-2' }])
    expect(importPropertyTenants([{ id: 'btl-1' }], [{ id: 'orphan', propertyId: 'missing' }])).toEqual([])
  })
})

describe('tenant lifecycle edge-case audit', () => {
  it('returns a consistent non-archived shape for a future tenancy', () => {
    expect(tenantTenure(
      { moveIn: '2027-01-01' },
      new Date('2026-11-15T12:00:00'),
    )).toMatchObject({ live: false, archived: false })
  })

  it('clamps occupancy to the ownership window and today', () => {
    const property = { id: 'btl-1', purchaseDate: '2026-01-10' }
    const history = propertyVoidHistory(property, [
      { propertyId: 'btl-1', moveIn: '2025-12-01', moveOut: '2026-02-01' },
      { propertyId: 'btl-1', moveIn: '2026-02-01', moveOut: '2030-01-01' },
    ], new Date('2026-03-01T12:00:00'))
    expect(history.voidDays).toBe(0)
    expect(history.voidRate).toBe(0)
  })
})
