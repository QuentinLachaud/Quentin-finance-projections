import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const moneyInput = readFileSync(new URL('./MoneyPeriodInput.jsx', import.meta.url), 'utf8')

describe('Costs & Cash Flows monthly / annual entry integration', () => {
  it('hydrates and persists cadence preferences through portfolio state', () => {
    expect(app).toContain("import { moneyEntryPeriodFor, normalizeMoneyEntryPreferences, setMoneyEntryPeriod } from './moneyPeriods.js'")
    expect(app).toContain("import MoneyPeriodInput from './MoneyPeriodInput.jsx'")
    expect(app).toContain('costsCashflowPreferences: normalizeMoneyEntryPreferences(portfolioState.costsCashflowPreferences)')
    expect(app).toContain('const updateCostsCashflowPreferences =')
    expect(app).toContain('entryPeriodPreferences={state.costsCashflowPreferences}')
    expect(app).toContain('onEntryPeriodPreferencesChange={updateCostsCashflowPreferences}')
  })

  it('uses MoneyPeriodInput for every editable property money category', () => {
    expect(app).toContain('fieldKey: "rent"')
    expect(app).toContain('fieldKey: "voidsOverride"')
    expect(app).toContain("propertyCostFields.filter(([, , group]) => group === 'fixed').map")
    expect(app).toContain("propertyCostFields.filter(([, , group]) => group === 'variable').map")
    expect(app).toContain('<MoneyPeriodInput')
    expect(app).toContain('moneyEntryPeriodFor(normalizedEntryPeriods, preferenceKey)')
  })

  it('uses the same cadence control for company costs and extractions', () => {
    expect(app).toContain('collectionKey="companyCosts"')
    expect(app).toContain('collectionKey="extractions"')
    expect(app).toContain('const preferenceKey = `line:${collectionKey}:${item.id}:amount`')
    expect(app).toContain('<span>Amount</span>')
    expect(app).toContain('placeholder="New recurring item"')
  })

  it('keeps calculated mortgage and all output reporting explicitly monthly', () => {
    expect(app).toContain('Mortgage payment <small>calculated</small>')
    expect(app).toContain('value={moneyInputValue(property.monthlyPayment)} readOnly')
    expect(app).toContain('<small>/ month</small>')
    expect(app).toContain('<th>Monthly line</th>')
    expect(app).toContain('Income and monthly cost assumptions feed directly into all scenarios and projections.')
  })

  it('provides explicit cadence labels and annual monthly-equivalent copy', () => {
    expect(moneyInput).toContain('>Monthly</option>')
    expect(moneyInput).toContain('>Annual</option>')
    expect(moneyInput).toContain('/ month equivalent')
  })

  it('has responsive styling for the wider cadence-aware controls', () => {
    expect(styles).toContain('monthly/annual Costs & Cash Flows entry')
    expect(styles).toMatch(/\.money-period-input select[\s\S]*?min-height:\s*42px/)
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.money-period-input input[\s\S]*?font-size:\s*16px/)
    expect(styles).toMatch(/@media \(max-width: 520px\)[\s\S]*?\.cost-category > label[\s\S]*?grid-template-columns:\s*1fr/)
  })
})
