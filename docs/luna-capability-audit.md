# Luna Capability Audit

Date: 2026-09-25  
Model: `gpt-6-luna` via the OpenAI Responses API  
Principle: if a normal user can perform a portfolio-domain action in BTL Portfolio, Luna should ultimately be able to perform the same action through an authenticated, deterministic capability rather than by manipulating the UI.

## Architecture

Luna runs only in the Cloudflare Pages Function at `/api/luna`. The browser sends the existing Supabase access token. The function validates the user with Supabase, reads and writes `portfolio_states` using that same bearer token, and therefore remains subject to the existing row-level-security policies.

`OPENAI_API_KEY` is server-only. The browser never receives it.

Phase one uses one compact semantic function tool, `portfolio_action`, with a fixed operation allow-list. Luna can chain several tool calls in one request. The deterministic capability layer validates entity resolution and accepted fields before changing state.

Destructive operations do not execute on the first model call. The server returns a confirmation request and the UI requires a second explicit user action.

## Phase 1 — implemented first 50 operations

### Read / inspect

1. `portfolio.summary`
2. `property.list`
3. `property.get`
4. `tenant.list`
5. `tenant.get`
6. `expense.list`
7. `expense.get`
8. `expense.summary`
9. `loan.list`
10. `loan.get`
11. `contractor.list`
12. `contractor.get`
13. `settings.get`
14. `company_cost.list`
15. `extraction.list`
16. `timeline.list`
17. `performance_event.list`
18. `acquisition.list`
19. `remortgage.list`
20. `notification_preferences.get`

### Property / BTL

21. `property.create`
22. `property.update`
23. `property.clone`
24. `property.set_active`
25. `property.delete` — confirmation required

### Tenants

26. `tenant.create`
27. `tenant.update`
28. `tenant.delete` — confirmation required

### Expenses and cash-flow ledger

29. `expense.create`
30. `expense.update`
31. `expense.delete` — confirmation required

### Loans

32. `loan.create`
33. `loan.update`
34. `loan.delete` — confirmation required

### Contractors and tags

35. `contractor.create`
36. `contractor.update`
37. `contractor.delete` — confirmation required
38. `contractor_tag.create`
39. `contractor_tag.update`
40. `contractor_tag.delete` — confirmation required

### Model assumptions

41. `settings.update`

### Company costs

42. `company_cost.create`
43. `company_cost.update`
44. `company_cost.delete` — confirmation required

### Extractions

45. `extraction.create`
46. `extraction.update`
47. `extraction.delete` — confirmation required

### Property timeline

48. `timeline.create`
49. `timeline.update`
50. `timeline.delete` — confirmation required

## Remaining app capability audit

These are intentionally recorded now so Luna can converge on the whole application rather than growing ad hoc.

### Planning and simulations — Phase 2

- Create, edit, duplicate, reorder and delete acquisition scenarios.
- Import a property-listing URL into an acquisition scenario.
- Change acquisition jurisdiction, LTV, ADS/LBTT/SDLT assumptions, legal fees and mortgage fees.
- Change Next BTL target source, target price, appreciation assumption, scenario, buffer preservation, extraction inclusion, rent-growth inclusion and equity-release mode.
- Create, edit, duplicate and delete remortgage comparisons.
- Edit both sides of a remortgage comparison.
- Ask for deterministic acquisition affordability and cash-required calculations.
- Ask for deterministic remortgage comparison results.
- Add/edit/delete manual performance events.
- Ask for current and projected portfolio performance, tax, cash flow, buffer and equity-release calculations.

### Banking — Phase 2

- List connected bank accounts and balances.
- Search/filter bank transactions.
- Show transactions needing review.
- Categorise a transaction.
- Mark/unmark internal transfers.
- Link/unlink a transaction to a property.
- Override/reset performance treatment.
- Include/exclude a transaction from performance.
- Reconcile internal transfers.
- Trigger sync for an existing connection.
- Import a Tide/bank statement and review parsed rows.
- Disconnect a bank connection — destructive confirmation.
- Starting a new Open Banking consent flow should remain a user-visible handoff because it leaves BTL Portfolio for bank authorisation.

### Documents and receipts — Phase 2

- Search/filter documents.
- Create document metadata.
- Rename a document.
- Change document type/tags/association.
- Associate/disassociate a contractor.
- Associate/disassociate a property/expense.
- Delete a document — destructive confirmation.
- File upload itself remains a browser/file-picker action; Luna can prepare metadata and ask the user to choose the file.

### Notifications and compliance — Phase 2

- List actionable compliance/remortgage reminders.
- Dismiss a reminder.
- Snooze a reminder.
- Turn in-app reminders on/off.
- Web Push permission must remain a browser permission interaction; Luna can navigate/explain but cannot silently grant permission.

### Companies House — Phase 2

- Search Companies House.
- Load company profile, deadlines, filings, officers, PSCs and charges.
- Save/update the portfolio company name/number where supported.
- Explain upcoming statutory dates using returned official data.

### IDs & Credentials — Phase 3 / sensitive

The current app stores credential values inside the portfolio state. Sending those raw values through an LLM would materially expand their data exposure.

- List credential labels/status without raw values.
- Create/update/archive/reorder/delete credential records only after an explicit product decision on whether values may be sent to OpenAI.
- Revealing stored secret values should remain manual by default.

### Account, auth and billing — manual or tightly controlled

- Authentication, password reset and Google sign-in stay in the auth UI.
- Stripe checkout and billing portal should be explicit user-visible handoffs rather than silent Luna actions.
- Owner/admin entitlement changes should remain outside normal Luna access.
- Account-type switching can be added once the existing private-income confirmation flow is mirrored.
- Theme/accent are local UI preferences and can be added as UI actions later.

### Navigation, exports and local UI — Phase 2

- Navigate to any workspace.
- Open a property/tenant/expense/loan/contractor in its editor.
- Apply workspace filters/search.
- Export tabular reports/PDFs after an explicit user request.
- Open notification centre/settings.
- Toggle advanced property view and other purely local presentation preferences.

## Security and behaviour requirements

- All portfolio reads/writes remain authenticated and RLS-scoped to the current Supabase user.
- No service-role key is required by Luna for ordinary portfolio CRUD.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, and optional `OPENAI_BASE_URL` are server-only.
- No secrets are placed in `VITE_` variables.
- Destructive Phase-1 operations require explicit confirmation.
- A Free user cannot bypass the database-enforced one-property limit through Luna.
- Unsupported operations fail closed rather than becoming arbitrary JSON mutation.
- Luna must not claim a write succeeded before the deterministic capability returns success.
- Credentials and billing remain deliberately constrained until their data/authorization policy is explicitly widened.

## Owner setup after deployment

Add to Cloudflare Pages server environment:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-6-luna`
- optionally `OPENAI_BASE_URL=https://api.openai.com/v1`

No OpenAI secret is required in the browser build.
