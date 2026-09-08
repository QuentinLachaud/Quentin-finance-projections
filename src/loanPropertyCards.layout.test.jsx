import React from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoansWorkspace from './LoansWorkspace.jsx'

const source = (name) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8')
const css = source('./loanPropertyCards.css')
const properties = [
  { id: 'p1', name: 'BTL1', latestValuation: 250000 },
  { id: 'p2', name: 'BTL2', latestValuation: 200000 },
]
const loans = [
  { id: 'one', propertyId: 'p1', lender: 'Paragon', principalAmount: 100000, loanAmount: 100000, rate: .05, fixedStartDate: '2025-01-01', fixedRateMonths: 24, interestOnly: true },
  { id: 'two', propertyId: 'p1', lender: 'TMW', principalAmount: 50000, loanAmount: 50000, rate: .06, fixedStartDate: '2024-01-01', fixedRateMonths: 24, interestOnly: true },
  { id: 'three', propertyId: 'p2', lender: 'Second property', principalAmount: 75000, loanAmount: 75000, rate: .04, interestOnly: true },
  { id: 'four', propertyId: '', lender: 'Unlinked', principalAmount: 20000, loanAmount: 20000, rate: .04, interestOnly: true },
]
const render = () => renderToStaticMarkup(<LoansWorkspace loans={loans} properties={properties} onSave={() => {}} onDelete={() => {}} />)
const groupMarkup = (html, id) => {
  const group = html.match(new RegExp('<section class="loan-property-card" data-loan-group="' + id + '"[^>]*>([\\s\\S]*?)</section>'))
  expect(group).not.toBeNull()
  return group[1]
}
const declarations = (selector) => {
  const start = css.indexOf(selector + ' {')
  expect(start, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start + selector.length + 2, css.indexOf('}', start))
}
const parent = '.loans-workspace .loans-list .loan-property-card'

describe('BTL loan card containment', () => {
  it('renders one enclosing section per BTL, containing all and only its loans', () => {
    const html = render()
    expect(html.match(/class="loan-property-card"/g)).toHaveLength(3)
    const first = groupMarkup(html, 'p1')
    expect(first).toContain('aria-label="BTL1, 2 loans"')
    expect(first).toContain('£150,000')
    expect(first).toContain('£667')
    expect(first).toContain('class="loan-group-body"')
    expect(first).toContain('id="loan-group-p1"')
    expect(first.match(/<article class="loan-row /g)).toHaveLength(2)
    expect(first).toContain('Paragon')
    expect(first).toContain('TMW')
    expect(first).not.toContain('Second property')
    expect(first).not.toContain('Unlinked')
    expect(first.indexOf('<strong>TMW</strong>')).toBeLessThan(first.indexOf('<strong>Paragon</strong>'))
    expect(groupMarkup(html, 'p2')).toContain('Second property')
    expect(groupMarkup(html, 'unlinked')).toContain('Unlinked')
    expect(html.match(/<article class="loan-row /g)).toHaveLength(4)
  })

  it('retains independent, accessible group and loan controls', () => {
    const first = groupMarkup(render(), 'p1')
    expect(first).toContain('aria-controls="loan-group-p1"')
    expect(first).toContain('aria-expanded="true"')
    expect(first.match(/aria-expanded="false"/g)).toHaveLength(2)
    expect(render()).toContain('aria-label="Group loans"')
    expect(render()).toContain('aria-label="Sort loans"')
  })

  it('enforces a real outer surface and inset loan layout instead of sibling cards', () => {
    const outer = declarations(parent)
    expect(outer).toMatch(/display:\s*block;/)
    expect(outer).toMatch(/border:\s*1px solid var\(--ui-line-strong\);/)
    expect(outer).toMatch(/border-radius:\s*14px;/)
    expect(outer).toMatch(/overflow:\s*hidden;/)
    const body = declarations(parent + ' > .loan-group-body')
    expect(body).toMatch(/display:\s*grid;/)
    expect(body).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/)
    expect(body).toMatch(/gap:\s*8px;/)
    expect(body).toMatch(/padding:\s*10px 12px 12px;/)
    expect(body).toMatch(/background:\s*var\(--ui-surface-subtle\);/)
    const rows = declarations(parent + ' .loan-row,\n' + parent + ' .loan-row.expanded')
    expect(rows).toMatch(/margin:\s*0;/)
    expect(rows).toMatch(/border:\s*1px solid var\(--ui-line\);/)
    expect(rows).toMatch(/border-radius:\s*10px;/)
    expect(rows).toMatch(/box-shadow:\s*none;/)
    expect(css).not.toMatch(/\.loan-property-card\s*\{[^}]*display:\s*contents/)
  })

  it('loads the scoped layout after the global theme and preserves responsive rules', () => {
    const main = source('./main.jsx')
    expect(main.indexOf("import './loanPropertyCards.css'")).toBeGreaterThan(main.indexOf("import './theme.css'"))
    expect(source('./LoansWorkspace.jsx')).not.toContain("import './loanPropertyCards.css'")
    expect(css).toContain('@media (max-width: 900px)')
    expect(css).toContain('@media (max-width: 700px)')
    expect(css).toContain('var(--ui-surface)')
    expect(css).toContain('var(--ui-surface-subtle)')
    expect(css).not.toMatch(/!important/)
  })
})
