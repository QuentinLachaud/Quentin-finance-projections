import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const simulator = readFileSync(new URL('./RemortgageSimulator.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('final iOS polish for collapsed remortgage cards', () => {
  const marker = '/* Brain Drain 2026-08-23 18:04 BST — final iOS polish for collapsed remortgage cards */'
  const start = styles.indexOf(marker)
  const nextMarker = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
  const block = start >= 0 ? styles.slice(start, nextMarker >= 0 ? nextMarker : undefined) : ''

  it('uses human-readable cash-flow language', () => {
    expect(simulator).toContain("property ? 'Cash flow change' : 'Mortgage saving'")
    expect(simulator).not.toContain("property ? 'True CF Δ' : 'Saving'")
  })

  it('scopes new polish to collapsed phone/tablet cards only', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('@media (max-width: 680px)')
    expect(block).toContain('(min-width: 681px) and (max-width: 1024px)')
    expect(block).toContain('(max-width: 1194px) and (hover: none) and (pointer: coarse)')
    expect(block).not.toContain('.remortgage-comparison.expanded')
    expect(block).not.toContain('.remortgage-scenario-card')
    expect(block).not.toContain('.remortgage-difference-card')
  })

  it('uses Apple system typography and tabular lining figures', () => {
    expect(block).toContain('BlinkMacSystemFont')
    expect(block).toContain('font-variant-numeric: tabular-nums lining-nums')
    expect(block).toContain('font: 725 23px')
    expect(block).toContain('font: 730 18px')
  })

  it('removes the dashboard-like delta pill and compacts utility chrome', () => {
    expect(block).toMatch(/\.remortgage-summary-mobile-cash\s*\{[\s\S]*?border-radius:\s*0[\s\S]*?background:\s*transparent !important/)
    expect(block).toContain('min-height: 37px')
  })

  it('adds no horizontal scrolling and respects reduced motion', () => {
    expect(block).not.toMatch(/overflow-x:\s*(auto|scroll)/)
    expect(block).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
