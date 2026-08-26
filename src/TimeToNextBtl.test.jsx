import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import TimeToNextBtl from './TimeToNextBtl.jsx'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

const syntheticProjection = Array.from({ length: 13 }, (_, month) => ({
  month,
  scenarios: [0, 1, 2].map(() => ({ cashPot: 8000 + 5000 * month, cashflow: 6500 * month })),
}))

const renderFeature = () => renderToStaticMarkup(<TimeToNextBtl
  properties={[]}
  settings={{ accountType: 'company', cashHeld: 8000, taxJurisdiction: 'scotland' }}
  portfolio={{ cashHeld: 8000, fixedCosts: 600, variableCosts: 400 }}
  projectionPoints={syntheticProjection}
  now={new Date('2026-01-15T12:00:00')}
  initialTargetPrice={100000}
  initialAssumptions={{ jurisdiction: 'scotland', ltv: 75, adsRate: 0, legalFees: 0, mortgageFee: 0, mortgageFeeAddedToLoan: true }}
/>)

describe('Time to next BTL flagship UI', () => {
  it('renders the flagship controls with canonical scenario language and safe defaults', () => {
    const html = renderFeature()
    for (const text of ['Time to next BTL','BTL price today','Conservative','Full occupancy','Maximum cash','Preserve 6-month buffer','Include extraction','BTL appreciation','Starting surplus cash','Purchase assumptions']) expect(html).toContain(text)
    expect(html).toContain('Available above your 6-month buffer')
    expect(html).toContain('aria-label="Preserve 6-month buffer" type="checkbox" checked=""')
  })

  it('renders the deterministic known crossing and an accessible non-hover summary', () => {
    const html = renderFeature()
    expect(html).toContain('5 months')
    expect(html).toContain('June 2026')
    expect(html).toContain('BTL buying power compared with target BTL price over time')
    expect(html).toContain('Purchase-ready in 5 months')
    for (const className of ['next-btl-buying-path','next-btl-target-path','next-btl-cross-dot','next-btl-cross-guide']) expect(html).toContain(className)
  })

  it('integrates directly after accumulation and before Portfolio assumptions', () => {
    expect(app).toContain("import TimeToNextBtl from './TimeToNextBtl.jsx'")
    const projection = app.indexOf('<ProjectionExplorer properties={includedProperties}')
    const timeToBtl = app.indexOf('<TimeToNextBtl', projection)
    const assumptions = app.indexOf('<section className="panel assumptions-panel">', projection)
    expect(projection).toBeGreaterThan(-1)
    expect(timeToBtl).toBeGreaterThan(projection)
    expect(assumptions).toBeGreaterThan(timeToBtl)
  })

  it('has explicit desktop/iPad split, phone stacking and reduced-motion final-state CSS', () => {
    expect(styles).toContain('Time to next BTL flagship')
    expect(styles).toMatch(/@media \(min-width: 761px\)[\s\S]*?\.next-btl-layout\s*\{[\s\S]*?34%[\s\S]*?66%/)
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.next-btl-layout\s*\{[\s\S]*?grid-template-columns:\s*1fr/)
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?stroke-dashoffset:\s*0 !important/)
    expect(styles).toContain('next-btl-path-draw 1.95s')
    expect(styles).toContain('next-btl-intersection-pulse')
  })
})
