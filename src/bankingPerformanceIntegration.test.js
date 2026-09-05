import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(path, 'utf8')

describe('Banking + Performance integrity integration', () => {
  it('keeps Banking available for statement import even before GoCardless server secrets are configured', () => {
    const app = read('src/App.jsx')
    expect(app).not.toContain('VITE_BANKING_ENABLED')
    expect(app).toContain("params.get('bank_callback') === '1'")
    expect(app).toContain("section === 'Banking' && <BankWorkspace")
    expect(read('.env.example')).toContain('GOCARDLESS_SECRET_ID=')
    expect(read('.env.example')).toContain('GOCARDLESS_SECRET_KEY=')
  })

  it('stores statement provenance, property assignment, performance treatment and exclusions under RLS', () => {
    const migration = read('supabase/migrations/20260905140938_bank_statement_performance.sql')
    expect(migration).toContain('create table if not exists public.bank_statement_imports')
    expect(migration).toContain('alter table public.bank_statement_imports enable row level security')
    expect(migration).toContain('revoke all on table public.bank_statement_imports from anon, authenticated')
    expect(migration).toContain("add column if not exists source_type")
    expect(migration).toContain("add column if not exists property_id")
    expect(migration).toContain("add column if not exists performance_treatment")
    expect(migration).toContain("add column if not exists exclude_from_performance")
  })

  it('supports Tide CSV/PDF import, review, cross-source dedupe and bank-backed Performance', () => {
    expect(read('src/BankStatementImportSheet.jsx')).toContain('multiple')
    expect(read('src/BankStatementImportSheet.jsx')).toContain('.pdf,application/pdf')
    expect(read('src/bankStatementImport.js')).toContain("import('pdfjs-dist')")
    expect(read('src/BankTransactionReview.jsx')).toContain('Make actuals trustworthy')
    expect(read('src/banking.js')).toContain('deduplicateTransactions')
    expect(read('src/performance.js')).toContain('bankTransactionMatchesExpense')
    expect(read('src/PerformanceWorkspace.jsx')).toContain('Company cash')
    expect(read('src/PerformanceWorkspace.jsx')).toContain('Net DLA funding')
  })

  it('uses the shared delete-confirm dialog for deletable manual and timeline Performance events', () => {
    const ui = read('src/PerformanceWorkspace.jsx')
    expect(ui).toContain("import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'")
    expect(ui).toContain("event.sourceType === 'timeline'")
    expect(ui).toContain('onTimelineEventDelete')
    expect(ui).not.toContain('This removes the manual return adjustment only.')
  })
})
