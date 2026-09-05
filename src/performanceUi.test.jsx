import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PerformanceWorkspace from './PerformanceWorkspace.jsx'

const property = { id: 'p1', name: 'BTL1', purchaseDate: '2025-01-01', purchasePrice: 200000, latestValuation: 220000, mortgagePrincipalAmount: 150000, loanAmount: 150000, rent: 1000, operatingCashflow: 300, mortgageInterestOnly: true, baseRate: 0.04 }

describe('Performance workspace UI', () => {
  it('puts the decision metrics, auditability and 5/10/15 projection controls ahead of decorative UI', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} expenses={[{ id: 'r1', date: '2025-06-01', property: 'BTL1', amount: 5000, description: 'Rent' }]} settings={{ appreciationRate: 0.03, rentGrowthRate: 0.02, rateShock: 0 }} />)
    expect(html).toContain('ANNUALISED INVESTOR RETURN')
    expect(html).toContain('Wealth created')
    expect(html).toContain('Current equity')
    expect(html).toContain('MOIC')
    expect(html).toContain('How this return is calculated')
    expect(html).toContain('Return')
    expect(html).toContain('Cash flow')
    expect(html).toContain('Value &amp; debt')
    expect(html).toContain('5Y')
    expect(html).toContain('10Y')
    expect(html).toContain('15Y')
    expect(html).toContain('RETURN BREAKDOWN')
    expect(html).toContain('FINANCIAL HISTORY')
    expect(html).toContain('Projection assumptions')
  })

  it('calls out estimated cash basis instead of presenting incomplete history as exact', () => {
    const html = renderToStaticMarkup(<PerformanceWorkspace properties={[property]} settings={{ appreciationRate: 0.03, rentGrowthRate: 0.02 }} />)
    expect(html).toContain('Estimated cash basis')
    expect(html).toContain('No dated income or cost entries are available')
    expect(html).toContain('actual initial cash invested')
  })
})
