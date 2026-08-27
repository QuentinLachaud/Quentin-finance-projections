import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import TimeToNextBtl from './TimeToNextBtl.jsx'

const source = readFileSync(new URL('./TimeToNextBtl.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const marker = '/* Brain Drain 2026-08-27 11:27 BST — advanced equity release planner */'
const start = styles.indexOf(marker)
const css = start >= 0 ? styles.slice(start) : ''

const projectionPoints = Array.from({ length: 13 }, (_, month) => ({
  month,
  scenarios: [0, 1, 2].map(() => ({ cashPot: 12000 + month * 1000, cashflow: month * 1000 })),
}))

const renderFeature = () => renderToStaticMarkup(<TimeToNextBtl
  properties={[
    { id:'btl1', name:'BTL1', latestValuation:200000, loanAmount:120000 },
    { id:'btl2', name:'BTL2', latestValuation:100000, loanAmount:75000 },
  ]}
  settings={{ accountType:'company', cashHeld:12000, appreciationRate:.0325, taxJurisdiction:'scotland' }}
  portfolio={{ cashHeld:12000, fixedCosts:600, variableCosts:400 }}
  projectionPoints={projectionPoints}
  now={new Date('2026-08-27T12:00:00')}
  initialTargetPrice={180000}
  initialAssumptions={{ jurisdiction:'scotland', ltv:75, adsRate:8, legalFees:1500, mortgageFee:0, mortgageFeeAddedToLoan:true }}
/>)

describe('advanced potential equity release UI', () => {
  it('renders a collapsed-by-default Advanced disclosure with baseline off', () => {
    const html = renderFeature()
    expect(html).toContain('ADVANCED')
    expect(html).toContain('Potential equity release')
    expect(html).toContain('Optional · no BTLs selected')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('>Off<')
  })

  it('renders each BTL with an off-by-default toggle, a 70% target LTV and current potential feedback', () => {
    const html = renderFeature()
    for (const name of ['BTL1','BTL2']) {
      expect(html).toContain(`aria-label="Include ${name} potential equity release"`)
      expect(html).toContain(`aria-label="${name} target equity release LTV"`)
    }
    expect((html.match(/target equity release LTV/g) || [])).toHaveLength(2)
    expect((html.match(/value="70"/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('Potential now')
    expect(html).toContain('£20,000')
    expect(source).toContain("enabled: false")
  })

  it('explains the hypothetical refinance assumptions and keeps the release metric conditional', () => {
    const html = renderFeature()
    expect(html).toContain('hypothetically refinanced')
    expect(html).toContain('Portfolio assumptions')
    expect(html).toContain('lender eligibility')
    expect(html).toContain('ERCs')
    expect(source).toContain('result.equityReleaseSelectedCount > 0')
    expect(source).toContain('referencePoint.potentialEquityRelease')
    expect(source).toContain('hoverPoint.potentialEquityRelease')
  })

  it('adds compact cross-device styling without introducing a wide advanced table', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    for (const token of ['.next-btl-advanced', '.next-btl-equity-property', '.next-btl-equity-switch', '.next-btl-equity-ltv']) expect(css).toContain(token)
    expect(css).toContain('font-variant-numeric: tabular-nums')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.next-btl-equity-property-head[\s\S]*?grid-template-columns/)
    expect(css).not.toContain('min-width: 900px')
  })
})
