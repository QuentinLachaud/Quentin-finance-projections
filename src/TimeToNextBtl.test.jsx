import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import TimeToNextBtl from './TimeToNextBtl.jsx'
import AcquisitionSimulator from './AcquisitionSimulator.jsx'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const acquisitionSimulator = readFileSync(new URL('./AcquisitionSimulator.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

const syntheticProjection = Array.from({ length: 13 }, (_, month) => ({
  month,
  scenarios: [0, 1, 2].map(() => ({ cashPot: 8000 + 5000 * month, cashflow: 6500 * month })),
}))

const baseProps = {
  properties: [],
  settings: { accountType: 'company', cashHeld: 8000, taxJurisdiction: 'scotland' },
  portfolio: { cashHeld: 8000, fixedCosts: 600, variableCosts: 400 },
  projectionPoints: syntheticProjection,
  now: new Date('2026-01-15T12:00:00'),
}

const renderManualFeature = () => renderToStaticMarkup(<TimeToNextBtl
  {...baseProps}
  initialTargetPrice={100000}
  initialAssumptions={{ jurisdiction: 'scotland', ltv: 75, adsRate: 0, legalFees: 0, mortgageFee: 0, mortgageFeeAddedToLoan: true }}
/>)

describe('Time to next BTL flagship UI', () => {
  it('renders manual and saved target-source choices while retaining the canonical assumptions', () => {
    const html = renderManualFeature()
    for (const text of ['Time to next BTL','Target BTL','Manual price','Saved acquisition','BTL price today','Conservative','Full occupancy','Maximum cash','Preserve 6-month buffer','Include extraction','BTL appreciation','Starting surplus cash','Purchase assumptions']) expect(html).toContain(text)
    expect(html).toContain('Available above your 6-month buffer')
    expect(html).toContain('aria-label="Preserve 6-month buffer" type="checkbox" checked=""')
  })

  it('defaults to a valid saved acquisition and links both price and purchase assumptions to the card', () => {
    const html = renderToStaticMarkup(<TimeToNextBtl
      {...baseProps}
      acquisitions={[
        { id:'btl3', name:'BTL3', purchasePrice:180000, jurisdiction:'scotland', ltv:70, adsRate:8, legalFees:1900, mortgageFee:1200, mortgageFeeAddedToLoan:true },
        { id:'btl4', name:'BTL4', purchasePrice:220000, jurisdiction:'scotland', ltv:75, adsRate:8, legalFees:1500, mortgageFee:0, mortgageFeeAddedToLoan:true },
      ]}
    />)
    expect(html).toContain('aria-label="Saved acquisition target"')
    expect(html).toContain('BTL3 · £180,000')
    expect(html).toContain('BTL4 · £220,000')
    expect(html).toContain('Price and funding assumptions stay linked to the selected acquisition card.')
    expect(html).toContain('Purchase assumptions · linked')
    expect(html).toContain('70% LTV · Scotland · 8% ADS · £1,900 legal · fee financed')
    expect(html).not.toContain('aria-label="BTL price today"')
  })

  it('renders the deterministic known crossing and an accessible non-hover summary', () => {
    const html = renderManualFeature()
    expect(html).toContain('5 months')
    expect(html).toContain('June 2026')
    expect(html).toContain('BTL buying power compared with target BTL price over time')
    expect(html).toContain('Purchase-ready in 5 months')
    for (const className of ['next-btl-buying-path','next-btl-target-path','next-btl-cross-dot','next-btl-cross-guide']) expect(html).toContain(className)
  })

  it('renders as one coherent acquisition-planning workspace with the forecast before saved cards', () => {
    const html = renderToStaticMarkup(<AcquisitionSimulator
      acquisitions={[{ id:'btl3', name:'BTL3', purchasePrice:180000, expectedMonthlyRent:1200, jurisdiction:'scotland', ltv:75, adsRate:8, legalFees:1500, mortgageFee:0, mortgageFeeAddedToLoan:true }]}
      onChange={() => {}}
      defaultJurisdiction="scotland"
      existingPropertyCount={2}
      properties={[]}
      settings={{ accountType:'company', cashHeld:12000, taxJurisdiction:'scotland', projectionMonths:60 }}
      portfolio={{ cashHeld:12000, fixedCosts:600, variableCosts:400 }}
    />)
    expect(html).toContain('acquisition-planning-workspace')
    expect(html).toContain('Time to next BTL')
    expect(html).toContain('Potential acquisitions')
    expect(html).toContain('aria-label="Saved acquisition target"')
    expect(html.indexOf('Time to next BTL')).toBeLessThan(html.indexOf('Potential acquisitions'))
    expect(html).toContain('BTL3')
  })

  it('lives inside Acquisition Simulator and is absent from the Projections composition', () => {
    expect(app).not.toContain("import TimeToNextBtl from './TimeToNextBtl.jsx'")
    const projections = app.indexOf("{section === 'Projections'")
    const acquisition = app.indexOf("{section === 'Acquisition Simulator'")
    expect(app.slice(projections, acquisition)).not.toContain('<TimeToNextBtl')
    expect(acquisitionSimulator).toContain("import TimeToNextBtl from './TimeToNextBtl.jsx'")
    const planner = acquisitionSimulator.indexOf('<TimeToNextBtl')
    const library = acquisitionSimulator.indexOf('className="acq-library-section"')
    expect(planner).toBeGreaterThan(-1)
    expect(library).toBeGreaterThan(planner)
    for (const prop of ['properties={properties}','settings={settings}','portfolio={portfolio}','acquisitions={acquisitions}']) expect(acquisitionSimulator).toContain(prop)
  })

  it('has explicit cross-device planning layout and reduced-motion final-state CSS', () => {
    expect(styles).toContain('Time to next BTL flagship')
    expect(styles).toContain('acquisition planning workspace')
    expect(styles).toMatch(/@media \(min-width: 761px\)[\s\S]*?\.next-btl-layout\s*\{[\s\S]*?34%[\s\S]*?66%/)
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.next-btl-layout\s*\{[\s\S]*?grid-template-columns:\s*1fr/)
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.acq-library-heading/)
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?stroke-dashoffset:\s*0 !important/)
    expect(styles).toContain('next-btl-path-draw 1.95s')
  })
})
