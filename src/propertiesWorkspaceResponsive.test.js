import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('responsive Properties decision workspace', () => {
  const marker = '/* Brain Drain 2026-08-28 15:52 BST — responsive Properties decision workspace */'
  const start = styles.indexOf(marker)
  const block = start >= 0 ? styles.slice(start) : ''

  it('promotes decision metrics into Essentials', () => {
    for (const label of [
      'Current value',
      'Loan balance',
      'Equity',
      'Current LTV',
      'Monthly rent',
      'Operating cash flow / month',
      'Net yield',
      'Actual interest rate',
      'Current lender',
      'Next remortgage',
    ]) expect(app).toContain(`['${label}'`)

    expect(app).toContain("{ title: 'Finance & performance'")
    expect(app).toContain("{ title: 'Property details'")
    expect(app).toContain("{ title: 'Compliance & timing'")
  })

  it('keeps semantic Essentials and Full details controls on larger screens', () => {
    expect(app).toContain("aria-pressed={!advancedPropertyView}")
    expect(app).toContain("aria-pressed={advancedPropertyView}")
    expect(app).toContain('Essentials')
    expect(app).toContain('Full details')
  })

  it('renders one desktop/tablet comparison surface with contextual property headers', () => {
    expect(app).toContain('property-comparison-surface')
    expect(app).toContain('property-section-row')
    expect(app).toContain('property-comparison-header-title')
    expect(app).toContain('property-comparison-header-value')
    expect(app).toContain('<OverviewLtvBar property={property} compact />')
  })

  it('renders the mobile property snapshot before compact detail disclosures', () => {
    expect(app).toContain('mobile-property-tabs-sticky')
    expect(app).toContain('mobile-property-snapshot')
    expect(app).toContain('Current value')
    expect(app).toContain('Cash flow / mo')
    expect(app).toContain('Net yield')
    expect(app).toContain('Next remortgage')
    expect(app).toContain("advancedPropertyView ? 'Show essentials only' : 'Show full details'")
    expect(app).toContain('mobile-property-details')
  })

  it('uses sticky comparison context on large screens and phone-first layout below 721px', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('.property-comparison-table thead th')
    expect(block).toContain('top: 68px')
    expect(block).toContain('.property-comparison-table tbody tr:not(.property-section-row) > th')
    expect(block).toContain('left: 0')
    expect(block).toContain('@media (max-width: 720px)')
    expect(block).toContain('.property-comparison-surface { display: none; }')
    expect(block).toContain('.properties-search { display: none; }')
    expect(block).toContain('.mobile-property-tabs-sticky')
  })

  it('prevents the desktop comparison from inheriting the generic viewport height cap', () => {
    const fixMarker = '/* Brain Drain 2026-08-28 16:15 BST — prevent desktop Properties comparison clipping */'
    const fixStart = styles.indexOf(fixMarker)
    const fixBlock = fixStart >= 0 ? styles.slice(fixStart) : ''

    expect(fixStart).toBeGreaterThanOrEqual(0)
    expect(styles).toContain('.data-table-wrap { overflow: auto; max-height: calc(100vh - 230px);')
    expect(fixBlock).toMatch(/@media \(min-width: 721px\)[\s\S]*?\.property-comparison-wrap\s*\{[\s\S]*?max-height:\s*none;/)
    expect(app).toContain('const rows = supportedPropertyRows(group.rows, advancedPropertyView, filtered)')
    expect(app).toContain('supportedPropertyRows(group.rows, advancedPropertyView, mobileProperty ? [mobileProperty] : [])')
    expect(app).toContain('property-comparison-wrap')
  })

  it('uses a clearer section hierarchy and explicit mobile readability floors', () => {
    const uxMarker = '/* Brain Drain 2026-09-19 08:17 BST — simplified Properties controls and readable section hierarchy */'
    const uxStart = styles.indexOf(uxMarker)
    const uxBlock = uxStart >= 0 ? styles.slice(uxStart) : ''

    expect(uxStart).toBeGreaterThanOrEqual(0)
    expect(app).toContain("description: 'Value, leverage, income and return metrics'")
    expect(app).toContain("description: 'Location, specification and purchase context'")
    expect(app).toContain("description: 'Remortgage and statutory safety dates'")
    expect(uxBlock).toMatch(/\.property-section-row b \{[\s\S]*?font-size:\s*15px;/)
    expect(uxBlock).toMatch(/\.mobile-property-details \.property-group-panel h2 \{[\s\S]*?font-size:\s*17px;/)
    expect(uxBlock).toMatch(/\.mobile-property-details \.property-group-panel header p \{[\s\S]*?font-size:\s*12\.5px;/)
    expect(uxBlock).toMatch(/\.mobile-property-details \.mobile-property-row \{[\s\S]*?min-height:\s*54px;/)
    expect(uxBlock).toMatch(/\.mobile-property-details \.mobile-property-row-value strong \{[\s\S]*?font-size:\s*14px;/)
    expect(uxBlock).toContain('.properties-controls-bar { display: none; }')
  })

})
