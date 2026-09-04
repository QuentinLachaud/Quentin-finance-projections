import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(path, 'utf8')

describe('application architecture regression contracts', () => {
  it('loads and persists user workspaces inside the signed-in portfolio state', () => {
    const app = read('src/App.jsx')
    expect(app).toContain(".from('portfolio_states').select('portfolio').eq('user_id', user.id).maybeSingle()")
    expect(app).toContain("expenses: Array.isArray(portfolioState.expenses) ? portfolioState.expenses : []")
    expect(app).toContain("credentials: Array.isArray(portfolioState.credentials) ? portfolioState.credentials : []")
    expect(app).toContain("const migratedRemortgageComparisons = Array.isArray(portfolioState.remortgageComparisons) ? portfolioState.remortgageComparisons : []")
    expect(app).toContain("remortgageComparisons: mortgageMigration.comparisons")
    expect(app).toContain("upsert({ user_id: user.id, portfolio: state }, { onConflict: 'user_id' })")
  })

  it('keeps Remortgage Simulator as its own Pro-gated workspace', () => {
    const app = read('src/App.jsx')
    expect(app).toContain("['Remortgage Simulator', 'Remortgage', RefreshCw, 'PLANNING']")
    expect(app).toContain("{section === 'Remortgage Simulator' && <RemortgageSimulator")
    expect(app).toContain('isPro={effectiveEntitlement.isPro}')
    const projectionBlock = app.slice(
      app.indexOf("{section === 'Projections'"),
      app.indexOf("{section === 'Remortgage Simulator'"),
    )
    expect(projectionBlock).not.toContain('<RemortgageSimulator')
  })

  it('keeps server-only credentials out of production client source', () => {
    const productionFiles = readdirSync('src')
      .filter((name) => /\.(js|jsx)$/.test(name) && !name.includes('.test.'))
    const clientSource = productionFiles.map((name) => read(join('src', name))).join('\n')

    for (const secretName of [
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SECRET_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'COMPANIES_HOUSE_API_KEY',
      'GOCARDLESS_SECRET_KEY',
      'GOCARDLESS_SECRET_ID',
    ]) {
      expect(clientSource).not.toContain(secretName)
    }
  })

  it('keeps authenticated API JSON explicitly private and non-cacheable', () => {
    expect(read('functions/api/_billing.js')).toContain("'cache-control': 'private, no-store'")
    expect(read('functions/api/banking.js')).toContain("'cache-control': 'private, no-store'")
    expect(read('functions/api/companies-house.js')).toContain("'cache-control': 'private, no-store'")
  })

  it('protects every bank-data table with user-scoped RLS and revokes anonymous access', () => {
    const migration = read('supabase/migrations/20260816_bank_connections.sql')
    for (const table of [
      'bank_connections',
      'bank_accounts',
      'bank_transactions',
      'bank_balance_snapshots',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`)
    }
    expect(migration.match(/using \(\(select auth\.uid\(\)\) = user_id\)/g)?.length).toBeGreaterThanOrEqual(4)
    expect(migration).toContain('revoke all on public.bank_connections, public.bank_accounts, public.bank_transactions, public.bank_balance_snapshots from anon;')
  })

  it('does not embed live Stripe-style secrets in production source files', () => {
    const roots = ['src', 'functions']
    const source = roots.flatMap((root) => {
      const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return walk(path)
        if (!/\.(js|jsx)$/.test(entry.name) || entry.name.includes('.test.')) return []
        return [read(path)]
      })
      return walk(root)
    }).join('\n')

    expect(source).not.toMatch(/\bsk_live_[A-Za-z0-9]+/)
    expect(source).not.toMatch(/\bwhsec_[A-Za-z0-9]{12,}/)
  })
})
