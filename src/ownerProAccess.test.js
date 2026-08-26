import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const billing = readFileSync(new URL('./BillingWorkspace.jsx', import.meta.url), 'utf8')

describe('owner-only Pro access email list', () => {
  it('uses the dedicated owner-only billing action', () => {
    expect(billing).toContain("billingRequest({ action: 'admin-list-pro-access' })")
  })

  it('loads only for the owner in the full billing workspace', () => {
    expect(billing).toContain("if (entitlement?.isOwner && !modal) loadProAccess()")
    expect(billing).toContain("{entitlement?.isOwner && <div className=\"owner-pro-access-list\">")
  })

  it('refreshes immediately after a successful manual access update', () => {
    expect(billing).toMatch(/setAdminResult\([\s\S]*?await loadProAccess\(\)/)
  })

  it('renders email strings only rather than internal account metadata', () => {
    expect(billing).toContain('{email}')
    expect(billing).not.toContain('stripeCustomerId}</li>')
    expect(billing).not.toContain('user_id}</li>')
  })
})
