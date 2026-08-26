import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-08-26 14:16 BST — compact iOS-native property financing */'
const start = styles.indexOf(marker)
const block = start >= 0 ? styles.slice(start) : ''

describe('compact iOS-native Overview property financing', () => {
  it('keeps the shared financing semantics in all three property views', () => {
    expect(app).toContain('function PropertyFinancingSummary')
    expect(app).toContain('<small>Value</small>')
    expect(app).toContain('<small>Loan</small>')
    expect(app).toContain('<small>Equity</small>')
    expect(app).toContain('<b>{percent(ltv, 1)} LTV</b>')
    expect(app).toContain('style={{ width: `${ltv * 100}%` }}')
    expect(app).toContain('variant="card"')
    expect(app).toContain('variant="row"')
    expect(app).toContain('variant="mini"')
  })

  it('uses Apple-native typography and hides the redundant in-bar LTV text', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif')
    expect(block).toContain('font-variant-numeric: tabular-nums lining-nums')
    expect(block).toMatch(/\.property-financing \.asset-ltv-label\s*\{[\s\S]*?display:\s*none/)
  })

  it('uses thin progress bars scaled by presentation density', () => {
    expect(block).toMatch(/\.property-financing-card \.property-financing-track\s*\{[\s\S]*?height:\s*10px !important/)
    expect(block).toMatch(/\.property-financing-row \.property-financing-track\s*\{[\s\S]*?height:\s*9px !important/)
    expect(block).toMatch(/\.property-financing-mini \.property-financing-track\s*\{[\s\S]*?height:\s*8px !important/)
    expect(block).toMatch(/\.property-financing-track\s*\{[\s\S]*?border-radius:\s*999px/)
  })

  it('insets expanded iPad rows and uses standard phone grouped-list insets', () => {
    expect(block).toMatch(/\.overview-property-row-inner > \.property-financing-row\s*\{[\s\S]*?padding:\s*10px 58px 11px/)
    expect(block).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.overview-property-row-inner > \.property-financing-row\s*\{[\s\S]*?padding:\s*10px 14px 11px/)
  })

  it('reduces internal whitespace for a compact grouped-cell hierarchy', () => {
    expect(block).toMatch(/\.property-financing-heading\s*\{[\s\S]*?margin-bottom:\s*6px/)
    expect(block).toMatch(/\.property-financing-numbers\s*\{[\s\S]*?margin-top:\s*7px/)
    expect(block).toMatch(/\.property-financing-row \.property-financing-numbers\s*\{[\s\S]*?margin-top:\s*6px/)
    expect(block).toMatch(/\.property-financing-mini\s*\{[\s\S]*?margin-top:\s*9px[\s\S]*?padding-top:\s*8px/)
  })
})

