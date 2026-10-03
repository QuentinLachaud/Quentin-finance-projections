import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoansWorkspace from './LoansWorkspace.jsx'

const source = readFileSync(new URL('./LoansWorkspace.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./loanPropertyCards.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const sorting = readFileSync(new URL('./loanSorting.js', import.meta.url), 'utf8')
const properties = [{ id: 'p1', name: 'BTL1', latestValuation: 260000 }]
const loans = [
  { id: 'a', propertyId: 'p1', lender: 'Paragon', principalAmount: 180000, loanAmount: 180000, rate: .0484, fixedRateMonths: 24, fixedStartDate: '2025-02-28', interestOnly: true },
  { id: 'b', propertyId: 'p1', lender: 'TMW', principalAmount: 20000, loanAmount: 20000, rate: .05, fixedRateMonths: 36, fixedStartDate: '2025-03-01', interestOnly: true },
]

describe('collapsed compact reorderable Loans UX', () => {
  it('starts every BTL group collapsed while retaining individually collapsed loan controls in the DOM', () => {
    const html = renderToStaticMarkup(<LoansWorkspace loans={loans} properties={properties} onSave={() => {}} onDelete={() => {}} onReorder={() => {}} />)
    expect(html).toContain('aria-label="BTL1, 2 loans"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('class="loan-group-body"')
    expect(html).toContain('hidden=""')
    expect(html.match(/class="loan-row /g)).toHaveLength(2)
    expect(html.match(/aria-label="Reorder /g)).toHaveLength(2)
    expect(html.match(/title="Drag to reorder"/g)).toHaveLength(2)
  })

  it('uses simulator-style pointer capture and accessible keyboard reordering without changing associations', () => {
    for (const token of [
      'setPointerCapture?.(event.pointerId)',
      'releasePointerCapture?.(event.pointerId)',
      "event.key === 'ArrowUp'",
      "event.key === 'ArrowDown'",
      'reorderVisibleLoans(loans, group.loans, fromIndex, toIndex)',
      "changeSortOrder('manual')",
    ]) expect(source).toContain(token)
    expect(source).toContain("const collapsed = groupByBtl && !expandedGroups.includes(group.id)")
    expect(source).toContain('hidden={collapsed}')
    expect(sorting).toContain("{ value: 'manual', label: 'Manual order' }")
  })

  it('persists the reordered array through App as a display-only mutation', () => {
    expect(app).toContain('const reorderLoansForDisplay = (orderedLoans) => setState((current) => {')
    expect(app).toContain('return { ...current, loans: orderedLoans }')
    expect(app).toContain('onReorder={reorderLoansForDisplay}')
    const reorderBlock = app.slice(app.indexOf('const reorderLoansForDisplay'), app.indexOf('const saveTenant'))
    expect(reorderBlock).not.toContain('portfolioLoanChangeEvents')
    expect(reorderBlock).not.toContain('propertyTimelineEvents')
  })

  it('keeps mobile group headers horizontal and compresses loan metrics into one five-column strip', () => {
    expect(css).toContain('/* Brain Drain 2026-10-03 14:25 BST — compact collapsed/reorderable loan cards */')
    expect(css).toContain('flex-wrap: nowrap;')
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr));')
    expect(css).toContain('.loan-mobile-amounts,')
    expect(css).toContain('display: contents;')
    expect(css).toContain('touch-action: none;')
    expect(css).toContain('border-color: var(--ui-line-strong);')
    expect(css).not.toContain('!important')
  })
})
