import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const marker = '/* Brain Drain 2026-08-26 22:02 BST — purpose-built Overview property views */'
const start = styles.indexOf(marker)
const next = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
const css = start >= 0 ? styles.slice(start, next >= 0 ? next : undefined) : ''
const componentStart = app.indexOf('function OverviewPropertyActionMenu(')
const componentEnd = app.indexOf('const overviewPropertyViewOptions', componentStart)
const properties = componentStart >= 0 && componentEnd >= 0 ? app.slice(componentStart, componentEnd) : ''

describe('purpose-built Overview property views', () => {
  it('keeps Cards, Rows and Mini with native radio semantics and makes Rows the v2 default everywhere', () => {
    expect(app).toContain("['cards', 'Cards']")
    expect(app).toContain("['rows', 'Rows']")
    expect(app).toContain("['mini', 'Mini']")
    expect(app).toContain('role="radiogroup"')
    expect(app).toContain('role="radio"')
    expect(app).toContain('btl-overview-property-view-v2:${user.id}')
    expect(app).toContain("return 'rows'")
    expect(app).not.toContain("window.matchMedia?.('(max-width: 680px)').matches ? 'rows' : 'cards'")
    expect(app).toContain('window.localStorage.setItem(overviewPropertyViewStorageKey, overviewPropertyView)')
  })

  it('uses Rows as a compact comparison surface before the financing drill-down', () => {
    const row = properties.slice(properties.indexOf('function OverviewPropertyRow('), properties.indexOf('function OverviewPropertyMiniCard('))
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

  it('makes Cards a concise visual mode rather than a verbose financing duplicate', () => {
    const card = properties.slice(properties.indexOf('function PropertyCard('), properties.indexOf('function OverviewPropertyRow('))
    expect(card).toContain('Open ${property.name} property details')
    expect(card).toContain('<OverviewLtvBar property={property} />')
    expect(card).toContain('label="Equity"')
    expect(card).toContain('label="Rent / mo"')
    expect(card).toContain('label="Net yield"')
    expect(card).toContain('label="Mortgage / mo"')
    expect(card).not.toContain('PropertyFinancingSummary')
  })

  it('makes Mini a pure Value/LTV/Rent/Yield comparison view', () => {
    const mini = properties.slice(properties.indexOf('function OverviewPropertyMiniCard('))
    expect(mini).toContain('overview-property-mini-value')
    expect(mini).toContain('label="LTV"')
    expect(mini).toContain('label="Rent / mo"')
    expect(mini).toContain('label="Net yield"')
    expect(mini).not.toContain('PropertyFinancingSummary')
    expect(mini).not.toContain('Mortgage / mo')
  })

  it('moves management into one accessible overflow menu and removes Map from this Overview block', () => {
    expect(properties).toContain('aria-haspopup="menu"')
    expect(properties).toContain('aria-expanded={open}')
    expect(properties).toContain('role="menu"')
    expect(properties).toContain('role="menuitem"')
    expect(properties).toContain('<span>Edit</span>')
    expect(properties).toContain('<span>Duplicate</span>')
    expect(properties).toContain("'Exclude from totals' : 'Include in totals'")
    expect(properties).toContain("event.key !== 'Escape'")
    expect(properties).toContain("document.addEventListener('pointerdown', handlePointerDown)")
    expect(properties).not.toContain('MapPin')
    expect(properties).not.toContain('<span>Map</span>')
  })

  it('uses deliberate desktop width caps and phone-specific hierarchy', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(css).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif')
    expect(css).toMatch(/@media \(min-width: 1181px\)[\s\S]*?max-width:\s*1120px[\s\S]*?max-width:\s*1180px[\s\S]*?max-width:\s*1050px/)
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?grid-template-areas:[\s\S]*?"index identity chevron"[\s\S]*?"\. key key"[\s\S]*?"\. quick quick"/)
  })

  it('allows horizontal swipe only for the explicit phone Mini comparison rail', () => {
    const phone = css.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(phone).toContain(".overview-property-view-stage[data-view='mini'] .overview-property-mini-grid")
    expect(phone).toContain('grid-auto-flow: column')
    expect(phone).toContain('overflow-x: auto')
    expect(phone).toContain('scroll-snap-type: x mandatory')
    expect(css.match(/overflow-x:\s*auto/g)?.length).toBe(1)
  })

  it('keeps reduced-motion treatment', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('.overview-property-row-shell')
  })
})
