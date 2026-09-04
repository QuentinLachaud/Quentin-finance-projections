import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LoansWorkspace from './LoansWorkspace.jsx'

const source = readFileSync(new URL('./LoansWorkspace.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('mobile Loans card hierarchy', () => {
  it('keeps the page canvas between the intro panel and loan cards by removing panel from the outer wrapper', () => {
    expect(source).toContain('<section className="loans-workspace">')
    expect(source).toContain('<header className="panel loans-toolbar">')
    expect(source).not.toContain('<section className="panel loans-workspace">')
  })

  const loan = {
    id: 'loan-mobile',
    propertyId: 'btl-1',
    lender: 'Paragon',
    principalAmount: 181538,
    loanAmount: 181538,
    rate: 0.0484,
    fixedRateMonths: 24,
    fixedStartDate: '2025-02-28',
    feeMode: 'amount',
    feeValue: 0,
    addFeeToLoan: false,
    interestOnly: true,
    termMonths: 300,
    ltvBand: 75,
  }
  const property = { id: 'btl-1', name: 'BTL1', latestValuation: 261924 }

  it('renders a dedicated compact mobile summary with all requested metrics', () => {
    const html = renderToStaticMarkup(
      <LoansWorkspace loans={[loan]} properties={[property]} onSave={() => {}} onDelete={() => {}} />
    )
    expect(html).toContain('loan-mobile-summary')
    expect(html).toContain('loan-mobile-amounts')
    expect(html).toContain('loan-mobile-meta')
    expect(html).toContain('Balance')
    expect(html).toContain('£181,538')
    expect(html).toContain('Monthly payment')
    expect(html).toContain('£732')
    expect(html).toContain('4.84%')
    expect(html).toContain('24 mo')
    expect(html).toContain('to 28 Feb 2027')
    expect(html).toContain('69.3%')
    expect(html).toContain('75% band')
  })

  it('keeps the mobile summary separate from the desktop metric cells', () => {
    expect(source).toContain('<span className="loan-mobile-summary">')
    expect(source).toContain('<span className="loan-mobile-amounts">')
    expect(source).toContain('<span className="loan-mobile-meta">')
    expect(source).toContain('<span className="loan-cell"><small>Loan balance</small>')
    expect(styles).toContain('.loan-mobile-summary { display: none; }')
    expect(styles).toContain('@media (max-width: 560px)')
    expect(styles).toContain('.loan-summary-row > .loan-cell')
    expect(styles).toContain('display: none;')
    expect(styles).toContain('.loan-mobile-summary {')
    expect(styles).toContain('display: block;')
  })

  it('matches Properties hierarchy: rounded intro panel followed by separate loan cards', () => {
    const marker = styles.indexOf('/* Brain Drain 2026-09-04 13:23 BST — iOS-style mobile loan cards */')
    expect(marker).toBeGreaterThanOrEqual(0)
    const block = styles.slice(marker)

    const workspaceStart = block.indexOf('.loans-workspace {')
    const toolbarStart = block.indexOf('.loans-toolbar {')
    const listStart = block.indexOf('.loans-list {')
    expect(workspaceStart).toBeGreaterThanOrEqual(0)
    expect(toolbarStart).toBeGreaterThan(workspaceStart)
    expect(listStart).toBeGreaterThan(toolbarStart)

    const workspaceBlock = block.slice(workspaceStart, toolbarStart)
    expect(workspaceBlock).toContain('padding: 0;')
    expect(workspaceBlock).toContain('overflow: visible;')
    expect(workspaceBlock).toContain('border: 0;')
    expect(workspaceBlock).toContain('border-radius: 0;')
    expect(workspaceBlock).toContain('background: transparent;')
    expect(workspaceBlock).toContain('box-shadow: none;')

    const toolbarBlock = block.slice(toolbarStart, listStart)
    expect(toolbarBlock).toContain('margin-bottom: 10px;')
    expect(toolbarBlock).toContain('padding: 15px;')
    expect(toolbarBlock).toContain('border: 1px solid var(--ui-line);')
    expect(toolbarBlock).toContain('border-radius: 11px;')
    expect(toolbarBlock).toContain('background: var(--ui-surface);')
    expect(toolbarBlock).toContain('box-shadow: var(--ui-shadow);')
    expect(toolbarBlock).toContain('.loans-toolbar .primary-button')
    expect(toolbarBlock).toContain('align-self: flex-end;')

    expect(block).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);')
    expect(block).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(block).not.toContain('@media (min-width:')
  })
})
