import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const propertyStart = app.indexOf('function OverviewPropertyActionMenu(')
const propertyEnd = app.indexOf('const overviewPropertyViewOptions', propertyStart)
const propertyViews = propertyStart >= 0 && propertyEnd >= 0 ? app.slice(propertyStart, propertyEnd) : ''

describe('Overview property financing information hierarchy', () => {
  it('keeps portfolio-level Asset Financing removed', () => {
    expect(app).not.toContain('className="panel span-2 overview-asset-panel"')
    expect(app).not.toContain('<AssetPositionChart properties={portfolio.selected} />')
    expect(app).not.toContain('<h2>Asset Financing</h2>')
  })

  it('keeps detailed Value/Loan/Equity/LTV financing in the expanded Row drill-down', () => {
    expect(app).toContain('function PropertyFinancingSummary')
    const row = propertyViews.slice(propertyViews.indexOf('function OverviewPropertyRow('), propertyViews.indexOf('function OverviewPropertyMiniCard('))
    expect(row).toContain('<PropertyFinancingSummary property={property} variant="row" />')
    expect(app).toContain('className="asset-track property-financing-track"')
    expect(app).toContain('<small>Value</small>')
    expect(app).toContain('<small>Loan</small>')
    expect(app).toContain('<small>Equity</small>')
    expect(app).toContain('style={{ width: `${ltv * 100}%` }}')
  })

  it('uses a simple LTV bar in Cards and deliberately omits the full financing summary from Cards and Mini', () => {
    const card = propertyViews.slice(propertyViews.indexOf('function PropertyCard('), propertyViews.indexOf('function OverviewPropertyRow('))
    const mini = propertyViews.slice(propertyViews.indexOf('function OverviewPropertyMiniCard('))
    expect(card).toContain('<OverviewLtvBar property={property} />')
    expect(card).not.toContain('PropertyFinancingSummary')
    expect(mini).not.toContain('PropertyFinancingSummary')
    expect(mini).not.toContain('OverviewLtvBar')
  })

  it('preserves operational metrics at the right level', () => {
    const card = propertyViews.slice(propertyViews.indexOf('function PropertyCard('), propertyViews.indexOf('function OverviewPropertyRow('))
    const row = propertyViews.slice(propertyViews.indexOf('function OverviewPropertyRow('), propertyViews.indexOf('function OverviewPropertyMiniCard('))
    expect(card).toContain('label="Mortgage / mo"')
    expect(row).toContain('<span>Mortgage / mo</span>')
    expect(row).toContain('<span>Current rate</span>')
    expect(row).toContain('property.lender')
  })

  it('retains the compact iOS financing styling used by the Row detail', () => {
    expect(styles).toContain('compact iOS-native property financing')
    expect(styles).toContain('.property-financing-row')
    expect(styles).toContain('.property-financing-track')
    expect(styles).toMatch(/\.property-financing-row \.property-financing-track\s*\{[\s\S]*?height:\s*9px !important/)
  })
})
