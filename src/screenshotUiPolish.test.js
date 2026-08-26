import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const expenses = readFileSync(new URL('./ExpensesWorkspace.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

const marker = '/* Brain Drain 2026-08-26 22:43 BST — screenshot UI polish */'
const start = styles.indexOf(marker)
const block = start >= 0 ? styles.slice(start) : ''

describe('screenshot-driven UI polish', () => {
  it('keeps light native form controls light in Properties search and Projections assumptions', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toMatch(/:root:not\(\[data-theme='dark'\]\)\s*\{[\s\S]*?color-scheme:\s*light/)
    expect(block).toMatch(/\.properties-search input\s*\{[\s\S]*?background:\s*transparent !important[\s\S]*?color-scheme:\s*light/)
    expect(block).toMatch(/\.assumptions-grid input\s*\{[\s\S]*?background:\s*transparent !important[\s\S]*?color-scheme:\s*light/)
    expect(styles).toMatch(/:root\[data-theme='dark'\]\s*\{[\s\S]*?color-scheme:\s*dark/)
  })

  it('uses account-aware Income & DLA terminology without changing sign-based transaction typing', () => {
    expect(app).toContain('accountType={state.settings.accountType}')
    expect(expenses).toContain("export default function ExpensesWorkspace({ expenses = [], properties = [], accountType = 'company', onChange })")
    expect(expenses).toContain("const incomeLabel = accountType === 'company' ? 'Income & DLA' : 'Income'")
    expect(expenses).toContain("Positive amounts are income or DLA funding; negative amounts are expenses.")
    expect(expenses).toContain('<span>{incomeLabel}</span>')
    expect(expenses).toContain('[incomeLabel, money.format(summary.income)]')
    expect(expenses).toContain("const label = type === 'income' ? 'Income'")
  })

  it('fits the editable Expenses ledger to the desktop reading canvas without removing fallback scrolling', () => {
    expect(styles).toContain('.expenses-table-wrap { overflow-x: auto; }')
    expect(block).toMatch(/@media \(min-width: 1181px\)[\s\S]*?\.expenses-table\s*\{[\s\S]*?min-width:\s*1180px[\s\S]*?table-layout:\s*fixed/)
    expect(block).toMatch(/\.expenses-table input\s*\{[\s\S]*?min-width:\s*0 !important[\s\S]*?text-overflow:\s*ellipsis/)
    expect(block).toContain('.expenses-table th:nth-child(9), .expenses-table td:nth-child(9)')
    expect(block).toContain('.expenses-table th:nth-child(10), .expenses-table td:nth-child(10)')
  })

  it('uses the polished Overview cash-flow variant in both Overview and Projections', () => {
    expect((app.match(/variant="overview"/g) || [])).toHaveLength(2)
    expect(app).toContain('className="panel scenarios-panel overview-cashflow-panel projections-scenarios"')
    expect((app.match(/CURRENT CASH POSITION/g) || [])).toHaveLength(2)
    expect((app.match(/Compare monthly cash available under different operating assumptions\./g) || [])).toHaveLength(2)
    expect(app).not.toContain('<ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} accountType={state.settings.accountType} />')
  })
})
