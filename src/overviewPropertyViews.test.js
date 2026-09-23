import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const marker = '/* Brain Drain 2026-08-26 22:02 BST — purpose-built Overview property views */'
const start = styles.indexOf(marker)
const next = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
const css = start >= 0 ? styles.slice(start, next >= 0 ? next : undefined) : ''
const componentStart = app.indexOf('function OverviewPropertyActionMenu(')
const componentEnd = app.indexOf('function ModelInputFields(', componentStart)
const properties = componentStart >= 0 && componentEnd >= 0 ? app.slice(componentStart, componentEnd) : ''
const row = properties.slice(properties.indexOf('function OverviewPropertyRow('))
const overviewStart = app.indexOf("{section === 'Overview' && <>")
const overviewEnd = app.indexOf("{section === 'Properties' && <>", overviewStart)
const overview = overviewStart >= 0 && overviewEnd >= 0 ? app.slice(overviewStart, overviewEnd) : ''

describe('row-only Overview property view', () => {
  it('renders Rows directly and removes Cards, Mini, selector state and persisted view preference', () => {
    expect(overview).toContain('<div className="overview-property-view-stage" data-view="rows">')
    expect(overview).toContain('<section className="overview-property-rows">')
    expect(overview).toContain('<OverviewPropertyRow')
    expect(overview).toContain('className="primary-button overview-add-btl-button"')
    expect(overview).toContain('View full table')
    expect(app).not.toContain('function PropertyCard(')
    expect(app).not.toContain('function OverviewPropertyMiniCard(')
    expect(app).not.toContain('const overviewPropertyViewOptions')
    expect(app).not.toContain('function OverviewPropertyViewSelector(')
    expect(app).not.toContain("['cards', 'Cards']")
    expect(app).not.toContain("['mini', 'Mini']")
    expect(app).not.toContain('btl-overview-property-view-v2:${user.id}')
    expect(app).not.toContain('overviewPropertyView')
  })

  it('keeps Rows as the existing compact comparison surface before the financing drill-down', () => {
    expect(row).toContain('aria-expanded={expanded}')
    expect(row).toContain('label="Value"')
    expect(row).toContain('label="LTV"')
    expect(row).toContain('label="Equity"')
    expect(row).toContain('label="Rent / mo"')
    expect(row).toContain('label="Net yield"')
    expect(row).toContain('<PropertyFinancingSummary property={property} variant="row" />')
    expect(row).toContain('<span>Mortgage / mo</span>')
    expect(row).toContain('<span>Current rate</span>')
    expect(row).toContain('property.lender')
    expect(row).toContain('Open property')
  })

  it('keeps management in the existing accessible overflow menu', () => {
    expect(properties).toContain('aria-haspopup="menu"')
    expect(properties).toContain('aria-expanded={open}')
    expect(properties).toContain('role="menu"')
    expect(properties).toContain('role="menuitem"')
    expect(properties).toContain('<span>Edit</span>')
    expect(properties).toContain('<span>Duplicate</span>')
    expect(properties).toContain("'Exclude from totals' : 'Include in totals'")
    expect(properties).toContain("event.key !== 'Escape'")
    expect(properties).toContain("document.addEventListener('pointerdown', handlePointerDown)")
  })

  it('preserves the approved row width and phone hierarchy', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(css).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif')
    expect(css).toMatch(/@media \(min-width: 1181px\)[\s\S]*?\.overview-property-view-stage\[data-view='rows'\] \.overview-property-rows[\s\S]*?max-width:\s*1120px/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?grid-template-areas:[\s\S]*?"index identity chevron"[\s\S]*?"\. key key"[\s\S]*?"\. quick quick"/)
  })

  it('does not animate the row-only Overview property stage', () => {
    expect(styles).not.toContain('overview-property-view-in')
    const stageRule = styles.match(/\.overview-property-view-stage\s*\{[\s\S]*?\}/)?.[0] || ''
    expect(stageRule).not.toContain('animation:')
  })

  it('keeps reduced-motion treatment for Rows', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('.overview-property-row-shell')
  })
})
