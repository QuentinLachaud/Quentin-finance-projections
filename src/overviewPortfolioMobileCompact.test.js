import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dashboard = readFileSync(fileURLToPath(new URL('./OverviewPortfolioDashboard.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const commandCentre = readFileSync(fileURLToPath(new URL('./overviewCommandCentre.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-08-26 20:40 BST — compact phone Portfolio Overview */'
const start = styles.indexOf(marker)
const nextMarker = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
const css = start >= 0 ? styles.slice(start, nextMarker >= 0 ? nextMarker : undefined) : ''

describe('compact phone Portfolio Overview', () => {
  it('keeps the approved four-card architecture and rich drill-down implementation', () => {
    expect(dashboard).toContain("title: 'Monthly Cash Flow'")
    expect(dashboard).toContain("title: 'Portfolio Position'")
    expect(dashboard).toContain("title: 'Portfolio LTV'")
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

  it('shows cash flow above a three-column equity, LTV, buffer row on phones', () => {
    expect(commandCentre).toContain('@media (max-width: 760px)')
    expect(commandCentre).toContain('.overview-summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(commandCentre).toContain('.overview-summary-cashflow { grid-column: 1 / -1')
    expect(commandCentre).toContain('.overview-summary-buffer {')
    expect(commandCentre).toContain('grid-column: span 1')
    expect(commandCentre).toContain('.overview-rent-rail { order: -1')
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

