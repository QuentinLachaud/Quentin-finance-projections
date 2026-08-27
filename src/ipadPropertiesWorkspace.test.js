import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('iPad Properties comparison workspace', () => {
  const marker = '/* Brain Drain 2026-08-24 07:21 BST — iPad-native Properties comparison workspace */'
  const start = styles.indexOf(marker)
  const nextMarker = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
  const block = start >= 0 ? styles.slice(start, nextMarker >= 0 ? nextMarker : styles.length) : ''

  it('uses a clear tablet toolbar structure and copy', () => {
    expect(app).toContain('className="properties-toolbar-copy"')
    expect(app).toContain('PROPERTY COMPARISON')
    expect(app).toContain('Compare properties')
    expect(app).toContain('Review key BTL details side by side. Use Advanced for projected and specialist metrics.')
    expect(app).toContain('className="properties-search"')
    expect(app).toContain('properties-new-button')
  })

  it('adds controlled comparison columns and metric metadata', () => {
    expect(app).toContain('className="data-table property-comparison-table"')
    expect(app).toContain("'--property-count': Math.max(filtered.length, 1)")
    expect(app).toContain('className="property-metric-column"')
    expect(app).toContain('className="property-value-column"')
    expect(app).toContain('data-metric={label}')
    expect(app).toContain('data-kind={kind}')
  })

  it('scopes the redesign to tablet widths', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('@media (min-width: 721px) and (max-width: 1180px)')
    expect(block).not.toContain('@media (max-width: 720px)')
  })

  it('prevents iPad native input colour from turning the light search field black', () => {
    expect(block).toMatch(/\.properties-search input\s*\{[\s\S]*?background:\s*transparent !important/)
    expect(block).toContain('-webkit-text-fill-color: var(--ui-text)')
    expect(block).toContain('color-scheme: light')
    expect(block).toContain('color-scheme: dark')
  })

  it('wraps long text rows instead of allowing overlap across property columns', () => {
    expect(block).toContain(".property-comparison-table tbody tr[data-kind='text'] td")
    expect(block).toContain('overflow-wrap: anywhere')
    expect(block).toContain('white-space: normal')
    expect(block).toContain("tr[data-metric='Address']")
  })

  it('gives three properties a compact tablet table while allowing 4+ to scroll', () => {
    expect(block).toContain('min-width: calc(174px + (var(--property-count) * 150px))')
    expect(block).toContain('overflow: auto hidden')
    expect(block).toContain('table-layout: fixed')
  })
})
