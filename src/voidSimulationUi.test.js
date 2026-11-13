import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./voidSimulation.css', import.meta.url), 'utf8')

describe('BTL sidebar simulated-void switch integration', () => {
  it('keeps financial simulations separate from persisted portfolio data and the inclusion toggle', () => {
    expect(app).toContain('const [simulatedVoidPropertyIds, setSimulatedVoidPropertyIds] = useState(() => new Set())')
    expect(app).toContain('applySimulatedVoids(withPropertyLoans(state.properties, state.loans || []), simulatedVoidPropertyIds)')
    expect(app).toContain('const toggleProperty = (id) => setState(')
    expect(app).toContain('const toggleSimulatedVoid = (id) => setSimulatedVoidPropertyIds(')
    expect(app).toContain('onClick={() => toggleSimulatedVoid(p.id)}')
    expect(app).toContain('onChange={() => toggleProperty(p.id)}')
    expect(app).toContain('disabled={!p.active}')
    expect(app).not.toMatch(/setState\([^\n]*simulatedVoid/i)
  })

  it('shows a single circular green pound when rented and a precisely crossed red pound when void', () => {
    expect(app).toContain('className={`property-nav-void ${p.simulatedVoid ? \'is-void\' : \'is-rented\'}`}')
    expect(app).toContain('aria-pressed={Boolean(p.simulatedVoid)}')
    expect(app).toContain('aria-label={`${p.simulatedVoid ? \'Restore rental income for\' : \'Simulate void for\'} ${p.name}`}')
    expect(app).toContain('<PoundSterling size={18} strokeWidth={2.2} aria-hidden="true" />')
    expect(css).toContain('.property-nav-row > button.property-nav-void')
    expect(css).toContain('.property-nav-void.is-rented')
    expect(css).toContain('.property-nav-void.is-void::after')
    expect(css).toContain('min-height: 32px;') // Prevent sidebar min-height making an oval focus halo.
    expect(css).toContain('height: 32px;')
    expect(css).toContain('border: 1px solid currentColor;')
    expect(css).not.toContain('border: 1px solid currentColor;\n  border-radius: 50%;\n  transition:')
    expect(css).toContain('transform: translate(-50%, -50%) rotate(-45deg)')
    expect(css).toContain(':focus-visible')
    expect(app).toContain('retain mortgage and factors, remove rent and other property budgets')
  })

  it('labels all three cashflow cards when every included BTL is void', () => {
    expect(app).toContain('allVoid={portfolio.allPropertiesSimulatedVoid}')
    expect(app).toContain('allVoid={focusedPortfolio.allPropertiesSimulatedVoid}')
    expect(app).toContain("allVoid ? 'All included BTLs are void · no rental income' : copy.note")
    expect(app).toContain('allVoid && <small className="overview-all-void-note">All BTLs void</small>')
    expect(app).toContain('No further estimated void loss is deducted.')
    expect(app).toContain('allVoid={allVoid}')
  })

  it('uses the same model across company and private views, including projections', () => {
    expect(app).toContain('calculateMultiCompanyPortfolio(propertiesWithLoans, state.companies, state.settings)')
    expect(app).toContain('calculatePortfolio(propertiesWithLoans, state.settings)')
    expect(app).toContain('calculatePortfolio(focusedProperties, effectiveSettings)')
    expect(app).toContain('<ProjectionExplorer properties={focusedProperties} settings={effectiveSettings} portfolio={focusedPortfolio}')
    expect(app).toContain('const companyPortfolio = calculatePortfolio(')
  })
})
