import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

describe('private-landlord summary panel removal', () => {
  it('does not define or render the large Estimated property income tax panel', () => {
    expect(app).not.toContain('function PrivateTaxSummary')
    expect(app).not.toContain('<PrivateTaxSummary')
    expect(app).not.toContain('Estimated property income tax')
    expect(app).not.toContain('className="panel private-tax-summary"')
  })

  it('preserves private-landlord tax planning inputs', () => {
    expect(app).toContain('function PrivateLandlordInputs')
    expect(app).toContain('Private landlord tax')
    expect(app).toContain('Other gross annual income')
    expect(app).toContain('Property loss brought forward')
    expect(app).toContain('Finance costs brought forward')
    expect(app).toContain('Tax jurisdiction')
  })
})
