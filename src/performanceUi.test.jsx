import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PerformanceWorkspace from './PerformanceWorkspace.jsx'

const property = {
  id: 'p1', name: 'BTL1', active: true, latestValuation: 220000, purchasePrice: 200000,
  loanAmount: 150000, rent: 1100, mortgageInterestOnly: true, mortgageTermMonths: 300,
  baseRate: 0.04, repairs: 65, factorsFees: 0, legionella: 0, gasCertificate: 0, eicr: 0,
}
const settings = {
  accountType: 'company', appreciationRate: 0.03, rentGrowthRate: 0.02, rateShock: 0,
  companyCosts: [], extractions: [], fullyManaged: false,
  performanceUpdates: [{ id: 'rent-1', kind: 'rent', propertyId: 'p1', value: 1200, startMonth: '2026-01', endMonth: '', order: 0 }],
}

describe('Performance v2 UI', () => {
  it('renders the default portfolio conservative forward model with high-value controls', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} settings={settings} onAssumptionChange={() => {}} />)
    for (const text of ['Forward model', 'Performance', 'Whole portfolio', 'Conservative', 'No voids', 'No repairs/voids', '10Y', 'Portfolio value', 'Equity', 'Monthly cash flow', 'Cash accumulated', 'Exclude extractions', 'Shows true company cash flow']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('aria-label="Forward performance chart"')
    expect(html).toContain('data-testid="performance-chart-scroll"')
  })

  it('renders scoped model inputs and the tagged update ledger without redundant historical dashboard copy', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} settings={settings} onAssumptionChange={() => {}} />)
    for (const text of ['Model inputs', 'Portfolio assumptions', 'Rent growth', 'HPI / appreciation', 'Rate shock', 'Additive to current mortgage rate', 'Shock starts', 'Recorded inputs', 'Rent &amp; valuation updates', 'Rent', 'Valuation', 'Add update', '£1,200 / month']) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('Investment snapshot')
    expect(html).not.toContain('Return breakdown')
    expect(html).not.toContain('Financial history')
  })
})
