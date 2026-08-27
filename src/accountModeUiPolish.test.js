import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const moneyInput = readFileSync(new URL('./MoneyPeriodInput.jsx', import.meta.url), 'utf8')

describe('account mode switch and money cadence layout polish', () => {
  it('promotes ownership mode to the topbar with explicit person/company context', () => {
    expect(app).toContain('className="account-mode-switch"')
    expect(app).toContain('role="group" aria-label="Portfolio ownership mode"')
    expect(app).toContain('<UserRound')
    expect(app).toContain('<Building2')
    expect(app).toContain('<span>Private</span>')
    expect(app).toContain('<span>Ltd</span>')
    expect(app).toContain('aria-pressed={isPrivate}')
    expect(app).toContain('aria-pressed={!isPrivate}')
  })

  it('removes the buried duplicate selector while preserving company-name editing', () => {
    const profileStart = app.indexOf('function AccountProfileEditor(')
    const profileEnd = app.indexOf('function AccountSetupModal(', profileStart)
    const profile = app.slice(profileStart, profileEnd)
    expect(profile).not.toContain('account-type-toggle')
    expect(profile).toContain('Company name')
    expect(profile).toContain('controlled from the top bar')
  })

  it('asks for private income only when it is not already known', () => {
    expect(app).toContain("import { confirmPrivateIncome, privateIncomeIsKnown } from './accountMode.js'")
    expect(app).toContain('function PrivateIncomePrompt(')
    expect(app).toContain('role="dialog"')
    expect(app).toContain('Private landlord income')
    expect(app).toContain('Annual gross income')
    expect(app).toContain('I have £0 other income')
    expect(app).toContain('privateIncomeIsKnown(state.settings)')
    expect(app).toContain('setPrivateIncomePromptOpen(true)')
    expect(app).toContain('confirmPrivateIncome(current.settings, grossAnnualIncome)')
  })

  it('marks model-input edits as confirmed and does not create a second income field', () => {
    expect(app).toContain("key === 'grossAnnualIncome' ? { privateIncomeConfirmed: true } : {}")
    expect(app).toContain("moneyField('grossAnnualIncome', 'Other gross annual income'")
    expect(app).not.toContain('landlordSalary')
    expect(app).not.toContain('privateSalary')
  })

  it('fixes the flex sizing that clipped Monthly/Annual', () => {
    expect(styles).toContain('account-mode switch and money-period overlap polish')
    expect(styles).toMatch(/\.money-period-input input\s*\{[\s\S]*?width:\s*auto\s*!important;[\s\S]*?flex:\s*1 1 0;[\s\S]*?min-width:\s*0;/)
    expect(styles).toMatch(/\.money-period-input select\s*\{[\s\S]*?width:\s*96px;[\s\S]*?flex:\s*0 0 96px;/)
    expect(moneyInput).toContain('>Monthly</option>')
    expect(moneyInput).toContain('>Annual</option>')
  })

  it('keeps ownership and money controls responsive without hiding mode labels', () => {
    expect(styles).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.account-mode-switch button/)
    expect(styles).toMatch(/@media \(max-width: 520px\)[\s\S]*?\.topbar-reset[\s\S]*?display:\s*none/)
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.money-period-input select[\s\S]*?min-height:\s*44px/)
    expect(styles).not.toMatch(/account-mode-switch button span\s*\{[^}]*display:\s*none/)
  })
})
