import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dashboard = readFileSync(fileURLToPath(new URL('./OverviewPortfolioDashboard.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-08-26 20:40 BST — compact phone Portfolio Overview */'
const start = styles.indexOf(marker)
const css = start >= 0 ? styles.slice(start) : ''

describe('compact phone Portfolio Overview', () => {
  it('keeps the approved four-card architecture and rich drill-down implementation', () => {
    expect(dashboard).toContain("title: 'Monthly Cash Flow'")
    expect(dashboard).toContain("title: 'Portfolio Position'")
    expect(dashboard).toContain("title: 'Financing'")
    expect(dashboard).toContain("title: 'Safety Buffer'")
    expect(dashboard).toContain('<SummaryRows rows={card.rows} />')
    expect(dashboard).toContain('<BufferRing portfolio={portfolio} />')
    expect(dashboard).toContain('<InsightContent insight={activeCard.id} portfolio={portfolio} settings={settings} />')
  })

  it('removes verbose card breakdown rows only at phone widths', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    const phone = css.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(phone).toContain('.overview-summary-card .overview-summary-rows')
    expect(phone).toContain('display: none')
    expect(phone).toContain('.overview-summary-card .overview-summary-buffer-body')
  })

  it('keeps the phone hierarchy of two full-width cards and two compact half-width cards', () => {
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.overview-summary-cashflow,[\s\S]*?\.overview-summary-position\s*\{[\s\S]*?grid-column:\s*1 \/ -1/)
    expect(css).toMatch(/\.overview-summary-card\s*\{[\s\S]*?min-height:\s*76px[\s\S]*?padding:\s*10px 12px/)
    expect(css).toMatch(/\.overview-summary-financing,[\s\S]*?\.overview-summary-buffer\s*\{[\s\S]*?min-height:\s*72px/)
  })

  it('retains title, value, descriptor, icon and info affordance in the phone card', () => {
    expect(dashboard).toContain('<b>{card.title}</b>')
    expect(dashboard).toContain('<strong>{card.value}</strong>')
    expect(dashboard).toContain('<small>{card.subtitle}</small>')
    expect(dashboard).toContain('<Icon size={18} strokeWidth={1.8} />')
    expect(dashboard).toContain('overview-summary-info')
  })

  it('does not alter the existing modal interaction and card morph behaviour', () => {
    expect(dashboard).toContain('if (event.target === event.currentTarget) closeInsight()')
    expect(dashboard).toContain("if (event.key === 'Escape') closeInsight()")
    expect(dashboard).toContain('source?.focus?.({ preventScroll: true })')
    expect(dashboard).toContain('panel.animate([')
    expect(dashboard).toContain('source?.getBoundingClientRect?.() || sourceRectRef.current')
  })

  it('leaves desktop and tablet detail visibility intact by scoping simplification to max-width 760px', () => {
    const beforeMarker = styles.slice(0, start)
    expect(beforeMarker).toContain('iOS-native Portfolio Overview dashboard')
    expect(css.trimStart().startsWith(marker)).toBe(true)
    expect(css).not.toContain('@media (min-width: 761px)')
    expect(css).not.toContain('@media (min-width: 1181px)')
  })
})

