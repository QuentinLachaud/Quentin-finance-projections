import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./overviewCommandCentre.css', import.meta.url), 'utf8')
const overviewStart = app.indexOf("{section === 'Overview' && <>")
const overviewEnd = app.indexOf("{section === 'Properties' && <>", overviewStart)
const overview = app.slice(overviewStart, overviewEnd)
const scenarioStart = app.indexOf('function OverviewScenarioStrip(')
const scenarioEnd = app.indexOf('function ScenarioTable(', scenarioStart)
const scenario = app.slice(scenarioStart, scenarioEnd)

describe('Overview screenshot alignment', () => {
  it('labels the same five live property metrics across the full desktop comparison width', () => {
    expect(overview).toContain('className="overview-property-columns"')
    for (const label of ['Property', 'Value', 'LTV', 'Equity', 'Cash flow / mo', 'Next fix']) {
      expect(overview).toContain('>'+label+'</span>')
    }
    expect(overview).toContain('calculated.map((p) => <OverviewPropertyRow')
    expect(css).toContain(".overview-operating-grid .overview-property-view-stage[data-view='rows'] .overview-property-rows")
    expect(css).toContain('max-width: none;')
  })

  it('keeps scenario selection purely presentational and uses existing calculated scenarios', () => {
    expect(scenario).toContain('const [highlightedScenario, setHighlightedScenario] = useState(0)')
    expect(scenario).toContain('aria-label="Highlight cash flow scenario"')
    expect(scenario).toContain('aria-pressed={index === selectedScenario}')
    expect(scenario).toContain('scenarios.map((scenario, index)')
    expect(scenario).toContain('currency(scenario.cashflow)')
    expect(scenario).toContain('<ScenarioTable scenarios={scenarios} count={count} accountType={accountType} variant="overview" />')
    expect(scenario).toContain('onOpenProjections')
    expect(scenario).not.toContain('calculatePortfolio(')
  })

  it('retains the compact phone layout and motion preference', () => {
    expect(css).toContain('.overview-property-columns { display: none; }')
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
