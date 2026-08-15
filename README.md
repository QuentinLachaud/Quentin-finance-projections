# Quentin Finance Projections

A responsive React dashboard that turns the Quark Holdings BTL spreadsheet into an editable, dynamic portfolio model.

## What it includes

- Three active BTLs seeded from the `Quark Holdings Asset Information` dashboard
- Property valuation, debt, equity, LTV, yield, ICR and remortgage calculations
- Portfolio rent, cost, tax, cashflow, total-gain and safety-buffer scenarios
- Editable assumptions for appreciation, rate shock, corporation tax, management fee and cash buffer
- Add, edit, clone, include/exclude and delete BTLs
- A spreadsheet-style comparison table and compliance/remortgage diary
- Browser persistence through `localStorage`
- Responsive desktop and mobile layouts

Tenant contact details and mortgage account references are intentionally blank in the committed seed data. The fields remain available for local use and are stored only in the browser.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

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
- fixed, variable and engineered cost groupings
- taxable profit, tax, cashflow and total-gain scenarios
- weighted portfolio interest rate and cash safety buffer

This is a planning tool, not financial or tax advice.
