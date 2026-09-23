import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const propertyStart = app.indexOf('function OverviewPropertyActionMenu(')
const rowStart = app.indexOf('function OverviewPropertyRow(', propertyStart)
const rowEnd = app.indexOf('function ModelInputFields(', rowStart)
const row = rowStart >= 0 && rowEnd >= 0 ? app.slice(rowStart, rowEnd) : ''

describe('Overview property financing information hierarchy', () => {
  it('keeps portfolio-level Asset Financing removed', () => {
    expect(app).not.toContain('className="panel span-2 overview-asset-panel"')
    expect(app).not.toContain('<AssetPositionChart properties={portfolio.selected} />')
    expect(app).not.toContain('<h2>Asset Financing</h2>')
  })

  it('adds decision-useful LTV context to the expanded Row drill-down', () => {
    expect(app).toContain('function PropertyFinancingSummary')
    expect(row).toContain('<PropertyFinancingSummary property={property} variant="row" />')
    expect(app).toContain('const referenceLtv = 0.75')
    expect(app).toContain('const referenceBands = [0.6, 0.7, 0.75]')
    expect(app).toContain('property-financing-threshold')
    expect(app).toContain('property-financing-current-marker')
    expect(app).toContain("referenceGap >= 0 ? '75% headroom' : 'Repay to 75%'")
    expect(app).toContain('currency(Math.abs(referenceGap))')
  })

  it('avoids repeating collapsed-row metrics in the expanded detail', () => {
    expect(row).toContain('label="Rent / mo"')
    expect(row).toContain('label="Net yield"')
    expect(row).not.toContain('<span>Rent / mo</span>')
    expect(row).not.toContain('<span>Net yield</span>')
  })

  it('uses the expanded space for useful operating and financing facts', () => {
    expect(row).toContain('className="overview-property-row-finance-facts"')
    expect(row).toContain('<span>Operating cash flow / mo</span>')
    expect(row).toContain('<span>Mortgage / mo</span>')
    expect(row).toContain('<span>Current rate</span>')
    expect(row).toContain('<span>Lender</span>')
    expect(row).toContain('<span>Next remortgage</span>')
    expect(row).toContain('className="overview-property-row-open-action"')
  })

  it('uses the latest iOS-native grouped financing styling', () => {
    expect(styles).toContain('decision-useful Overview property financing')
    expect(styles).toContain('.property-financing-threshold')
    expect(styles).toContain('.property-financing-current-marker')
    expect(styles).toContain('.overview-property-row-finance-facts')
    expect(styles).toMatch(/\.property-financing-row \.property-financing-numbers\s*\{[\s\S]*?border-radius:\s*14px/)
    expect(styles).toMatch(/\.overview-property-row-finance-facts\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/)
  })
})
