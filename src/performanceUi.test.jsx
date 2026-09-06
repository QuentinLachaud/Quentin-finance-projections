import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PerformanceWorkspace from './PerformanceWorkspace.jsx'

const property = {
  id: 'p1', name: 'BTL1', active: true, purchaseDate: '2025-02-28',
  latestValuation: 240000, purchasePrice: 200000, rent: 1200, loanAmount: 150000,
  mortgageInterestOnly: true, mortgageTermMonths: 300, baseRate: 0.04,
}
const settings = {
  accountType: 'company', rentGrowthRate: 0.02, appreciationRate: 0.03, rateShock: 0,
  managementRate: 0, fullyManaged: false, companyCosts: [], extractions: [],
  performanceUpdates: [
    { id: 'rent-1', kind: 'rent', propertyId: 'p1', value: 1200, startMonth: '2025-02', endMonth: '', order: 0 },
  ],
}

describe('Performance history + forecast UI', () => {
  it('renders portfolio conservative defaults with history-aware, banking-aware chart controls', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} settings={settings} onAssumptionChange={() => {}} />)
    for (const text of [
      'History + forecast', 'Performance', 'Whole portfolio', 'Conservative', 'No voids', 'No repairs/voids',
      '10Y', 'Portfolio value', 'Equity', 'Model cash flow', 'Actual bank cash flow', 'Cash accumulated',
      'Exclude extractions', 'Shows true company cash flow',
    ]) {
      expect(html).toContain(text)
    }
    expect(html).toContain('Performance chart from recorded history through the selected forecast horizon')
    expect(html).toContain('Today')
  })

  it('renders larger high-value model/update controls and explains automatic overlap precedence', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} settings={settings} onAssumptionChange={() => {}} />)
    for (const text of [
      'Model inputs', 'Portfolio assumptions', 'Rent growth', 'HPI / appreciation', 'Rate shock',
      'Additive to current mortgage rate', 'Shock starts', 'Recorded inputs', 'Rent &amp; valuation updates',
      'Rent', 'Valuation', 'Add update', 'New dated values take precedence automatically',
    ]) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('This overlaps')
    expect(html).not.toContain('Investment snapshot')
    expect(html).not.toContain('Return breakdown')
  })
})
