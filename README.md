# BTL Portfolio

A responsive React dashboard that turns the Quark Holdings BTL spreadsheet into an editable, dynamic portfolio model.

## What it includes

- Private, account-specific portfolios protected by database row-level security
- Google authentication and email/password account creation
- Property valuation, debt, equity, LTV, yield, ICR and remortgage calculations
- Portfolio rent, cost, tax, cashflow, total-gain and safety-buffer scenarios
- Editable assumptions for appreciation, rate shock, corporation tax, management fee and cash buffer
- 2026–27 private-landlord income-tax estimates for England and Scotland, including residential finance-cost relief
- An authenticated Companies House workspace for deadlines, filings, officers, PSCs and registered charges
- A line-by-line Costs & Cash Flows workspace for property costs, company overheads and generic extractions
- Add, edit, clone, include/exclude and delete BTLs
- A spreadsheet-style comparison table and compliance/remortgage diary
- Secure cloud persistence through Supabase
- Responsive desktop and mobile layouts
- Free and Pro entitlements, with one BTL on Free and unlimited BTLs on Pro
- Stripe Checkout, customer billing portal and signed subscription webhooks

The application bundle contains no portfolio seed data. Each signed-in user can only read and update the portfolio row attached to their own account.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open the local URL shown by Vite.

Create a Supabase project, run `supabase/schema.sql`, and put its project URL and publishable key in `.env.local`. Configure the production and local redirect URLs in Supabase Auth before testing OAuth.

For the Companies House workspace, create a free Companies House developer API key and add it to the Cloudflare Pages environment as `COMPANIES_HOUSE_API_KEY`. The key is used only by the server-side Pages Function. The function verifies the caller's Supabase session before proxying a request.

For billing, apply `supabase/migrations/20260816_account_entitlements.sql`, then configure the server-only variables listed in `.env.example` in Cloudflare Pages. Stripe should send Checkout and subscription events to `/api/stripe-webhook`. The service-role key, Stripe secret key and webhook secret must never be exposed as `VITE_` variables. Free accounts see their real one-property calculations throughout the app; the product deliberately does not display dummy financial data or masked placeholders.

## Verify

```bash
npm test
npm run build
```

## Calculation model

The calculation engine mirrors the relationships used by the Google Sheet dashboard, including:

- monthly interest-only mortgage payment from loan balance and shocked rate
- current and projected remortgage LTV
- gross and net yield
- equity available at 75% LTV
- interest coverage ratio
- editable property, company, variable and extraction groupings
- taxable profit, tax, cashflow and total-gain scenarios
- England and Scotland private-landlord income tax using the current 2026–27 bands and personal-allowance taper
- residential mortgage finance costs treated as a basic-rate tax reduction rather than a rental-profit deduction
- weighted portfolio interest rate and cash safety buffer

This is a planning tool, not financial or tax advice.
## Notifications and Web Push

The in-app reminder centre works from the dates already stored in each portfolio. Remortgage reminders open three calendar months before the next remortgage/end-of-fix date; gas, EICR, PAT and EPC reminders open 14 days before expiry. In-app reminders default on. Web Push is separate and opt-in.

To enable push in a deployment:

1. Apply `supabase/migrations/20260904_notifications_push.sql` to the Supabase project. It creates server-only subscription/delivery tables and an hourly `pg_cron` + `pg_net` job.
2. Run `npm run push:keys` once. Set the printed public key as both `VITE_PUSH_VAPID_PUBLIC_KEY` (build-time client value) and `PUSH_VAPID_PUBLIC_KEY` (server value), and set the private key only as `PUSH_VAPID_PRIVATE_KEY` in Cloudflare Pages. Set `PUSH_VAPID_SUBJECT` to a `mailto:` address or HTTPS site URL. Never expose the private key as a `VITE_` variable.
3. Generate a long random `NOTIFICATION_DISPATCH_SECRET` and set it in Cloudflare Pages.
4. Store the dispatch URL and the same secret in Supabase Vault. The installed cron job starts making calls automatically once both names exist:

```sql
select vault.create_secret('https://btlportfolio.co.uk/api/push-dispatch', 'notification_dispatch_url');
select vault.create_secret('replace-with-the-same-long-random-secret', 'notification_dispatch_secret');
```

The cron endpoint checks Europe/London time and only sends during 09:00-17:59. It records one successful delivery claim per reminder/snooze cycle, uses low Web Push urgency, collapses duplicate device notifications, and removes subscriptions reported gone by the push service. An authorised manual test can POST to `/api/push-dispatch?force=1` with the `x-notification-dispatch-secret` header.
