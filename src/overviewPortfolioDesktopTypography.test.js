import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-08-26 20:42 BST — desktop Portfolio Overview typography */'
const start = styles.indexOf(marker)
const block = start >= 0 ? styles.slice(start) : ''

describe('desktop Portfolio Overview typography', () => {
  it('exists as a desktop-only override', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('@media (min-width: 1181px)')
    expect(block).not.toContain('@media (max-width: 1180px)')
    expect(block).not.toContain('@media (max-width: 760px)')
  })

  it('raises summary card type one readable desktop step', () => {
    expect(block).toMatch(/\.overview-summary-title > b\s*\{[\s\S]*?font-size:\s*14px/)
    expect(block).toMatch(/\.overview-summary-title > strong\s*\{[\s\S]*?font-size:\s*34px/)
    expect(block).toMatch(/\.overview-summary-title > small\s*\{[\s\S]*?font-size:\s*12px/)
    expect(block).toMatch(/\.overview-summary-rows span\s*\{[\s\S]*?font-size:\s*12px/)
    expect(block).toMatch(/\.overview-summary-rows b\s*\{[\s\S]*?font-size:\s*13px/)
    expect(block).toMatch(/\.overview-summary-rows > div\s*\{[\s\S]*?min-height:\s*32px/)
  })

  it('raises insight-sheet typography proportionally on desktop', () => {
    expect(block).toMatch(/\.overview-insight-sheet-head h2\s*\{[\s\S]*?font-size:\s*23px/)
    expect(block).toMatch(/\.overview-insight-value > strong\s*\{[\s\S]*?font-size:\s*34px/)
    expect(block).toMatch(/\.overview-insight-explainer\s*\{[\s\S]*?font-size:\s*13px/)
    expect(block).toContain('.overview-insight-ledger-row > span > b')
    expect(block).toContain('.overview-insight-property-list > div > span:first-child > b')
  })

  it('preserves the existing iOS-native dashboard and phone refinement markers', () => {
    expect(styles).toContain('iOS-native Portfolio Overview dashboard')
    // The phone refinement may already be applied when this task runs; if it is, it must remain untouched.
    if (styles.includes('compact phone Portfolio Overview')) {
      expect(styles).toContain('@media (max-width: 760px)')
    }
  })
})

