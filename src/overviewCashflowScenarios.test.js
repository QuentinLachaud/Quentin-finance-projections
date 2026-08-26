import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Overview iOS-native cash-flow scenarios', () => {
  it('uses an Overview-only ScenarioTable variant and leaves Projections on the default table', () => {
    expect(app).toContain("function ScenarioTable({ scenarios, count, accountType = 'company', variant = 'default' })")
    expect(app).toContain("if (variant === 'overview')")
    expect(app).toContain('variant="overview"')
    expect(app).toContain('<ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} accountType={state.settings.accountType} />')
  })

  it('uses clearer operating-assumption copy', () => {
    expect(app).toContain("Voids + repair reserve included")
    expect(app).toContain("No void allowance · repair reserve included")
    expect(app).toContain("No voids · no repair reserve")
    expect(app).not.toContain("Unrealistic maximum")
  })

  it('makes monthly and annual cash flow explicit and explains total gain', () => {
    expect(app).toContain("const monthlyLabel = isPrivate ? 'Net cash flow' : 'Company + extraction cash'")
    expect(app).toContain("'Before personal tax on extraction'")
    expect(app).toContain("'After estimated income tax'")
    expect(app).toContain('<span>Annual cash flow</span>')
    expect(app).toContain('<small>Cash flow + appreciation</small>')
  })

  it('uses iOS-native typography and tabular financial numerals', () => {
    expect(styles).toContain('iOS-native Overview cash-flow scenarios')
    expect(styles).toContain('BlinkMacSystemFont')
    expect(styles).toMatch(/\.overview-cashflow-hero-number strong\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums lining-nums/)
    expect(styles).toMatch(/\.overview-cashflow-hero-number strong\s*\{[\s\S]*?font:\s*720 clamp\(28px/)
  })

  it('has a phone-native selector/card layout with no horizontal scrolling', () => {
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.overview-cashflow-selector\s*\{[\s\S]*?width:\s*100%/)
    expect(styles).toContain('data-mobile-scenario="0"')
    const marker = styles.indexOf('/* Brain Drain 2026-08-23 14:51 BST — iOS-native Overview cash-flow scenarios */')
    const nextMarker = marker >= 0 ? styles.indexOf('/* Brain Drain ', marker + 1) : -1
    const block = marker >= 0 ? styles.slice(marker, nextMarker >= 0 ? nextMarker : undefined) : ''
    expect(block).not.toMatch(/overflow-x:\s*(auto|scroll)/)
  })

  it('respects reduced motion and dark mode', () => {
    expect(styles).toContain(":root[data-theme='dark'] .overview-cashflow-card")
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
