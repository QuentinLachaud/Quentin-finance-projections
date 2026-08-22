import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')
const app = read('./App.jsx')
const bank = read('./BankWorkspace.jsx')
const expenses = read('./ExpensesWorkspace.jsx')
const credentials = read('./CredentialsWorkspace.jsx')
const styles = read('./styles.css')

describe('mobile-native workspace regression audit', () => {
  it('uses a dedicated mobile Projections representation instead of the desktop chart/table', () => {
    expect(app).toContain('projection-desktop-view')
    expect(app).toContain('projection-mobile-view')
    expect(app).toContain('MobileProjectionChart')
    expect(app).toContain('MobileProjectionSnapshots')
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.projection-desktop-view[\s\S]*?display:\s*none/)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.projection-mobile-view[\s\S]*?display:\s*block/)
  })

  it('uses dedicated mobile Banking balance, cash-flow and transaction views', () => {
    expect(bank).toContain('bank-balance-mobile')
    expect(bank).toContain('bank-cashflow-mobile')
    expect(bank).toContain('bank-transaction-mobile-list')
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.bank-chart-desktop[\s\S]*?display:\s*none/)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.bank-transaction-table[\s\S]*?display:\s*none/)
  })

  it('does not make primary phone views horizontally scrollable', () => {
    expect(styles).toContain('overflow-x: clip')
    expect(styles).not.toMatch(/\.projection-mobile-view[^{]*\{[^}]*overflow-x:\s*(auto|scroll)/)
    expect(styles).not.toMatch(/\.bank-transaction-mobile-list[^{]*\{[^}]*overflow-x:\s*(auto|scroll)/)
  })
})

describe('single page hierarchy audit', () => {
  it('keeps the global workspace title and removes duplicate child page introductions', () => {
    expect(app).toContain('<h1>{pageMeta.title}</h1>')
    expect(bank).not.toContain('<h2>Bank balances & actual cash flow</h2>')
    expect(expenses).not.toContain('<h2>Expenses</h2>')
    expect(credentials).not.toContain('<h2>IDs & Credentials</h2>')
  })

  it('retains useful first-panel actions after removing duplicate introductions', () => {
    expect(bank).toContain('Connect account')
    expect(bank).toContain('Sync')
    expect(expenses).toContain('Add expense')
    expect(credentials).toContain('Add item')
  })
})
