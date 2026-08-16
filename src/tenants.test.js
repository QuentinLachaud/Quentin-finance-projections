import { describe, expect, it, vi } from 'vitest'
import { applyTenantToProperty, importPropertyTenants, removeTenantsForProperty, syncPropertyTenant, tenantBelongsToProperty, tenantTenure } from './tenants.js'

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

  it('reflects edits to an imported tenant back onto the linked BTL', () => {
    const updated = applyTenantToProperty({ id: 'tenant-1', propertyId: 'btl-1', importedFromProperty: true, name: 'Jane Smith', moveIn: '2026-01-01' }, property)
    expect(updated.tenantName).toBe('Jane Smith')
    expect(updated.tenantMoveIn).toBe('2026-01-01')
  })

  it('calculates live tenure from move-in date and the current date', () => {
    expect(tenantTenure({ moveIn: '2025-09-01' }, new Date('2026-11-15T12:00:00'))).toEqual({ live: true, label: '1 year 2 months' })
    expect(tenantTenure({ moveIn: '2027-01-01' }, new Date('2026-11-15T12:00:00')).live).toBe(false)
  })

  it('rejects orphan links and cascades tenants when a property is removed', () => {
    const tenants = [{ id: 'one', propertyId: 'btl-1' }, { id: 'two', propertyId: 'btl-2' }]
    expect(tenantBelongsToProperty(tenants[0], [{ id: 'btl-1' }])).toBe(true)
    expect(tenantBelongsToProperty({ id: 'orphan', propertyId: '' }, [{ id: 'btl-1' }])).toBe(false)
    expect(removeTenantsForProperty(tenants, 'btl-1')).toEqual([{ id: 'two', propertyId: 'btl-2' }])
    expect(importPropertyTenants([{ id: 'btl-1' }], [{ id: 'orphan', propertyId: 'missing' }])).toEqual([])
  })
})
