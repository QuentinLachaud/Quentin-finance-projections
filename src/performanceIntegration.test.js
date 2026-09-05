import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.jsx', 'utf8')
const model = readFileSync('src/performance.js', 'utf8')
const ui = readFileSync('src/PerformanceWorkspace.jsx', 'utf8')
const styles = readFileSync('src/styles.css', 'utf8')
const loansTest = readFileSync('src/loansIntegration.test.js', 'utf8')

describe('Performance integration', () => {
  it('adds Performance as a portfolio workspace and keeps its manual adjustments in the existing portfolio JSON state', () => {
    expect(app).toContain("['Performance', 'Performance', TrendingUp, 'PORTFOLIO']")
    expect(app).toContain("Performance: {")
    expect(app).toContain("import PerformanceWorkspace from './PerformanceWorkspace.jsx'")
    expect(app).toContain('performanceEvents: normalizePerformanceEvents(portfolioState.performanceEvents, migratedProperties)')
    expect(app).toContain("{section === 'Performance' && <PerformanceWorkspace")
    expect(app).not.toContain("from('performance_")
  })

  it('derives actual history from existing ledgers and timeline snapshots without synthesizing historic rent or costs', () => {
    expect(model).toContain("sourceType: 'expense'")
    expect(model).toContain("event.sourceField === 'rent'")
    expect(model).toContain("event.sourceField === 'latestValuation'")
    expect(model).toContain("event.sourceType === 'loan-change'")
    expect(model).toContain('No dated income or cost entries are available')
    expect(model).not.toContain('backfillRent')
    expect(ui).toContain('Historical rent and costs are included only when they exist as dated entries')
  })

  it('cleans up manual performance events with deleted properties and routes actual cash entry back to the shared expense ledger', () => {
    expect(app).toContain('performanceEvents: (current.performanceEvents || []).filter((event) => event.propertyId !== id)')
    expect(app).toContain("onOpenExpenses={() => setSection('Documents & Expenses')}")
    expect(ui).toContain('Actual income / costs')
  })

  it('visually separates actual and projected paths and provides responsive audit tables', () => {
    expect(ui).toContain('performance-projection-zone')
    expect(ui).toContain('performance-today-line')
    expect(ui).toContain('projected')
    expect(styles).toContain('/* Performance workspace */')
    expect(styles).toContain('.performance-table-wrap')
    expect(styles).toContain('@media (max-width: 640px)')
  })

  it('replaces the brittle Loans source-string assertion that blocked the otherwise-passing Property Timeline task', () => {
    expect(loansTest).toContain("expect(app).toContain('const saveLoan = (loan) => setState((current) => {')")
    expect(loansTest).toContain("expect(app).toContain('const next = applyLoanToPortfolio(current, loan)')")
    expect(loansTest).toContain("expect(app).toContain('loanChangeEvents(previousLoan, nextLoan, propertyId)')")
    expect(loansTest).not.toContain("expect(app).toContain('const saveLoan = (loan) => setState((current) => applyLoanToPortfolio(current, loan))')")
  })
})
