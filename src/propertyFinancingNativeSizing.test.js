import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const app = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-09-16 20:58 BST — decision-useful Overview property financing */'
const start = styles.indexOf(marker)
const block = start >= 0 ? styles.slice(start) : ''

describe('decision-useful iOS-native Row financing detail', () => {
  it('uses the existing calculated financing values and 75% model reference', () => {
    expect(app).toContain('function PropertyFinancingSummary')
    expect(app).toContain("const referenceLtv = 0.75")
    expect(app).toContain("const referenceGap = hasValue ? (value * referenceLtv) - loan : 0")
    expect(app).toContain('<small>Loan</small>')
    expect(app).toContain('<small>Equity</small>')
    expect(app).toContain("referenceGap >= 0 ? '75% headroom' : 'Repay to 75%'")
    expect(app).toContain('<PropertyFinancingSummary property={property} variant="row" />')
  })

  it('keeps Apple-native typography and tabular finance numerals', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif')
    expect(block).toContain('font-variant-numeric: tabular-nums lining-nums')
  })

  it('keeps the LTV track compact while adding readable reference context', () => {
    expect(block).toMatch(/\.property-financing-row \.property-financing-track\s*\{[\s\S]*?height:\s*9px !important/)
    expect(block).toContain('.property-financing-threshold')
    expect(block).toContain('.property-financing-threshold.reference')
    expect(block).toContain('.property-financing-current-marker')
    expect(block).toContain('.property-financing-scale')
  })

  it('uses grouped cells instead of floating dashboard tiles', () => {
    expect(block).toMatch(/\.property-financing-row \.property-financing-numbers\s*\{[\s\S]*?border-radius:\s*14px/)
    expect(block).toMatch(/\.overview-property-row-finance-facts\s*\{[\s\S]*?border-radius:\s*14px/)
    expect(block).toContain(".property-financing-scale > span[data-band='70']")
    expect(block).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
  })
})
