# Quentin Finance Projections

A responsive React dashboard that turns the Quark Holdings BTL spreadsheet into an editable, dynamic portfolio model.

## What it includes

- Private, account-specific portfolios protected by database row-level security
- Google authentication and email/password account creation
- Property valuation, debt, equity, LTV, yield, ICR and remortgage calculations
- Portfolio rent, cost, tax, cashflow, total-gain and safety-buffer scenarios
- Editable assumptions for appreciation, rate shock, corporation tax, management fee and cash buffer
- A line-by-line Costs & Cash Flows workspace for property costs, company overheads and generic extractions
- Add, edit, clone, include/exclude and delete BTLs
- A spreadsheet-style comparison table and compliance/remortgage diary
- Secure cloud persistence through Supabase
- Responsive desktop and mobile layouts

The application bundle contains no portfolio seed data. Each signed-in user can only read and update the portfolio row attached to their own account.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open the local URL shown by Vite.

Create a Supabase project, run `supabase/schema.sql`, and put its project URL and publishable key in `.env.local`. Configure the production and local redirect URLs in Supabase Auth before testing OAuth.

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
- weighted portfolio interest rate and cash safety buffer

This is a planning tool, not financial or tax advice.
