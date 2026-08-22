import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

const marker = '/* Brain Drain 2026-08-23 00:30 BST — mobile-native collapsed remortgage summaries */'
const start = styles.indexOf(marker)
const mobileBlock = start >= 0 ? styles.slice(start) : ''

describe('Remortgage mobile collapsed cards', () => {
  it('removes the previous broad responsive experiment', () => {
    expect(styles).not.toContain('remortgage small-screen card squeeze fix')
  })

  it('installs the new mobile-only collapsed-card treatment', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(mobileBlock).toContain('@media (max-width: 680px)')
    expect(mobileBlock).toContain('.remortgage-comparison.collapsed .remortgage-summary-row')
    expect(mobileBlock).toContain('.remortgage-comparison.collapsed .remortgage-summary-mobile-rates')
  })

  it('does not alter expanded or full comparison-card layout in the new block', () => {
    expect(mobileBlock).not.toContain('.remortgage-comparison.expanded')
    expect(mobileBlock).not.toContain('.remortgage-comparison-grid')
    expect(mobileBlock).not.toContain('.remortgage-scenario-card')
    expect(mobileBlock).not.toContain('.remortgage-difference-card')
  })

  it('uses full-width summary content and a secondary utility row', () => {
    expect(mobileBlock).toMatch(
      /grid-template-areas:\s*[\r\n ]*"summary summary summary"[\r\n ]*"drag utility actions"/
    )
    expect(mobileBlock).toMatch(
      /grid-template-areas:\s*[\r\n ]*"name delta"[\r\n ]*"compare compare"/
    )
  })

  it('uses a symmetric Current-to-New comparison without horizontal scrolling', () => {
    expect(mobileBlock).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\) 22px minmax\(0,\s*1fr\)/
    )
    expect(mobileBlock).not.toMatch(/overflow-x:\s*(auto|scroll)/)
  })
})
