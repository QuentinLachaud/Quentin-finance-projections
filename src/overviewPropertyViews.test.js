import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Overview selectable property views', () => {
  it('offers Cards, Rows and Mini with native radio semantics', () => {
    expect(app).toContain("['cards', 'Cards']")
    expect(app).toContain("['rows', 'Rows']")
    expect(app).toContain("['mini', 'Mini']")
    expect(app).toContain('role="radiogroup"')
    expect(app).toContain('role="radio"')
  })

  it('defaults first-run phones to collapsed rows and wider screens to cards', () => {
    expect(app).toContain("window.matchMedia?.('(max-width: 680px)').matches ? 'rows' : 'cards'")
    expect(app).toContain('function OverviewPropertyRow')
    expect(app).toContain('const [expanded, setExpanded] = useState(false)')
    expect(app).toContain('aria-expanded={expanded}')
  })

  it('persists the signed-in user view choice', () => {
    expect(app).toContain('btl-overview-property-view:${user.id}')
    expect(app).toContain('window.localStorage.setItem(overviewPropertyViewStorageKey, overviewPropertyView)')
  })

  it('preserves full cards and adds dedicated row and mini renderers', () => {
    expect(app).toContain("overviewPropertyView === 'cards'")
    expect(app).toContain('<PropertyCard key={p.id}')
    expect(app).toContain("overviewPropertyView === 'rows'")
    expect(app).toContain('<OverviewPropertyRow key={p.id}')
    expect(app).toContain("overviewPropertyView === 'mini'")
    expect(app).toContain('<OverviewPropertyMiniCard key={p.id}')
  })

  it('uses a sliding iOS-style selector and smooth disclosure', () => {
    expect(styles).toContain('selectable iOS-native Overview property views')
    expect(styles).toMatch(/\.overview-property-view-selector::before\s*\{[\s\S]*?transition:\s*transform 260ms/)
    expect(styles).toMatch(/\.overview-property-row-shell\s*\{[\s\S]*?grid-template-rows:\s*0fr/)
    expect(styles).toMatch(/\.overview-property-row\.expanded \.overview-property-row-shell\s*\{[\s\S]*?grid-template-rows:\s*1fr/)
  })

  it('uses one-column mini cards on phones and no horizontal scrolling', () => {
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.overview-property-mini-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/)
    const marker = styles.indexOf('/* Brain Drain 2026-08-23 01:02 BST — selectable iOS-native Overview property views */')
    const block = marker >= 0 ? styles.slice(marker) : ''
    expect(block).not.toMatch(/overflow-x:\s*(auto|scroll)/)
  })

  it('respects reduced motion', () => {
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(styles).toContain('.overview-property-row-shell')
  })
})
