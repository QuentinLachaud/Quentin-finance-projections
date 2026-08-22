import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

const marker = '/* Brain Drain 2026-08-23 00:40 BST — iOS-native collapsed remortgage cards */'
const start = styles.indexOf(marker)
const redesign = start >= 0 ? styles.slice(start) : ''

describe('Remortgage collapsed cards on phone and iPad', () => {
  it('replaces the prior 00:30 collapsed-card treatment', () => {
    expect(styles).not.toContain('00:30 BST — mobile-native collapsed remortgage summaries')
    expect(start).toBeGreaterThanOrEqual(0)
  })

  it('keeps all new responsive styling scoped to collapsed comparisons', () => {
    expect(redesign).not.toContain('.remortgage-comparison.expanded')
    expect(redesign).not.toContain('.remortgage-comparison-grid')
    expect(redesign).not.toContain('.remortgage-scenario-card')
    expect(redesign).not.toContain('.remortgage-difference-card')
  })

  it('uses the compact summary on iPad/tablet widths instead of the squeezed desktop row', () => {
    expect(redesign).toContain('(min-width: 681px) and (max-width: 1024px)')
    expect(redesign).toContain('(max-width: 1194px) and (hover: none) and (pointer: coarse)')
    expect(redesign).toMatch(
      /\.remortgage-comparison\.collapsed \.remortgage-summary-mobile\s*\{[\s\S]*?display:\s*grid/
    )
    expect(redesign).toMatch(
      /\.remortgage-comparison\.collapsed \.remortgage-summary-main > \.remortgage-summary-name,[\s\S]*?display:\s*none/
    )
  })

  it('uses one real arrow and suppresses the duplicate pseudo arrow', () => {
    expect(redesign).toMatch(
      /\.remortgage-comparison\.collapsed \.remortgage-summary-mobile-rates::before\s*\{[\s\S]*?content:\s*none !important/
    )
    expect(redesign).toMatch(
      /\.remortgage-comparison\.collapsed \.remortgage-summary-mobile-rates > svg\s*\{[\s\S]*?grid-column:\s*2/
    )
  })

  it('gives phone cards a flat iOS-style hierarchy without an inner boxed rates panel', () => {
    expect(redesign).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.remortgage-comparison\.collapsed \.remortgage-summary-mobile-rates\s*\{[\s\S]*?border-top:\s*1px solid/
    )
    expect(redesign).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.remortgage-comparison\.collapsed \.remortgage-summary-mobile-rates\s*\{[\s\S]*?border-radius:\s*0/
    )
    expect(redesign).not.toMatch(/overflow-x:\s*(auto|scroll)/)
  })

  it('keeps touch utility controls secondary but usable', () => {
    expect(redesign).toMatch(
      /\.remortgage-comparison\.collapsed \.remortgage-summary-actions \.icon-button\s*\{[\s\S]*?width:\s*35px[\s\S]*?height:\s*35px/
    )
  })
})
