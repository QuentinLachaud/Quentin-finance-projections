import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('iPad Properties comparison workspace', () => {
  const marker = '/* Brain Drain 2026-08-28 15:52 BST — responsive Properties decision workspace */'
  const start = styles.indexOf(marker)
  const block = start >= 0 ? styles.slice(start) : ''

  it('removes the redundant comparison hero while preserving decision controls', () => {
    expect(app).toContain('className="properties-controls-bar"')
    expect(app).not.toContain('className="properties-toolbar-copy"')
    expect(app).not.toContain('PROPERTY COMPARISON')
    expect(app).not.toContain('<h2>Compare properties</h2>')
    expect(app).not.toContain('properties-new-button')
    expect(app).toContain('property-workspace-mode')
    expect(app).toContain('Essentials')
    expect(app).toContain('Full details')
    expect(app).toContain('overview-add-btl-button')
  })

  it('uses one continuous comparison matrix with group divider rows', () => {
    expect(app).toContain('className="panel data-panel property-comparison-surface"')
    expect(app).toContain('className="data-table property-comparison-table"')
    expect(app).toContain('property-section-row')
    expect(app).toContain('property-comparison-header-button')
    expect(app).toContain('<OverviewLtvBar property={property} compact />')
  })

  it('scopes efficient iPad sizing to tablet widths', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('@media (min-width: 721px) and (max-width: 1180px)')
    expect(block).toContain('min-width: calc(174px + (var(--property-count) * 150px))')
    expect(block).toContain('overflow: auto hidden')
  })

  it('keeps long text readable and sticky comparison context visible', () => {
    expect(block).toContain(".property-comparison-table tbody tr[data-kind='text'] td")
    expect(block).toContain('overflow-wrap: anywhere')
    expect(block).toContain('position: sticky')
    expect(block).toContain('.property-comparison-table tbody tr:not(.property-section-row) > th')
  })
})
