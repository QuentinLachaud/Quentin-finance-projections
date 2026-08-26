import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-08-26 14:16 BST — compact iOS-native property financing */'
const start = styles.indexOf(marker)
const next = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
const block = start >= 0 ? styles.slice(start, next >= 0 ? next : undefined) : ''

describe('compact iOS-native Row financing detail', () => {
  it('preserves the shared financing semantics for the Row drill-down', () => {
    expect(app).toContain('function PropertyFinancingSummary')
    expect(app).toContain('<small>Value</small>')
    expect(app).toContain('<small>Loan</small>')
    expect(app).toContain('<small>Equity</small>')
    expect(app).toContain('<b>{percent(ltv, 1)} LTV</b>')
    expect(app).toContain('style={{ width: `${ltv * 100}%` }}')
    expect(app).toContain('<PropertyFinancingSummary property={property} variant="row" />')
  })

  it('keeps Apple-native typography and hides redundant in-bar LTV text', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif')
    expect(block).toContain('font-variant-numeric: tabular-nums lining-nums')
    expect(block).toMatch(/\.property-financing \.asset-ltv-label\s*\{[\s\S]*?display:\s*none/)
  })

  it('keeps the detailed Row bar thin and compact', () => {
    expect(block).toMatch(/\.property-financing-row \.property-financing-track\s*\{[\s\S]*?height:\s*9px !important/)
    expect(block).toMatch(/\.property-financing-track\s*\{[\s\S]*?border-radius:\s*999px/)
    expect(block).toMatch(/\.property-financing-heading\s*\{[\s\S]*?margin-bottom:\s*6px/)
    expect(block).toMatch(/\.property-financing-row \.property-financing-numbers\s*\{[\s\S]*?margin-top:\s*6px/)
  })
})
