import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_DEPOSIT_SCHEME, createBlankProperty, editableSections, normalizePropertyRecord } from './data.js'
import { applyTenantToProperty, createTenant, importPropertyTenants, stripPropertyDepositFields, syncPropertyTenant, tenantDepositDetails } from './tenants.js'
import { propertyMetricSupported } from './propertyDisclosure.js'

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-id') })
const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const byKey = new Map(editableSections.flatMap((section) => section.fields).map((f) => [f[0], f]))
const adminValues = {
  factorsProvider: 'Speirs Gumley',
  factorsAccountNumber: 'FAC-123',
  mortgageNumber: 'MORT-456',
  buildingsInsuranceProvider: 'Example Insurance',
  buildingsInsurancePolicyNumber: 'POL-789',
  buildingsInsuranceInsuredValue: 275000,
  depositScheme: 'SafeDeposits Scotland',
  depositRegistrationNumber: 'DEP-321',
}

describe('BTL administration and canonical deposit registration', () => {
  it('creates safe defaults and shows the Factors example only as a placeholder', () => {
    const p = createBlankProperty('BTL Test')
    expect(p).toMatchObject({
      factorsProvider: '',
      factorsAccountNumber: '',
      mortgageNumber: '',
      buildingsInsuranceProvider: '',
      buildingsInsurancePolicyNumber: '',
      buildingsInsuranceInsuredValue: '',
      depositScheme: DEFAULT_DEPOSIT_SCHEME,
      depositRegistrationNumber: '',
    })
    expect(DEFAULT_DEPOSIT_SCHEME).toBe('SafeDeposits Scotland')
    expect(byKey.get('factorsProvider')[4]).toBe('Speirs Gumley')
    expect(byKey.get('mortgageNumber')[1]).toBe('Mortgage provider account number')
    expect(byKey.get('buildingsInsuranceInsuredValue')[2]).toBe('optional-number')
  })

  it('preserves legacy properties, optional values and existing mortgage references', () => {
    const old = { id: 'old', rent: 900, mortgageNumber: 'OLD-MORT', factorsProvider: null, depositScheme: ' ' }
    expect(normalizePropertyRecord(old)).toMatchObject({
      id: 'old', rent: 900, mortgageNumber: 'OLD-MORT',
      factorsProvider: '', factorsAccountNumber: '', buildingsInsuranceProvider: '',
      buildingsInsurancePolicyNumber: '', buildingsInsuranceInsuredValue: '',
      depositScheme: 'SafeDeposits Scotland', depositRegistrationNumber: '',
    })
    expect(old.factorsProvider).toBeNull()
    expect(normalizePropertyRecord(null).depositScheme).toBe(DEFAULT_DEPOSIT_SCHEME)
    expect(normalizePropertyRecord({ depositScheme: 'MyDeposits Scotland' }).depositScheme).toBe('MyDeposits Scotland')
  })

  it('round-trips all editable fields through portfolio JSON persistence and detail visibility', () => {
    const reloaded = normalizePropertyRecord(JSON.parse(JSON.stringify({ ...createBlankProperty('BTL 1'), ...adminValues })))
    for (const [key, value] of Object.entries(adminValues)) {
      expect(byKey.has(key)).toBe(true)
      expect(reloaded[key]).toEqual(value)
      expect(propertyMetricSupported(reloaded, key)).toBe(true)
    }
    expect(app).toContain("upsert({ user_id: user.id, portfolio: state }, { onConflict: 'user_id' })")
    expect(app).toContain('...normalizePropertyRecord(property)')
    expect(app).toContain('syncPropertyTenant(normalizePropertyRecord(draft), current.tenants)')
  })

  it('eliminates stale tenant copies of property-owned registration fields', () => {
    const tenant = createTenant('btl-1')
    expect(tenant).not.toHaveProperty('depositScheme')
    expect(tenant).not.toHaveProperty('depositRegistrationNumber')
    const legacy = { id: 'old', propertyId: 'btl-1', name: 'Tenant', depositScheme: 'Wrong', depositRegistrationNumber: 'Wrong' }
    expect(stripPropertyDepositFields(legacy)).not.toHaveProperty('depositScheme')
    const imported = importPropertyTenants([{ id: 'btl-1' }], [legacy])
    expect(imported[0]).not.toHaveProperty('depositScheme')
    expect(imported[0]).not.toHaveProperty('depositRegistrationNumber')
    const synced = syncPropertyTenant({ id: 'btl-1', tenantId: 'old', tenantName: 'Tenant' }, [{ ...legacy, importedFromProperty: true }])
    expect(synced.tenants[0]).not.toHaveProperty('depositScheme')
    expect(synced.tenants[0]).not.toHaveProperty('depositRegistrationNumber')
  })

  it('resolves tenant scheme and registration live from the currently linked BTL', () => {
    const tenant = createTenant('btl-1')
    const p = { id: 'btl-1', name: 'BTL 1', depositScheme: 'SafeDeposits Scotland', depositRegistrationNumber: 'REG-ONE' }
    expect(tenantDepositDetails(tenant, [p])).toEqual({
      propertyId: 'btl-1', propertyName: 'BTL 1', scheme: 'SafeDeposits Scotland', registrationNumber: 'REG-ONE',
    })
    expect(tenantDepositDetails(tenant, [{ ...p, depositRegistrationNumber: 'REG-TWO' }]).registrationNumber).toBe('REG-TWO')
    expect(tenantDepositDetails(tenant, [{ id: 'other', name: 'Other' }])).toMatchObject({
      propertyName: 'Unknown BTL', scheme: '', registrationNumber: '',
    })
    expect(tenant).not.toHaveProperty('depositRegistrationNumber')
  })

  it('does not copy tenant-supplied registration fields back onto its linked property', () => {
    const property = { id: 'btl-1', depositScheme: 'SafeDeposits Scotland', depositRegistrationNumber: 'CORRECT' }
    const tenant = { id: 't1', importedFromProperty: true, propertyId: 'btl-1', name: 'Jane', depositScheme: 'Wrong', depositRegistrationNumber: 'Wrong' }
    expect(applyTenantToProperty(tenant, property)).toMatchObject({
      depositScheme: 'SafeDeposits Scotland', depositRegistrationNumber: 'CORRECT',
    })
  })

  it('wires editor, details, cards and exports without duplicating tenant storage', () => {
    expect(app).toContain("title: 'Property administration'")
    expect(app).toContain("['Buildings insurance insured value', (p) => currency(p.buildingsInsuranceInsuredValue)")
    expect(app).toContain('placeholder={placeholder || undefined}')
    expect(app).toContain('const depositDetails = tenantDepositDetails(tenant, properties)')
    expect(app).toContain('<dt>BTL / property</dt><dd>{depositDetails.propertyName}</dd>')
    expect(app).toContain('<dt>Deposit scheme</dt><dd>{depositDetails.scheme')
    expect(app).toContain('<dt>Deposit registration number</dt><dd>{depositDetails.registrationNumber')
    expect(app).toContain("{ key: 'depositRegistrationNumber', label: 'Deposit registration number' }")
    expect(app).toContain("depositRegistrationNumber: '' }, [])")
    expect(app).toContain('stripPropertyDepositFields(submittedTenant)')
  })
})
