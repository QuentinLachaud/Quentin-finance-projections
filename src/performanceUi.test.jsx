import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PerformanceWorkspace from './PerformanceWorkspace.jsx'

const property = { id: 'p1', name: 'BTL1', purchaseDate: '2025-01-01', purchasePrice: 200000, latestValuation: 220000, mortgagePrincipalAmount: 150000, loanAmount: 150000, rent: 1100, operatingCashflow: 300, mortgageInterestOnly: true, baseRate: 0.04 }

describe('Performance workspace UI', () => {
  it('uses a clear investment snapshot and explicit, toggleable graph controls rather than an ambiguous mixed chart', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} expenses={[{ id: 'r1', date: '2025-06-01', property: 'BTL1', amount: 5000, description: 'Rent' }]} settings={{ appreciationRate: 0.03, rentGrowthRate: 0.02, rateShock: 0 }} />)
    expect(html).toContain('Investment snapshot')
    expect(html).toContain('Annualised return')
    expect(html).toContain('Wealth created')
    expect(html).toContain('Current equity')
    expect(html).toContain('Recorded net income')
    expect(html).toContain('PERFORMANCE OVER TIME')
    expect(html).toContain('Value &amp; debt')
    expect(html).toContain('Rent')
    expect(html).toContain('Cash')
    expect(html).toContain('Return')
    expect(html).toContain('Displayed metrics')
    expect(html).toContain('Equity')
    expect(html).toContain('Property value')
    expect(html).toContain('Mortgage debt')
    expect(html).toContain('Forecast')
    expect(html).toContain('Events')
    expect(html).toContain('5Y')
    expect(html).toContain('10Y')
    expect(html).toContain('15Y')
    expect(html).toContain('Today · Equity')
    expect(html).toContain('Solid lines are recorded history')
  })

  it('keeps incomplete-history caveats visible but secondary and does not present estimated data as exact', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} settings={{ appreciationRate: 0.03, rentGrowthRate: 0.02 }} />)
    expect(html).toContain('Estimated cash basis')
    expect(html).toContain('Data coverage')
    expect(html).toContain('No dated income or cost entries are available')
    expect(html).toContain('does not backfill current assumptions into the past')
  })
})
