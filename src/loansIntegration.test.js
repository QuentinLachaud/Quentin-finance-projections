import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const data = readFileSync(new URL('./data.js', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Loans workspace integration', () => {
  it('hydrates, navigates and persists loans through the existing portfolio state', () => {
    expect(app).toContain("import LoansWorkspace from './LoansWorkspace.jsx'")
    expect(app).toContain("import { applyLoanToPortfolio, normalizeLoans, syncPropertyMortgage } from './loans.js'")
    expect(app).toContain("['Loans', 'Loans', PoundSterling, 'PORTFOLIO']")
    expect(app).toContain("Loans: {")
    expect(app).toContain('const migratedLoans = normalizeLoans(portfolioState.loans, migratedProperties)')
    expect(app).toContain('loans: migratedLoans,')
    expect(app).toContain('const saveLoan = (loan) => setState((current) => applyLoanToPortfolio(current, loan))')
    expect(app).toContain("{section === 'Loans' && <LoansWorkspace")
    expect(app).toContain('loans={state.loans || []}')
  })

  it('keeps BTL-originated mortgage edits synchronized with Loans and current remortgage state', () => {
    expect(app).toContain('const mortgageSync = syncPropertyMortgage({')
    expect(app).toContain('loans: current.loans || []')
    expect(app).toContain('comparisons: current.remortgageComparisons || []')
    expect(app).toContain('const cloneProperty = (id) => {')
    expect(app).toContain('const addProperty = () => {')
    expect(app.match(/setEditingField\(''\)/g)?.length).toBeGreaterThanOrEqual(3)
    expect(data).toContain("mortgageFeeMode: 'percent'")
    expect(data).toContain('mortgageFeeValue: 0')
    expect(data).toContain('mortgageFeeAddedToLoan: false')
    expect(data).toContain('mortgageLtvBand: 0')
  })

  it('uses responsive theme-native styling without hiding requested summary metrics', () => {
    expect(styles).toContain('/* Brain Drain 2026-09-04 12:15 BST — Loans workspace */')
    expect(styles).toContain('.loan-summary-row')
    expect(styles).toContain('var(--ui-surface)')
    expect(styles).toContain('var(--ui-line)')
    expect(styles).toContain('@media (max-width: 900px)')
    expect(styles).not.toContain('.loan-cell { display: none')
  })
})
