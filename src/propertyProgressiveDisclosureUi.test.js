import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const data = readFileSync(new URL('./data.js', import.meta.url), 'utf8')
const calculations = readFileSync(new URL('./calculations.js', import.meta.url), 'utf8')

describe('progressive property disclosure UI', () => {
  it('renders five always-visible Essentials and five optional native disclosures from canonical field metadata', () => {
    expect(app).toContain('editableFieldIndex = new Map(editableSections.flatMap')
    expect(app).toContain('editableFieldsFor(PROPERTY_EDITOR_CORE_KEYS)')
    expect(app).toContain('PROPERTY_EDITOR_OPTIONAL_SECTIONS.map')
    expect(app).toContain('<h3>Essentials</h3>')
    expect(app).toContain('<h3>Add more details</h3>')
    expect(app).toContain('<details className="property-editor-disclosure"')
    for (const title of ['Purchase & property details', 'Financing', 'Running costs', 'Tenancy', 'Compliance']) {
      expect(app).toContain('section.title')
      expect(readFileSync(new URL('./propertyDisclosure.js', import.meta.url), 'utf8')).toContain(`title: '${title}'`)
    }
  })

  it('opens a collapsed disclosure before Feature 2 scroll/focus navigation', () => {
    expect(app).toContain("const disclosure = input.closest('details')")
    expect(app).toContain('if (disclosure) disclosure.open = true')
    expect(app).toContain("input.scrollIntoView({ block: 'center', behavior: 'smooth' })")
    expect(app).toContain('input.focus({ preventScroll: true })')
  })

  it('adds support metadata without losing direct-edit mortgage verification', () => {
    expect(app).toContain("['Mortgage payment / month', (p) => currency(p.monthlyPayment)")
    expect(app).toContain("'baseRate', 'Calculated from the effective loan balance and current rate. Interest-only loans show interest; repayment loans include scheduled principal over the remaining mortgage term.', 'mortgagePayment'")
    expect(app).toContain('function PropertyMetricEditButton')
    expect(app).toContain('function PropertyMetricValue')
  })

  it('filters desktop/mobile rows by real data and provides compact empty states', () => {
    expect(app).toContain('supportedPropertyRows(group.rows, advancedPropertyView, filtered)')
    expect(app).toContain('supportedPropertyRows(group.rows, advancedPropertyView, mobileProperty ? [mobileProperty] : [])')
    expect(app).toContain('if (!rows.length && !advancedPropertyView) return null')
    expect(app).toContain('className="property-group-empty-row"')
    expect(app).toContain('className="mobile-property-empty property-group-empty"')
    expect(app).toContain('openPropertyEditor(mobileProperty.id, group.emptyEditField)')
    expect(app).toContain('property-metric-missing">Not added')
  })

  it('does not render unsupported mobile snapshot values unconditionally', () => {
    for (const key of ['currentValue', 'equity', 'ltv', 'rent', 'operatingCashflow', 'netYield', 'mortgagePayment', 'nextRemortgage']) {
      expect(app).toContain(`propertyMetricSupported(mobileProperty, '${key}')`)
    }
  })

  it('lets Overview hide unsupported metrics without changing its view hierarchy', () => {
    expect(app).toContain('function OverviewPropertyMetric({ label, value, emphasis = false, supported = true })')
    expect(app).toContain('if (!supported) return null')
    expect(app).toContain("propertyMetricSupported(property, 'ltv')")
    expect(app).toContain("propertyMetricSupported(property, 'netYield')")
    expect(app).toContain("['cards', 'Cards']")
    expect(app).toContain("['rows', 'Rows']")
    expect(app).toContain("['mini', 'Mini']")
  })

  it('does not change blank-property defaults or financial formulas', () => {
    expect(data).toContain("export const createBlankProperty")
    expect(data).toContain("fixedRateMonths: 24")
    expect(calculations).toContain('return loanAmount * currentRate / 12')
    expect(app).toContain("supabase.from('portfolio_states').upsert({ user_id: user.id, portfolio: state }")
    expect(app).not.toContain('__propertyDisclosureState')
  })

  it('adds theme-aware disclosure and missing-state styles', () => {
    expect(styles).toContain('progressive property disclosure')
    expect(styles).toContain('.property-editor-disclosure')
    expect(styles).toContain('.property-metric-missing')
    expect(styles).toContain('.property-group-empty-row')
    expect(styles).toContain('.property-editor-disclosure > summary:focus-visible')
  })
})
