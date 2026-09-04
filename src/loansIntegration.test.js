import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const data = readFileSync(new URL('./data.js', import.meta.url), 'utf8')
const loansWorkspace = readFileSync(new URL('./LoansWorkspace.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Loans workspace integration', () => {
  it('hydrates and reconciles effective capitalised balances through the existing portfolio state', () => {
    expect(app).toContain("import LoansWorkspace from './LoansWorkspace.jsx'")
    expect(app).toContain('reconcileLoanPortfolio')
    expect(app).toContain('updatePropertyMortgageInput')
    expect(app).toContain("['Loans', 'Loans', PoundSterling, 'PORTFOLIO']")
    expect(app).toContain("Loans: {")
    expect(app).toContain('const migratedLoans = normalizeLoans(portfolioState.loans, migratedProperties)')
    expect(app).toContain('const mortgageMigration = reconcileLoanPortfolio({')
    expect(app).toContain('properties: mortgageMigration.properties,')
    expect(app).toContain('loans: mortgageMigration.loans,')
    expect(app).toContain('remortgageComparisons: mortgageMigration.comparisons,')
    expect(app).toContain('const saveLoan = (loan) => setState((current) => applyLoanToPortfolio(current, loan))')
    expect(app).toContain("{section === 'Loans' && <LoansWorkspace")
  })

  it('makes property Loan amount edits pre-fee inputs while retaining effective loanAmount in the property model', () => {
    expect(app).toContain("if (key === 'loanAmount') return updatePropertyMortgageInput(current, parsed)")
    expect(app).toContain("key === 'loanAmount' ? (draft.mortgagePrincipalAmount ?? draft.loanAmount ?? '')")
    expect(data).toContain('mortgagePrincipalAmount: 0')
    expect(data).toContain("['latestValuation', 'Latest valuation', 'number'], ['loanAmount', 'Loan amount before fee', 'number']")
    expect(loansWorkspace).toContain('<span>Loan amount before fee</span>')
    expect(loansWorkspace).toContain('value={loan.principalAmount || 0}')
    expect(loansWorkspace).toContain('Mortgage balance: {currency(costs.effectiveBalance)}')
    expect(loansWorkspace).toContain('When enabled, the product fee increases the mortgage balance and therefore the monthly payment.')
  })

  it('keeps BTL-originated mortgage edits synchronized with Loans and current remortgage state', () => {
    expect(app).toContain('const mortgageSync = syncPropertyMortgage({')
    expect(app).toContain('loans: current.loans || []')
    expect(app).toContain('comparisons: current.remortgageComparisons || []')
    expect(app).toContain('const effectiveProperty = mortgageSync.property || synced.property')
    expect(app).toContain('properties.map((property) => property.id === draft.id ? effectiveProperty : property)')
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
