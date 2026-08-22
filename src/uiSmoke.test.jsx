import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ExpensesWorkspace from './ExpensesWorkspace.jsx'
import CredentialsWorkspace from './CredentialsWorkspace.jsx'
import RemortgageSimulator from './RemortgageSimulator.jsx'

describe('workspace render smoke tests', () => {
  it('renders the expenses ledger with inferred income and expense rows', () => {
    const html = renderToStaticMarkup(<ExpensesWorkspace
      expenses={[
        { id: 'income', date: '2026-08-01', property: 'BTL1', category: 'rent', amount: 1200, description: 'Rent', recurrence: 'Monthly', notes: '', receiptLink: '' },
        { id: 'expense', date: '2026-08-02', property: 'BTL1', category: 'repair', amount: -250, description: 'Repair', recurrence: '', notes: '', receiptLink: '' },
      ]}
      properties={[{ id: 'one', name: 'BTL1' }]}
      onChange={() => {}}
    />)

    expect(html).toContain('Expenses')
    expect(html).toContain('Income')
    expect(html).toContain('Expense')
    expect(html).toContain('BTL1')
  })

  it('renders a Pro gate for the remortgage simulator on a free account', () => {
    const html = renderToStaticMarkup(<RemortgageSimulator
      properties={[]}
      comparisons={[]}
      onChange={() => {}}
      isPro={false}
      onUpgrade={() => {}}
    />)

    expect(html).toContain('PRO · REMORTGAGE SIMULATOR')
    expect(html).toContain('Unlock with Pro')
    expect(html).not.toContain('Add comparison')
  })

  it('renders the usable empty remortgage workspace for a Pro account', () => {
    const html = renderToStaticMarkup(<RemortgageSimulator
      properties={[{ id: 'one', name: 'BTL1', postcode: 'G1 1AA' }]}
      comparisons={[]}
      onChange={() => {}}
      isPro
      onUpgrade={() => {}}
    />)

    expect(html).toContain('Remortgage Simulator')
    expect(html).toContain('Choose a property')
    expect(html).toContain('Add comparison')
    expect(html).toContain('BTL1')
    expect(html).toContain('Manual values')
  })

  it('renders saved remortgage comparisons as compact summary rows', () => {
    const comparison = {
      id: 'comparison-1',
      sourcePropertyId: 'one',
      name: 'BTL1 option',
      left: { propertyValue: 250000, loanAmount: 175000, ltv: 70, loanBasis: 'loan', rate: 5, feeMode: 'percent', feeValue: 0, addFeeToLoan: false },
      right: { propertyValue: 250000, loanAmount: 175000, ltv: 70, loanBasis: 'loan', rate: 4.5, feeMode: 'percent', feeValue: 0, addFeeToLoan: false },
    }
    const property = {
      id: 'one',
      name: 'BTL1',
      postcode: 'G1 1AA',
      rent: 1500,
      fixedCosts: 750,
      monthlyPayment: 625,
      variableCosts: 100,
    }

    const html = renderToStaticMarkup(<RemortgageSimulator
      properties={[property]}
      comparisons={[comparison]}
      onChange={() => {}}
      isPro
      onUpgrade={() => {}}
    />)

    expect(html).toContain('Current mortgage cost')
    expect(html).toContain('New mortgage cost')
    expect(html).toContain('5.00% rate')
    expect(html).toContain('4.50% rate')
    expect(html).toContain('True cash flow')
    expect(html).toContain('True cash-flow difference')
  })
  it('renders the IDs & Credentials workspace with masked values and archive controls', () => {
    const html = renderToStaticMarkup(<CredentialsWorkspace
      credentials={[
        {
          id: 'one',
          label: 'Gateway ID',
          value: '123456789',
          notes: 'HMRC',
          sensitive: true,
          archived: false,
        },
        {
          id: 'two',
          label: 'Old code',
          value: 'ABC',
          notes: '',
          sensitive: true,
          archived: true,
        },
      ]}
      onChange={() => {}}
    />)

    expect(html).toContain('IDs &amp; Credentials')
    expect(html).toContain('Gateway ID')
    expect(html).toContain('Archived items')
    expect(html).toContain('type="password"')
    expect(html).toContain('Drag to reorder')
  })
})
