# BTL Portfolio — Multi-company ownership: explicit implementation plan

**Status:** Implementation on a feature branch; draft PR #25. High risk: manual approval before merge, no auto-merge.

**Repository:** QuentinLachaud/Quentin-finance-projections
**Delivery route:** Chat → braindrain/multi-company-ownership → PR #25 → validate-btl-portfolio → explicit manual merge approval → Cloudflare production deployment verification. No Mac queue.

## 1. Behavioural contract

An account can hold one or more companies. Each BTL must have exactly one owning company, identified by a stable internal ID rather than mutable company name. Its property ID and linked loans, tenants, documents, performance events and timeline records stay stable.

The Overview shows the combined portfolio from *enabled companies* and *active BTLs* only. Company and property toggles are independent. Disabling a company does not delete, transfer, disable or archive its properties. The disabled entity remains visible and editable in Companies.

A dedicated Companies section groups all BTL overview-style rows under the company that legally owns each. Each company includes registration number, cash, summary metrics, Add BTL, Companies House link, company toggle, editing of name/cash, and safe removal only when empty. A property editor shows a legal-owner selector and confirms ownership changes. Cloning preserves the original owner, creating within a company selects that owner.

The Companies House section allows multiple saved official company numbers, selection between entities, search/link/refresh/unlink independently, and retains the existing officers, PSCs, charges, filings and compliance deadlines. An official company lookup does not itself transfer the property title or incorporate a company.

In Private landlord mode, company navigation and company-specific official registers are hidden, but entity ownership metadata remains stored for switching back.

## 2. Data structure and invariants

Use the existing per-user, RLS-protected Supabase portfolio_states.portfolio JSONB. No new database table or new RLS policy is required. The JSON contract is:

  portfolio.companies = [
    { id, name, companyNumber, companyMatchedName, enabled,
      settings: { cashHeld, companyCosts, extractions, associatedCompanies,
                  accountingPeriodMonths, augmentedProfitDistributions, ... } }
  ]
  portfolio.properties = [{ id, companyId, active, ...original fields }]
  portfolio.settings.activeCompanyId = selected company ID

Company IDs are unique, immutable and user-account scoped. A property references precisely one existing company. Explicitly unknown company IDs must fail validation rather than be silently reassigned. No deletion of an occupied company, nor deletion of the last company. Renames and Companies House number changes never change internal IDs. Existing property IDs and all records linked by propertyId must survive ownership reassignment.

Associated companies for corporation-tax thresholds are a separate statutory concept: do not infer the input from the count of companies added to the dashboard.

## 3. Migration and sync

1. On loading legacy JSON with no companies array, synthesize one deterministic entity ID, legacy-company. Use previous settings.companyName, companyNumber, companyMatchedName, cashHeld, companyCosts and extractions, plus company-specific corporation-tax inputs.
2. Assign that ID to every existing BTL while preserving its original ID, active flag, tenant/mortgage fields and associated records.
3. Keep the original tenant/loan/expense/document/timeline collections intact, and pass migrated properties into existing normalizers.
4. Migration must be idempotent and must not create duplicate companies or properties after refresh.
5. Malformed ownership is a blocking recoverable error; never silently reassign unknown owners, overwrite portfolio state or save partial migration.
6. Preserve optimistic Supabase updated_at write-conflict handling. Test multi-tab remote state and legacy single-company roundtrips.

Because this changes persisted JSON structure, take a database snapshot/export before rollout. UI code rollback alone cannot fully reverse multi-company data already saved.

## 4. Correct company-level accounting

The existing calculatePortfolio(properties, settings) remains the financial calculation authority. Calculate every legal entity separately, with properties filtered by companyId and its own settings, then combine outputs for enabled companies only.

Sum computed rent, cash, expenses, taxable results, tax estimate, after-tax bank cashflow, extraction and equity. Recompute consolidated LTV as sum(debt)/sum(value), weighted interest rate by outstanding mortgage balances, and safety buffer from aggregate cash divided by aggregate monthly operating costs. Do not average company LTV or cash runway, and do not calculate tax from pooled taxable profit. Combined tax is a sum of *separate* monthly liabilities, not a fictional combined company return. One company's loss must not automatically offset another's profit.

Company Financial Summary, Costs & Cash Flows, Performance, company projections and account-level summaries must label whether the figures apply to the chosen legal entity or all included companies. Show selected-company controls in scoped workspaces. Preserve portfolio-wide properties/loans comparison where appropriate and mark filtered scopes.

## 5. Banking and expenses boundary

Current banking records are user-scoped, NOT company-scoped. Therefore bank connections must be labelled account-wide and pooled bank balance must never overwrite an individual company’s cash when multiple entities exist. Allow separately entered company cash values. A future feature should assign companyId to bank accounts and standalone non-property-linked expenses/transactions, backfill ownership carefully and reconcile balances before enabling automatic per-entity bank cash sync.

Property-linked expenses can inherit the owner from propertyId. Unallocated shared expenses must not be silently attached to the selected company.

## 6. UI and Companies House details

Company section: each company has an accessible include/exclude switch, legal name, Companies House number and official-register jump, main metrics and property rows exactly like Overview. Excluded companies remain editable; each row retains individual active toggle. Editing BTL ownership asks for confirmation. Switches are reversible and do not mutate ownership.

Companies House: register is fetched by the selected company's own companyNumber; changing selection should invalidate stale prior responses. A linked number cannot be replaced in a different company by switching tabs. Unlinking only clears the official-record association; it cannot remove an entity or its property links. Missing API key/network failures must not damage stored company data.

Responsive: provide readable company cards, property rows and toggles on mobile; verify keyboard navigation and aria labels.

## 7. Regression and acceptance matrix

| Area | Mandatory checks |
| --- | --- |
| Migration | Legacy name/number/cash/costs preserved, same property and tenant/loan/document IDs, idempotent |
| Ownership | New/clone/reassign BTL correct company; confirmation; no duplicate property; unknown owner rejected |
| Entities | Add, rename, toggle, choose, empty-delete, occupied-delete denied, last-delete denied |
| Visibility | Company and BTL flags independent, disable then re-enable restores prior BTL selection, zero enabled yields zero combined |
| Tax | Each company has separate corporation tax, fees/extractions and cash; combined scenario sums per-company results |
| Metrics | Correct consolidated LTV, weighted rate and cash buffer |
| Companies House | Two independent company numbers; correct search/select/refresh/unlink, no stale cross-entity details |
| Workspaces | Overview combined; selected-company summary/costs/performance/projections; Private mode retained |
| Persistence | Refresh and multitab conflict behaviour, no orphaning, no data loss |
| Banking | Account-wide warning and disabled automatic pooled balance overwrite |
| Build | npm ci, npm test (Vitest), npm run build in validate-btl-portfolio |

## 8. Review and release gates

This PR is high-risk even without SQL migration, because financial and ownership semantics and persisted JSON change. Do not auto-merge. Review current one-company production portfolio before/after migration (rent, property IDs, loan IDs, costs, cash, tax, loans, scenarios). Seed and test two genuinely distinct companies and verify no cross-company contamination. Confirm RLS/sync are unchanged. Validate a live preview manually on desktop/mobile and Companies House for two company numbers.

After all tests and manual approval: merge through protected main and required CI only, then verify Cloudflare Pages production serves the merge commit. Distinguish PR opened, CI passed, merged and deployed.

Potential future scope, not silently implied: company-tagged banking/expenses, inter-company loans, group relief, statutory associated-company analysis, historical transfers with effective ownership dates, and group consolidated accounting.

**Success criterion:** Adding a second company and assigning it a BTL never modifies the first company’s official record, linked property identities, own cash or tax inputs. Company toggles modify combined presentation only.
