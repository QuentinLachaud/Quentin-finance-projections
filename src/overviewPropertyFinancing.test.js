import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')

describe('Overview property Asset Financing placement', () => {
  it('removes the standalone portfolio-level Asset Financing subsection', () => {
    expect(app).not.toContain('className="panel span-2 overview-asset-panel"')
    expect(app).not.toContain('<AssetPositionChart properties={portfolio.selected} />')
    expect(app).not.toContain('<h2>Asset Financing</h2>')
  })

  it('uses one shared financing summary in all three Overview property modes', () => {
    expect(app).toContain("function PropertyFinancingSummary({ property, variant = 'card' })")
    expect(app).toContain('<PropertyFinancingSummary property={property} variant="card" />')
    expect(app).toContain('<PropertyFinancingSummary property={property} variant="row" />')
    expect(app).toContain('<PropertyFinancingSummary property={property} variant="mini" />')
  })

  it('preserves Value, Loan, Equity, LTV and the asset/loan financing bar', () => {
    expect(app).toContain('className="asset-track property-financing-track"')
    expect(app).toContain('className="asset-value-bar"')
    expect(app).toContain('className="asset-loan-bar"')
    expect(app).toContain('<small>Value</small>')
    expect(app).toContain('<small>Loan</small>')
    expect(app).toContain('<small>Equity</small>')
    expect(app).toContain('LTV {percent(ltv, 1)}')
    expect(app).toContain('style={{ width: `${ltv * 100}%` }}')
  })

  it('replaces redundant financing metrics while preserving operational card metrics', () => {
    const fullCard = app.slice(app.indexOf('function PropertyCard('), app.indexOf('const overviewPropertyViewOptions'))
    const miniCard = app.slice(app.indexOf('function OverviewPropertyMiniCard('), app.indexOf('function ModelInputFields('))

    expect(fullCard).not.toContain('className="property-value"')
    expect(fullCard).not.toContain('className="equity-bar"')
    expect(fullCard).toContain('<span>Rent / mo</span>')
    expect(fullCard).toContain('<span>Mortgage / mo</span>')
    expect(fullCard).toContain('<span>Net yield</span>')

    expect(miniCard).not.toContain('className="overview-mini-value"')
    expect(miniCard).toContain('<span>Rent / mo</span>')
    expect(miniCard).toContain('<span>Net yield</span>')
  })

  it('adds dedicated responsive styling for card, row and mini financing summaries', () => {
    expect(styles).toContain('move Asset Financing into property cards')
    expect(styles).toContain('.overview-property-card .property-financing')
    expect(styles).toContain('.property-financing-row')
    expect(styles).toContain('.property-financing-mini')
    expect(styles).toContain('.property-financing-track')
    expect(styles).toContain('.overview-buffer-only')
  })
})
