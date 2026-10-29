import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const summary = readFileSync(new URL('./CompanyFinancialSummaryWorkspace.jsx', import.meta.url), 'utf8')
const companies = readFileSync(new URL('./multiCompany.js', import.meta.url), 'utf8')
const crashBoundary = readFileSync(new URL('./PortfolioCrashBoundary.jsx', import.meta.url), 'utf8')

describe('company ownership integration contract', () => {
  it('normalizes stored properties before tenant and loan hydration and retains company IDs through reconciliation', () => {
    const load = app.slice(app.indexOf('const loadPortfolio = async () =>'), app.indexOf('const refreshEntitlement ='))
    const migration = load.indexOf('companyState = normalizeCompanyPortfolio(')
    const migrated = load.indexOf('const companyProperties = companyState.properties')
    const loans = load.indexOf('normalizeLoans(portfolioState.loans, companyProperties)')
    const reconcile = load.indexOf('properties: companyProperties', load.indexOf('const mortgageMigration ='))
    expect(migration).toBeGreaterThan(0)
    expect(load.slice(migration, migrated)).toContain('properties: migratedProperties')
    expect(migrated).toBeGreaterThan(migration)
    expect(loans).toBeGreaterThan(migrated)
    expect(reconcile).toBeGreaterThan(loans)
    expect(load).toContain('companies: companyState.companies')
    expect(load).toContain('setLoadError(migrationError.message')
  })

  it('connects legal-owner picker and prohibits assigning a property to an unknown company', () => {
    expect(app).toContain('aria-label="Property owning company"')
    expect(app).toContain('if (!current.companies.some((company) => company.id === draft.companyId)) return current')
    expect(app).toContain('companyId }')
    expect(app).toContain('Change the legal owner of this BTL?')
  })

  it('shows a company directory, per-company BTL rows and two independent toggle levels', () => {
    expect(app).toContain("['Companies', 'Companies', Building2, 'PORTFOLIO']")
    expect(app).toContain("section === 'Companies' && isCompanyAccount")
    expect(app).toContain('companyOwned.map((property) => <OverviewPropertyRow')
    expect(app).toContain('checked={company.enabled}')
    expect(app).toContain('onChange={() => toggleCompany(company.id)}')
    expect(app).toContain('onToggle={toggleProperty}')
    expect(app).toContain('includedCompanyProperties(propertiesWithLoans, state.companies)')
  })

  it('never shares Companies House IDs between companies', () => {
    expect(app).toContain('key={activeCompany.id} settings={effectiveSettings}')
    expect(app).toContain('updateCompany(activeCompany.id, key, value)')
    expect(app).toContain('aria-label="Select Companies House company"')
    expect(companies).toContain("companyNumber: company?.companyNumber || ''")
  })

  it('disables pooled bank balances and unallocated transaction actuals for multi-company accounts', () => {
    expect(app).toContain('if (isCompanyAccount && state.companies.length > 1) return')
    expect(app).toContain('bankTransactionsScoped={state.companies.length === 1}')
    expect(summary).toContain('if (!bankTransactionsScoped)')
    expect(summary).toContain('setTransactions([])')
    expect(summary).toContain('Trailing actual banking transactions are unavailable for this entity')
  })

  it('keeps excluded legal entities visible in their own financial workspaces', () => {
    expect(app).toContain('A company disabled in the combined portfolio still has its own standalone books')
    expect(app).toContain('propertiesWithLoans.filter((property) => property.companyId === activeCompany.id && property.active === true)')
    expect(app).toContain('calculated.filter((property) => property.companyId === activeCompany.id && property.active === true)')
  })

  it('retains private landlord mode without exposing a company directory', () => {
    expect(app).toContain("['Companies', 'Companies House', 'Company Financial Summary'].includes(label)")
    expect(app).toContain("['Companies', 'Companies House', 'Company Financial Summary'].includes(section)")
  })
})


describe('portfolio startup failure regression', () => {
  it('shows a recoverable error rather than a blank app after an uncaught React render failure', () => {
    expect(crashBoundary).toContain('class PortfolioCrashBoundary extends React.Component')
    expect(crashBoundary).toContain('static getDerivedStateFromError(error)')
    expect(crashBoundary).toContain('We couldn’t display your portfolio')
    expect(crashBoundary).toContain('role="alert"')
    expect(app).toContain('onError={() => handlePortfolioReady(session.user.id)}')
    expect(crashBoundary).toContain('this.props.onError?.(error)')
    expect(crashBoundary).toContain('console.error(\'Portfolio render failed\'')
  })

  it('catches migration and hydration exceptions and does not leave a silent loading loop', () => {
    expect(app).toContain("console.error('Portfolio hydration failed', loadFailure)")
    expect(app).toContain('setLoadError(loadFailure?.message')
    expect(app).toContain('setStartupError(pendingUserId')
    expect(app).toContain('}, 20000)')
    expect(app).toContain('BTL Portfolio could not open')
    expect(app).toContain('role="alert"')
  })

  it('falls back to a valid company when a previously saved active company has disappeared', () => {
    expect(app).toContain('COMPANY_FINANCIAL_KEYS, LEGACY_COMPANY_ID, calculateMultiCompanyPortfolio')
    expect(app).toContain('(state.companies || []).find((company) => company.id === state.settings.activeCompanyId)')
    expect(app).toContain("createPortfolioCompany(LEGACY_COMPANY_ID, state.settings.companyName || 'Company 1')")
  })
})
