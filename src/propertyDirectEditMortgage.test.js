import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Properties direct editing and mortgage verification', () => {
  it('shows the established calculated mortgage payment in Properties Essentials without duplicating the formula', () => {
    expect(app).toContain("['Mortgage payment / month', (p) => currency(p.monthlyPayment)")
    expect(app).toContain('Calculated from the effective loan balance and current rate.')
    expect(app).toContain('Interest-only loans show interest; repayment loans include scheduled principal over the remaining mortgage term.')
    expect(app).not.toContain("(p) => currency(p.loanAmount * p.currentRate / 12)")
  })

  it('shows mortgage payment immediately in the mobile property snapshot', () => {
    expect(app).toContain('<small>Mortgage / mo</small><b>{currency(mobileProperty.monthlyPayment)}</b>')
    expect(app).toContain('<small>Rate / lender</small>')
    expect(app).toContain('<small>Next remortgage</small>')
  })

  it('maps factual property metrics to honest source fields and leaves derived metrics untargeted', () => {
    const expected = [
      ["Current value", "latestValuation"],
      ["Loan balance", "loanAmount"],
      ["Monthly rent", "rent"],
      ["Mortgage payment / month", "baseRate"],
      ["Actual interest rate", "baseRate"],
      ["Current lender", "lender"],
      ["Next remortgage", "latestRemortgage"],
      ["Purchase price", "purchasePrice"],
      ["Home report at purchase", "homeReportPurchase"],
      ["Address", "address"],
      ["Postcode", "postcode"],
      ["Bedrooms", "bedrooms"],
      ["EPC rating", "epc"],
      ["Area", "areaSqm"],
      ["First purchased", "purchaseDate"],
      ["Gas certificate expiry", "gasExpiry"],
      ["EICR expiry", "eicrExpiry"],
      ["PAT testing expiry", "patExpiry"],
      ["EPC expiry", "epcExpiry"],
    ]
    for (const [label, field] of expected) {
      const rowStart = app.indexOf(`['${label}'`)
      expect(rowStart).toBeGreaterThanOrEqual(0)
      expect(app.slice(rowStart, rowStart + 420)).toContain(`'${field}'`)
    }
    for (const label of ['Equity', 'Current LTV', 'Operating cash flow / month', 'Net yield', 'Annual appreciation']) {
      const rowStart = app.indexOf(`['${label}'`)
      expect(rowStart).toBeGreaterThanOrEqual(0)
      const row = app.slice(rowStart, app.indexOf('\n', rowStart))
      expect(row).not.toMatch(/,\s*false,\s*'[A-Za-z]/)
      expect(row).not.toMatch(/,\s*true,\s*'[A-Za-z]/)
    }
  })

  it('renders one shared accessible edit affordance in desktop and mobile metric rows', () => {
    expect(app).toContain('function PropertyMetricEditButton')
    expect(app).toContain('aria-label={`${actionLabel} for ${property.name}`}')
    expect(app).toContain('onClick={() => onEdit(property.id, editField)}')
    expect(app).toContain('rows.map(([label, getter, kind, advanced, editField, help, supportKey])')
    expect(app).toContain('function PropertyMetricValue')
    expect(app).toContain('<PropertyMetricEditButton property={property} label={label} editField={editField} onEdit={onEdit} />')
    expect(styles).toContain('.property-metric-edit')
    expect(styles).toContain('.mobile-property-row-value')
  })

  it('targets and focuses the canonical EditDrawer input without persisting edit state', () => {
    expect(app).toContain("const [editingField, setEditingField] = useState('')")
    expect(app).toContain("const openPropertyEditor = (id, field = '') => { setEditingField(field); setEditingId(id); setPendingProperty(null) }")
    expect(app).toContain("const closeEditor = () => { setEditingField(''); setEditingId(null); setPendingProperty(null) }")
    expect(app).toContain('focusField={editingField}')
    expect(app).toContain('data-property-field={key}')
    expect(app).toContain('drawerRef.current?.querySelector(`[data-property-field="${focusField}"]`)')
    expect(app).toContain("input.scrollIntoView({ block: 'center', behavior: 'smooth' })")
    expect(app).toContain('input.focus({ preventScroll: true })')
    expect(app).not.toContain('__editFocusField')
  })

  it('clears targeted focus for general edit, new and clone flows', () => {
    expect(app).toContain('onClick={() => openPropertyEditor(mobileProperty.id)}')
    expect(app).toContain('onClick={() => openPropertyEditor(property.id)}')
    expect(app.match(/setEditingField\(''\)/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
