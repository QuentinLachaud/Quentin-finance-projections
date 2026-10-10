# Luna capability parity — audit and implementation plan

**Audited:** 2026-10-10; \`QuentinLachaud/Quentin-finance-projections\`, GitHub main + PR #8.

## Product contract

Luna is a **portfolio-aware, authenticated assistant**, not a separate datastore or a DOM automation agent. Every read and write must use the same source of truth, calculations, property/loan relationships, RLS and account entitlements as the UI. It must handle a whole task, including related changes, without pretending unsupported fields were saved. "Equivalent to the UI" means **domain operations**, with user-visible handoffs for OAuth, payment authorisation, file selection, browser permissions and secret revelation.

The goal is **capability parity**, not that Luna can click every element in the DOM. All writes must have explicit allow-listed schemas and verifiable outcomes.

## Audit matrix (after the first implementation in PR #8)

| Website/app domain | Read/query | Write/modify | Existing status and remaining gaps |
|---|---|---|---|
| Portfolio overview | **Now:** computed all-property financial summary, values/equity/rent, scenario cash flow | Settings updates | Full overview visual interactions and account-specific projections still require extensions. |
| Properties / BTLs | **Now:** full property and linked context; calculated cashflow | **Now:** create, update many fields, clone, archive/delete, transactional batches | Administration fields added; strict validation. Multi-loan account number must target a particular loan. Property metadata validation beyond the field list needs work. |
| Loans | List, get, linked loans, loan metrics | Create/update/delete, property account sync for exactly one loan | Need explicit property-scoped selection of one loan, repayment schedules and remortgage lifecycle actions. |
| Tenants | Get, list, linked to BTL | Create/update/delete | Property-owned deposit canonical data correctly shown on tenant cards; tenant allocation and related updates need wider atomic workflows. |
| Costs and cash flow | Expenses and company cost/extraction lists and summary | Create/update/delete expenses, company costs and extractions | Need advanced filters, by-period reporting and connection to bank transaction truth. |
| Documents and receipts | Expense document metadata stored in portfolio | Metadata in expense records | **Not yet:** authenticated Supabase Storage file upload/download/rename/delete and direct Google Drive attachment/link flows. Must not claim a file was uploaded when only metadata changed. |
| Contractors/tags | List, get | CRUD/tag CRUD | Need richer searches and document/job association operations. |
| Property timelines | Raw event list | Manual event CRUD | Need composite generated timeline view and filters. |
| Performance | Raw performance-event list; financial summary/projection | — | **Not yet:** manual performance-event CRUD, XIRR and bank-actual performance chart queries with precise scopes. |
| Acquisition Simulator | Saved scenarios list, existing client simulation through UI | — | **Not yet:** scenario CRUD/reorder, listing URL import and direct server-side acquisition calculation endpoints. |
| Remortgage Simulator | Saved comparisons list | — | **Not yet:** comparison CRUD, scenario side updates, direct rate/fee break-even calculations. |
| Projections and Next BTL | **Now:** portfolio cash-flow projection milestones through the app engine | Settings only | **Not yet:** edit Next BTL saved preferences, run acquisition/equity-release calculations independent of the open browser view. |
| Notifications / compliance | Notification preferences, BTL dates through property context | Notifications on/off via settings | **Not yet:** dismiss/snooze individual reminders and web push subscriptions. Push permission is browser controlled. |
| Banking | — | — | Data in separate Supabase tables and banking API. Needs authenticated read-only account/transaction tools, then guarded transaction review/categorisation and sync; never fabricate balances or mark transfers without verified identifiers. |
| Company Financial Summary | Partial portfolio calculations | Company settings updates | **Not yet:** use same company financial snapshot as UI, with bank transaction sourcing, period/date and tax assumptions. |
| Companies House | — | — | Requires reusing the existing public Companies House adapter through server-side authenticated tools; no fake filings or official data. |
| IDs and credentials | — | — | Existing credential values are sensitive. Offer labels/expiry/status read with redaction; secret reading and modification must use a separate security policy / explicit approval. |
| UI navigation | Workspace opens, property selection, acquisition simulation | Select/navigate | **Not yet:** all workspace filters, editor focus, direct downloadable exports, settings panels, local UI preferences. |
| Billing/auth/account | — | — | Keep billing, authentication, Stripe, Open Banking consent and admin entitlements as explicit user-controlled handoffs, not silent LLM actions. |

### Major existing correctness risks and what PR #8 changes

1. **Silent field drops:** old \`patchFrom\` silently removes unsupported keys. PR #8 adds strict validation for property writes and covers all eight administration fields. Other CRUD paths still use lenient \`patchFrom\` and should be migrated systematically.
2. **Conflicting loan identity:** property \`mortgageNumber\` is a derived/display field when a loan is linked. PR #8 updates the linked loan for a single-loan property and refuses to guess among multiple loans.
3. **No linked transactional edits:** PR #8 adds up-to-12 \`portfolio.batch\` transactions. Failures happen before persistence; deletion confirmation is preserved.
4. **Fragmented query context:** PR #8 adds restricted \`portfolio.context\`, \`property.context\`, \`portfolio.financial_summary\` and \`portfolio.projection\`, reusing the existing engines. Credentials and external banking tables remain inaccessible through the generic snapshot.
5. **Whole-document stale writes:** the Luna API now uses \`updated_at\` compare-and-swap when the record has a version, and the UI skips immediately rewriting a Luna-delivered change. **Remaining:** ordinary browser autosaves still use unconditional upsert and can race with another browser tab; resolve this end-to-end.
6. **Unverified success:** PR #8 explicitly verifies saved field values and reports actual changed keys. Extend verification to all other domain operations and test against an independent reload.

## Implementation stages after PR #8

### Stage 1 — finish safety and reliability (P0)

- Replace every lenient mutable patch path with a **typed, centrally registered field specification**. Define writable/readable capability metadata: required fields, types, constraints, relationships, permissions and confirmation policy. Prefer sharing schemas with UI instead of maintaining drift-prone copies.
- Implement version-aware **browser** writes and stale-state recovery using the same CAS protocol as Luna. Avoid overwriting unrelated edits; surface conflicts rather than silently selecting one.
- Make write receipts uniform: \`operation\`, entity ID, before/after changed fields, persisted revision, skipped fields (should be none), warnings, correlated timeline/loan updates.
- Upgrade property mortgage modifications so all loan-backed financial fields route to loan records; preserve full multi-loan topology.
- Schema/compatibility tests: enumerate editable UI fields and fail CI if Luna lacks the relevant operation or explicitly documented handoff.

### Stage 2 — full in-portfolio CRUD (P1)

- Acquisition: create/rename/edit/duplicate/reorder/delete saved scenarios via existing \`acquisition.js\`; deterministic \`acquisitionCosts\` and affordability calculations, with assumptions surfaced.
- Remortgage: create/edit/duplicate/delete comparisons with existing \`remortgage.js\`, fee handling, loan-to-value and comparison calculations.
- Performance: manual event CRUD, cashflow model queries, XIRR with sourced event IDs and duplicate-expense warnings.
- Compliance: composite timeline/compliance queries, reminder dismiss/snooze operations, notification preference editing.
- Expense/document metadata: filters, association, tagging, renaming and contractor links.
- Next BTL simulation: saved target/preference CRUD and backend derivation of timeline, cash requirement and equity-release outcomes.
- Same-user batch operations must support these new actions atomically.

### Stage 3 — external and binary sources (P1/P2)

- Banking: add a separate **read-only** authenticated API tool over \`bank_accounts\`, \`bank_transactions\` and snapshots with RLS; cap results, support date/property/category filters and clear freshness/authority labels. Then add audited mutation actions for categorisation, internal-transfer recognition, review, reconciliation and sync.
- Documents: use Supabase Storage server-backed metadata + signed short-lived URLs, virus/type/size checks, user-specific ownership enforcement. Google Drive linking/import requires OAuth scope choices and source provenance.
- Company financial reports: reuse \`buildCompanyFinancialSnapshot\` and its transaction evidence; distinguish forecast from booked transactions and document date range.
- Companies House: reuse the app's existing adapter for official queries; do not write filings without a dedicated user-authorised external flow.
- Credentials: expose only metadata and expiry by default; require a separate audited policy for handling secret values. Never put tokens or full credential values into model-context snapshots.

### Stage 4 — UI and handoffs (P2)

- Declarative \`client_ui_action\` handlers for all supported screens, specific entity editors and filters; no model-authored selectors, DOM commands or arbitrary JavaScript.
- Export handoff for reports and PDF/CSV generation: deterministic server-side export using the same app data and user authorisation.
- Keep Stripe checkout, OAuth consents, browser microphone/push permission and local file pickers as explicit user-visible interactions; Luna can navigate to or prepare them, not silently complete them.

## Test and release gates

1. **Golden tasks:** for each app domain, test a simple read, scoped multi-entity read, calculation, create/update, linked update and permission failure.
2. **Exact-name resolution:** BTL1 vs BTL10; ambiguous addresses; repeated tenants/loans; property and original mortgage identity must never change accidentally.
3. **Transactionality:** perform multiple related writes with one failing step: zero changes; destructive actions must have confirmation.
4. **No hallucinated state:** unknown keys, unknown target, invalid amounts, unsupported workflows and missing sources must fail clearly. Model replies must match server write receipts.
5. **Source-of-truth equations:** compare Luna financial, performance, acquisition and remortgage results against the application's exported pure calculation functions for the same fixture.
6. **Concurrency:** stale Luna read, stale browser tab, simultaneous editor and Luna write, offline resume and cross-device reconnection.
7. **Privacy:** never include credential secrets, API keys or unrelated users' data in model contexts or logs. Supabase RLS, entitlement and rate/size limits tested.
8. **Evidence and traceability:** original IDs, timestamps, note which numbers come from live bank data vs estimates; make the result inspectable in the UI.
9. **CI:** \`npm ci\`, \`npm test\`, \`npm run build\`; smoke test deployed preview with a disposable portfolio before promoting to \`main\`.

## Acceptance examples

- "Populate all BTL1 admin fields" → one validated update, linked mortgage ID preserved, tenant card reads property-owned deposit, single verified save.
- "Update BTL1 and BTL2 together" → one atomic batch; no partial success if BTL2 is missing.
- "Compare BTL1+BTL2 vs all BTLs, cashflow, equity and buffer" → deterministic scope, no silently prorated company expenses.
- "When can I buy a £190k BTL?" → app acquisition engine with current portfolio state, documented assumptions and scenario.
- "Find the largest three maintenance expenses this year" → filtered authoritative ledger (and banking if bank-connected), ranked with references.
- "What compliance is due, and snooze BTL2's EPC?" → actual generated reminder ID and explicit preference write.
- "Import this document from Google Drive" → ask for provider authorisation or browser handoff if absent; never claim binary transfer without success.
- "Reveal a company auth code" → explicit credential security policy, not a broad portfolio-context leak.

**Definition of done:** only call Luna "UI-parity complete" once every row above is either implemented with the same observable behavior as the UI or intentionally restricted with a visible, tested user handoff. PR #8 is the safe foundation, not yet full parity.
