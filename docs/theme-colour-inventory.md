# BTL Portfolio colour inventory

This file is the maintained colour contract for the application. It has two purposes:

1. Define **which visual roles are allowed to follow the user's selected theme**.
2. Record **every CSS selector that currently contains a colour-bearing declaration**, so future work can audit coverage instead of recolouring arbitrary individual elements.

The generated appendix is rebuilt by the Brain Drain task from the final `src/styles.css` and `src/theme.css` contents.

## Design rules

- **Theme colour is environmental, not semantic.** It changes product identity, canvas tint, cards, panels, sidebar, controls, highlights and non-semantic visualisation.
- **Financial sign is immutable.** Positive values are green; negative values are red.
- **Status is immutable.** Warnings/errors/danger retain amber/red semantics.
- **Safety Cash Buffer is semantic.** Its red/amber/green health colouring is independent of theme.
- **Scenario severity is semantic.** Conservative / No voids / No repairs-or-voids retain their red/amber/green scenario palette.
- **Remortgage interest rate is a deliberate special identity.** Its orange treatment remains orange.
- **Theme tint must remain restrained.** Surfaces receive low-chroma tint; saturated accent is reserved for selected controls, focus, small highlights and data bars.

## Curated component policy

| Component family | Representative selectors | Theme behaviour |
|---|---|---|
| Page canvas | `body`, `.app-shell`, `main` | Very subtle hue in the background canvas. |
| Top chrome | `.topbar`, `.mobile-bottom-nav` | Near-neutral surface carrying a light theme tint. |
| Sidebar | `.sidebar`, `.sidebar-model-inputs`, `.sidebar-profile-editor`, `.sidebar-plan` | Deep near-black version of selected hue; selected item gets accent edge/highlight. |
| Product brand | `.brand > span`, kickers/eyebrows | Accent colour; no financial meaning. |
| General panels | `.panel` | Lightly tinted surface and theme-aware border/shadow. |
| KPI cards | `.metric-card`, `.metric-card.green`, `.metric-card.dark` | Surface family follows theme; numbers themselves are not recoloured by theme. |
| Property cards | `.property-card`, `.property-index` | Card hue follows theme; small identity badge uses accent. |
| Property tables | `.property-group-panel`, `.data-table` | Headers/sticky cells use themed neutral surfaces. |
| Advanced fields | `.advanced-metric-label`, `.mobile-property-row.advanced` | Subtle accent wash and left edge; never an `ADV` badge. |
| Asset Financing / LTV | `.asset-value-bar`, `.asset-loan-bar`, `.asset-track`, `.asset-ltv-label` | Theme-coloured non-semantic bars; label remains high-contrast. |
| Equity bars | `.equity-bar`, `.equity-bar i`, legacy `.bar-values` | Track uses theme-neutral tint; fill uses selected accent. |
| Forms/focus | form fields, `.money-input`, editors | Neutral surfaces; focus ring and border follow accent. |
| Primary actions | `.primary-button`, active segmented controls, switches | Selected accent with accessible contrast. |
| Drawers/modals | `.drawer`, `.setup-modal`, `.tenant-editor`, `.expense-modal`, `.settings-modal`, remortgage modals | Same canvas/surface hierarchy as page, not arbitrary fixed green. |
| Tenant cards | `.tenant-card` | General card surface follows theme; tenancy status chips remain semantic. |
| Expenses | `.expense-summary`, filters/table surfaces | General surfaces follow theme; income/expense values remain green/red. |
| Costs & cash flow | `.property-cost-card`, `.cashflow-editor`, reconciliation surfaces | Structural surfaces follow theme; income/cost totals remain semantic. |
| Companies House | `.ch-*` panels and neutral icons | General surfaces/highlights follow theme; active/warning/error statuses remain semantic. |
| Banking | `.bank-*` panels and neutral selection controls | General product UI follows theme; inflow/outflow/positive/negative chart semantics stay fixed. |
| Billing | `.billing-mark`, `.pricing-card.featured`, feature icons | Product identity follows theme; success/error messages remain semantic. |
| Remortgage cards | `.remortgage-comparison`, `.remortgage-scenario-card` | Card/surface/control theme follows selected hue. |
| Remortgage cash flow | `.remortgage-*-cash*` | Positive absolute/change values green; negative values red. |
| Remortgage rates | `.remortgage-*-rate*` | Dedicated orange identity; never theme-coloured. |
| Safety Cash Buffer | `.buffer-ring`, `.buffer-lines` | Red/amber/green health semantics; never theme-coloured. |
| Projection scenarios | `.scenario`, `--scenario`, projection legend/series | Scenario red/amber/green meaning retained; not theme-coloured. |
| Warning/danger | `.urgent`, `.warning`, `.error`, `.danger-button`, delete actions | Semantic amber/red retained. |

## Fixed semantic colour contract

| Meaning | Light | Dark | Examples |
|---|---|---|---|
| Positive financial value | `#27795c` | green high-contrast variant | cash flow, income, positive deltas |
| Negative financial value | `#b54b41` | red high-contrast variant | costs/losses, negative deltas |
| Warning | amber | amber high-contrast variant | urgent dates, warnings |
| Error/danger | red | red high-contrast variant | errors, destructive actions |
| Remortgage interest rate | dedicated orange | dedicated light orange | current/new deal rate |
| Scenario severity | scenario-owned red/amber/green | scenario-owned variants | projection/cash-flow scenarios |
| Buffer health | buffer-owned red/amber/green | buffer-owned variants | Safety Cash Buffer |

## Automatically captured colour-bearing selectors

- `styles.css :: .accent-choice` — `background: var(--ui-surface-subtle); color: var(--ui-text);`
- `styles.css :: .accent-choice small` — `color: var(--ui-muted);`
- `styles.css :: .accent-choice.selected` — `border-color: var(--ui-accent); box-shadow: 0 0 0 2px var(--ui-focus);`
- `styles.css :: .accent-choice:hover` — `background: var(--ui-surface-muted); border-color: var(--ui-line-strong);`
- `styles.css :: .accent-swatch` — `background: var(--accent-swatch); box-shadow: 0 0 0 1px rgba(24, 34, 29, .14); color: #fff;`
- `styles.css :: .account-type-toggle button.active` — `color: #eafff4;`
- `styles.css :: .add-property-card:hover` — `border-color: var(--green);`
- `styles.css :: .app-status-screen p` — `color: var(--ui-muted);`
- `styles.css :: .archived-tenants > summary small` — `color: #87918c;`
- `styles.css :: .asset-mobile-chevron` — `background: #edf4f0; color: #446157;`
- `styles.css :: .asset-mobile-toggle` — `background: transparent; color: #27342e;`
- `styles.css :: .asset-mobile-toggle small` — `color: #84908a;`
- `styles.css :: .asset-mobile-track .asset-ltv-label` — `color: #fff;`
- `styles.css :: .asset-numbers small` — `color: #7b8580;`
- `styles.css :: .asset-value-bar` — `background: #d9efe3;`
- `styles.css :: .assumptions-grid .model-help::after` — `color: #3e4b45;`
- `styles.css :: .assumptions-grid b` — `color: #89928e;`
- `styles.css :: .auth-card form label div:focus-within` — `border-color: #6dab8e;`
- `styles.css :: .auth-message.error` — `color: #9f3f39;`
- `styles.css :: .auth-message.success` — `color: #176047;`
- `styles.css :: .auth-promise .kicker` — `color: #8ed8b5;`
- `styles.css :: .auth-submit:hover` — `background: #145a42;`
- `styles.css :: .axis` — `stroke: #dfe5e1;`
- `styles.css :: .balance-chart text, .cashflow-chart text` — `fill: #7c8882;`
- `styles.css :: .balance-line` — `fill: none;`
- `styles.css :: .bank-account > header input:checked + i` — `border-color: #27795c;`
- `styles.css :: .bank-account > small` — `color: #89938e;`
- `styles.css :: .bank-account > span` — `color: #78857f;`
- `styles.css :: .bank-account.selected` — `border-color: #7aa58f;`
- `styles.css :: .bank-average-grid article > span` — `color: #77847d;`
- `styles.css :: .bank-average-grid p b` — `color: inherit;`
- `styles.css :: .bank-chart-legend .inflow::before` — `background: #4e9c79;`
- `styles.css :: .bank-chart-legend .outflow::before` — `background: #cf766c;`
- `styles.css :: .bank-metric small` — `color: #8a948f;`
- `styles.css :: .bank-metric span` — `color: #7d8882;`
- `styles.css :: .bank-metric.dark` — `color: #f1faf5;`
- `styles.css :: .bank-metric.dark span, .bank-metric.dark small` — `color: #9fb1a8;`
- `styles.css :: .bank-metric.negative strong, .bank-average-grid .negative` — `color: #a84f47;`
- `styles.css :: .bank-metric.positive strong, .bank-average-grid .positive` — `color: #247253;`
- `styles.css :: .bank-picker-grid button:hover` — `border-color: #75a68f;`
- `styles.css :: .bank-picker-grid small` — `color: #84908b;`
- `styles.css :: .bank-setup-note small` — `color: #8c7557;`
- `styles.css :: .bank-transaction-table td` — `color: #58645e;`
- `styles.css :: .bank-transaction-table td.negative` — `color: #a44d46;`
- `styles.css :: .bank-transaction-table td.positive` — `color: #237352;`
- `styles.css :: .bank-transaction-table th` — `color: #77837d;`
- `styles.css :: .bar-group small` — `color: #737c79;`
- `styles.css :: .bar-values i` — `background: #293d36;`
- `styles.css :: .bar-values span` — `background: #79c09c;`
- `styles.css :: .billing-message.error` — `color: #9c4039;`
- `styles.css :: .billing-message.success` — `color: #176047;`
- `styles.css :: .brand > .brand-copy small` — `color: #7f8b86;`
- `styles.css :: .brand > .brand-copy strong` — `color: #f2f7f4;`
- `styles.css :: .brand small` — `color: #88948f;`
- `styles.css :: .buffer-lines .ok` — `color: var(--green);`
- `styles.css :: .buffer-lines .warn` — `color: #b75837;`
- `styles.css :: .buffer-lines p span` — `color: #7c8581;`
- `styles.css :: .cashflow-editor > header h2 small` — `color: #8a938f;`
- `styles.css :: .cashflow-enabled input:checked + i` — `color: white;`
- `styles.css :: .cashflow-line > label > input:focus, .cashflow-line > label > select:focus` — `border-color: #72ad91;`
- `styles.css :: .cashflow-line > label > span` — `color: #7a8580;`
- `styles.css :: .cashflow-line-fields > label > input, .cashflow-line-fields > label > select` — `background: #fbfcfb;`
- `styles.css :: .cashflow-line-fields > label > input:focus, .cashflow-line-fields > label > select:focus` — `border-color: #72ad91;`
- `styles.css :: .cashflow-line-fields > label > span` — `color: #7a8580;`
- `styles.css :: .ch-deadline.due-soon > svg, .ch-deadline.due-soon > small` — `color: #ad7229;`
- `styles.css :: .ch-deadline.overdue > svg, .ch-deadline.overdue > small` — `color: #a94740;`
- `styles.css :: .ch-list-panel article > svg` — `color: #73917f;`
- `styles.css :: .ch-list-panel article em` — `color: #8a6b35;`
- `styles.css :: .ch-list-panel article small` — `color: #84908a;`
- `styles.css :: .ch-metrics-grid article > small` — `color: #87918c;`
- `styles.css :: .ch-metrics-grid article > span` — `color: #75817b;`
- `styles.css :: .ch-profile-grid b` — `color: #39453f;`
- `styles.css :: .ch-profile-grid span` — `color: #84908a;`
- `styles.css :: .ch-search-results b` — `color: #25322c;`
- `styles.css :: .ch-search-results button:hover` — `background: #f2f8f4;`
- `styles.css :: .ch-search-results small` — `color: #7d8983;`
- `styles.css :: .ch-setup-needed > svg` — `color: #bd7b2c;`
- `styles.css :: .ch-status.active` — `color: #176047;`
- `styles.css :: .ch-status.warning` — `color: #9c5635;`
- `styles.css :: .cost-category > label > b` — `color: #4f5b55;`
- `styles.css :: .cost-category.income` — `background: #f2f8f4;`
- `styles.css :: .cost-category.income > span` — `color: #2a775a;`
- `styles.css :: .credential-drag` — `color: #98a39d;`
- `styles.css :: .credential-field > input` — `color: var(--ui-text);`
- `styles.css :: .credential-field > input, .credential-value-input` — `background: var(--ui-surface-subtle);`
- `styles.css :: .credential-field > input:focus, .credential-value-input:focus-within` — `border-color: #8ebaa6; box-shadow: 0 0 0 3px var(--ui-focus);`
- `styles.css :: .credential-field > span` — `color: var(--ui-muted);`
- `styles.css :: .credential-icon-action` — `background: transparent; color: #748079;`
- `styles.css :: .credential-icon-action.danger:hover` — `background: rgba(181, 75, 65, .08); color: var(--ui-danger);`
- `styles.css :: .credential-icon-action:hover` — `background: var(--ui-surface-muted); color: var(--ui-text);`
- `styles.css :: .credential-row` — `background: var(--ui-surface); box-shadow: 0 1px 2px rgba(22, 39, 31, .025);`
- `styles.css :: .credential-row:hover` — `border-color: var(--ui-line-strong);`
- `styles.css :: .credential-value-input input` — `background: transparent; color: var(--ui-text);`
- `styles.css :: .credentials-archive > summary small, .credentials-archive > summary > span:last-child` — `color: var(--ui-muted);`
- `styles.css :: .credentials-archive > summary:hover` — `background: var(--ui-surface-subtle);`
- `styles.css :: .credentials-archive-empty` — `color: var(--ui-muted);`
- `styles.css :: .credentials-archive-list` — `background: var(--ui-surface-subtle);`
- `styles.css :: .credentials-archive-list .credential-row` — `box-shadow: none;`
- `styles.css :: .credentials-empty` — `box-shadow: none;`
- `styles.css :: .credentials-empty > svg` — `color: var(--ui-accent);`
- `styles.css :: .credentials-empty p` — `color: var(--ui-muted);`
- `styles.css :: .credentials-footnote` — `color: var(--ui-muted);`
- `styles.css :: .credentials-search` — `background: var(--ui-surface);`
- `styles.css :: .credentials-search input` — `background: transparent; color: var(--ui-text);`
- `styles.css :: .credentials-search svg` — `color: #86928c;`
- `styles.css :: .credentials-search:focus-within` — `border-color: #8ebaa6; box-shadow: 0 0 0 3px var(--ui-focus);`
- `styles.css :: .credentials-summary > div` — `background: var(--ui-surface); color: var(--ui-muted);`
- `styles.css :: .credentials-summary > div b` — `color: var(--ui-text);`
- `styles.css :: .credentials-summary > div svg` — `color: var(--ui-accent);`
- `styles.css :: .credentials-toolbar p` — `color: var(--ui-muted);`
- `styles.css :: .danger-button` — `color: #b8443b;`
- `styles.css :: .dark .metric-top` — `color: #8d9993;`
- `styles.css :: .data-table tbody tr:hover td, .data-table tbody tr:hover th` — `background: #f1f6f2;`
- `styles.css :: .data-table tbody tr:hover td, .data-table tbody tr:hover th:not(.advanced-metric-label)` — `background: var(--ui-surface-subtle);`
- `styles.css :: .data-table td.money-negative` — `color: #ac5148;`
- `styles.css :: .data-table td.money-positive` — `color: var(--green);`
- `styles.css :: .data-table th button small` — `color: #8b9490;`
- `styles.css :: .date-badge.urgent` — `background: #fff0e5;`
- `styles.css :: .dot.equity` — `background: #cce9da;`
- `styles.css :: .dot.loan` — `background: #263b34;`
- `styles.css :: .dot.value` — `background: #76bc99;`
- `styles.css :: .empty-cashflow, .ch-empty, .expenses-empty, .bank-empty-chart` — `color: var(--ui-muted);`
- `styles.css :: .expense-mobile-fields label > span` — `color: var(--muted);`
- `styles.css :: .expense-mobile-summary-main > span` — `color: #87918c;`
- `styles.css :: .expense-modal input:focus, .expense-modal textarea:focus` — `border-color: #72ad91;`
- `styles.css :: .expense-modal label > span` — `color: #5f6c65;`
- `styles.css :: .expense-modal-money:focus-within` — `border-color: #72ad91;`
- `styles.css :: .expense-modal-type button.active` — `color: #fff;`
- `styles.css :: .expense-receipt-field a:hover` — `color: var(--ink);`
- `styles.css :: .expense-summary.expense strong` — `color: #b35c54;`
- `styles.css :: .expense-summary.income strong` — `color: #27795c;`
- `styles.css :: .expense-transfer-export > small` — `color: var(--muted);`
- `styles.css :: .expense-transfer-export > span` — `color: var(--muted);`
- `styles.css :: .expense-transfer-export button` — `background: var(--white); color: #405149;`
- `styles.css :: .expense-transfer-primary` — `background: #f0f7f3; color: #245742;`
- `styles.css :: .expense-transfer-primary small` — `color: #728078;`
- `styles.css :: .expense-transfer-sheet` — `background: var(--white); box-shadow: 0 -12px 40px rgba(10, 20, 15, .18);`
- `styles.css :: .expense-transfer-sheet p` — `color: var(--muted);`
- `styles.css :: .expense-type.expense` — `color: #8c3f39;`
- `styles.css :: .expense-type.income` — `color: #176347;`
- `styles.css :: .expense-type.neutral, .expense-type.unspecified` — `color: var(--muted);`
- `styles.css :: .expenses-filter-fields .expenses-clear` — `background: var(--white);`
- `styles.css :: .expenses-filter-panel label > span` — `color: var(--muted);`
- `styles.css :: .expenses-table tbody tr:hover` — `background: #fafcfb;`
- `styles.css :: .form-grid input:focus` — `border-color: #66a98c;`
- `styles.css :: .form-section` — `background: white;`
- `styles.css :: .google-auth-button:hover` — `border-color: #aebbb4;`
- `styles.css :: .green .metric-top` — `color: #3f7b63;`
- `styles.css :: .hero-context > span` — `background: var(--ui-surface); color: var(--ui-muted);`
- `styles.css :: .hero-context b` — `color: var(--ui-text);`
- `styles.css :: .hero-row p` — `color: var(--muted); color: var(--ui-muted);`
- `styles.css :: .icon-button:hover` — `background: #eff2ef; background: var(--ui-surface-muted);`
- `styles.css :: .inflow-bar` — `fill: #4e9c79;`
- `styles.css :: .metric-card` — `background: white; box-shadow: var(--ui-shadow);`
- `styles.css :: .metric-card small` — `color: #8a928f;`
- `styles.css :: .metric-card.dark` — `background: var(--sidebar);`
- `styles.css :: .metric-card.green` — `background: #e9f5ee;`
- `styles.css :: .metric-top` — `color: #7d8883;`
- `styles.css :: .mobile-asset-row .asset-mobile-toggle:active` — `background: #f2f6f3;`
- `styles.css :: .mobile-asset-row .asset-numbers span` — `background: #f6f8f6;`
- `styles.css :: .mobile-bottom-nav button.active` — `color: #176047;`
- `styles.css :: .mobile-buffer-header-toggle` — `background: transparent; color: inherit;`
- `styles.css :: .mobile-buffer-toggle` — `color: inherit;`
- `styles.css :: .mobile-buffer-toggle small` — `color: #7e8983;`
- `styles.css :: .mobile-expand-cue` — `background: #edf5f1; color: #336650;`
- `styles.css :: .mobile-expense-filter-toggle` — `background: var(--white); color: #56645d;`
- `styles.css :: .mobile-expense-filter-toggle b` — `background: var(--green); color: #fff;`
- `styles.css :: .mobile-line-summary > strong` — `color: var(--green);`
- `styles.css :: .mobile-menu:active` — `background: #eef2ef;`
- `styles.css :: .mobile-nav-close:hover` — `color: white;`
- `styles.css :: .mobile-property-context span` — `color: #7a8580;`
- `styles.css :: .mobile-property-edit` — `background: #edf6f1; color: var(--green);`
- `styles.css :: .mobile-property-empty` — `color: #87918c;`
- `styles.css :: .mobile-property-row > span` — `color: #6d7873;`
- `styles.css :: .mobile-property-row > strong` — `color: #28342f;`
- `styles.css :: .mobile-property-row > strong.money-negative` — `color: #ac5148;`
- `styles.css :: .mobile-property-row > strong.money-positive` — `color: var(--green);`
- `styles.css :: .mobile-property-row.advanced` — `background:
      linear-gradient(90deg, rgba(28, 107, 80, .10), rgba(28, 107, 80, .035) 72%, rgba(28, 107, 80, 0)),
      #fafbf9; box-shadow: inset 3px 0 #8bbda6; color: #456257;`
- `styles.css :: .mobile-property-row.advanced > span` — `color: #456257;`
- `styles.css :: .mobile-property-segments` — `background: #ecefec;`
- `styles.css :: .mobile-property-segments button` — `background: transparent; color: #6c7772;`
- `styles.css :: .mobile-property-segments button.active` — `background: #fff; box-shadow: 0 1px 4px rgba(20, 32, 27, .13); color: #1f2c26;`
- `styles.css :: .mobile-property-switcher` — `background: #fff;`
- `styles.css :: .mobile-remortgage-action-label` — `color: var(--ui-muted, #77837e);`
- `styles.css :: .mobile-remortgage-close` — `background: #fff; color: #5f6d66;`
- `styles.css :: .mobile-remortgage-cost-strip` — `background: var(--ui-surface-subtle);`
- `styles.css :: .mobile-remortgage-cost-strip > svg` — `color: var(--ui-muted);`
- `styles.css :: .mobile-remortgage-cost-strip small` — `color: var(--ui-muted);`
- `styles.css :: .mobile-remortgage-cost-strip span` — `color: var(--ui-accent);`
- `styles.css :: .mobile-remortgage-cost-strip strong` — `color: var(--ui-text);`
- `styles.css :: .mobile-remortgage-decision-copy small` — `color: var(--ui-muted);`
- `styles.css :: .mobile-remortgage-decision-row` — `background: var(--ui-surface-subtle); color: var(--ui-text);`
- `styles.css :: .mobile-remortgage-decision-row > strong` — `color: var(--ui-text);`
- `styles.css :: .mobile-remortgage-decision-row:active` — `background: var(--ui-surface-muted);`
- `styles.css :: .mobile-remortgage-derived` — `background: #fff;`
- `styles.css :: .mobile-remortgage-derived dt` — `color: #7c8882;`
- `styles.css :: .mobile-remortgage-detail-row` — `background: transparent; color: var(--ui-text);`
- `styles.css :: .mobile-remortgage-detail-row > small` — `color: #1c6b50;`
- `styles.css :: .mobile-remortgage-detail-row > span` — `color: var(--ui-muted);`
- `styles.css :: .mobile-remortgage-detail-row.editable:active` — `background: var(--ui-surface-muted);`
- `styles.css :: .mobile-remortgage-details` — `background: #fff;`
- `styles.css :: .mobile-remortgage-details > summary small` — `color: #7b8781;`
- `styles.css :: .mobile-remortgage-details > summary svg` — `color: #5e7168;`
- `styles.css :: .mobile-remortgage-field-layer` — `background: rgba(13, 22, 18, .52);`
- `styles.css :: .mobile-remortgage-field-modal` — `background: var(--ui-surface); box-shadow: 0 18px 60px rgba(8, 18, 13, .22);`
- `styles.css :: .mobile-remortgage-field-modal > header small` — `color: var(--ui-muted);`
- `styles.css :: .mobile-remortgage-focused-input` — `background: var(--ui-surface-subtle); box-shadow: 0 0 0 3px rgba(39, 121, 92, .08);`
- `styles.css :: .mobile-remortgage-focused-input b` — `color: var(--ui-muted);`
- `styles.css :: .mobile-remortgage-focused-input input` — `background: transparent; color: var(--ui-text);`
- `styles.css :: .mobile-remortgage-modal` — `background: #f8faf8; box-shadow: 0 24px 70px rgba(8, 18, 13, .30); color: #27332e;`
- `styles.css :: .mobile-remortgage-modal > header small` — `color: #77847d;`
- `styles.css :: .mobile-remortgage-primary-fields .remortgage-field > div` — `background: #fff;`
- `styles.css :: .mobile-remortgage-property-title` — `color: var(--ui-text, #24312b);`
- `styles.css :: .mobile-remortgage-rate-hero` — `background: color-mix(in srgb, var(--remortgage-rate-accent) 5%, #fff); color: #4f5d56;`
- `styles.css :: .mobile-remortgage-rate-hero > span` — `color: #718078;`
- `styles.css :: .mobile-remortgage-result-row dt` — `color: #7f8b85;`
- `styles.css :: .mobile-remortgage-step` — `background: #185c47; color: #fff;`
- `styles.css :: .mobile-scenario-toggle-enabled .overview-scenario-toggle` — `background: #ecefec;`
- `styles.css :: .mobile-scenario-toggle-enabled[data-mobile-scenario="0"] .scenario-0, .mobile-scenario-toggle-enabled[data-mobile-scenario="1"] .scenario-1, .mobile-scenario-toggle-enabled[data-mobile-scenario="2"] .scenario-2` — `background: #fff;`
- `styles.css :: .model-controls label.selected` — `color: #145840;`
- `styles.css :: .model-controls label.selected > i` — `background: #1c6b50;`
- `styles.css :: .money-input:focus-within` — `border-color: #72ad91;`
- `styles.css :: .negative` — `color: #b54b41;`
- `styles.css :: .net-dot` — `fill: #fff;`
- `styles.css :: .net-line` — `fill: none;`
- `styles.css :: .not-applicable-row` — `color: #9aa29e !important;`
- `styles.css :: .not-applicable-row > *` — `color: #9aa29e !important;`
- `styles.css :: .outflow-bar` — `fill: #cf766c;`
- `styles.css :: .overview-property-card .property-card-edit` — `background: #f7f9f7;`
- `styles.css :: .overview-property-card .property-map .property-map-hit` — `background: transparent; box-shadow: none;`
- `styles.css :: .overview-property-card .property-map .property-map-hit:hover` — `background: transparent;`
- `styles.css :: .overview-scenario-toggle button` — `background: transparent; color: #68736e;`
- `styles.css :: .overview-scenario-toggle button.active` — `background: #fff; box-shadow: 0 1px 4px rgba(20, 32, 27, .13); color: #26322d;`
- `styles.css :: .owner-access-panel > header > svg` — `color: #27795c;`
- `styles.css :: .panel` — `background: var(--ui-surface); background: white; border-color: var(--ui-line); box-shadow: var(--ui-shadow);`
- `styles.css :: .panel-stat` — `background: #f0f3ef;`
- `styles.css :: .per-flat-toggle input:checked + i` — `background: #1c6b50;`
- `styles.css :: .positive` — `color: var(--green);`
- `styles.css :: .pricing-card > span` — `color: #65736c;`
- `styles.css :: .primary-button` — `background: #185c47; box-shadow: 0 3px 10px rgba(16, 89, 65, .13);`
- `styles.css :: .primary-button:hover` — `background: #104b3a; background: #104f3c;`
- `styles.css :: .private-tax-inputs > header b` — `color: #294038;`
- `styles.css :: .private-tax-inputs > label > small` — `color: #839089;`
- `styles.css :: .private-tax-inputs > label > span, .tax-jurisdiction > span` — `color: #596860;`
- `styles.css :: .private-tax-inputs.compact .private-income-field, .private-tax-inputs.compact .tax-jurisdiction > div` — `border-color: #35413c;`
- `styles.css :: .private-tax-inputs.compact .tax-input-warning` — `color: #e0b978;`
- `styles.css :: .private-tax-inputs.compact .tax-jurisdiction button.active` — `background: #28523f;`
- `styles.css :: .private-tax-inputs.compact > header b` — `color: #edf4f0;`
- `styles.css :: .private-tax-inputs.compact > header small, .private-tax-inputs.compact > label > small` — `color: #708079;`
- `styles.css :: .private-tax-inputs.compact > label > span, .private-tax-inputs.compact .tax-jurisdiction > span` — `color: #9ca7a2;`
- `styles.css :: .private-tax-inputs.compact input` — `color: #f1f6f3;`
- `styles.css :: .private-tax-scenarios article > small` — `color: #86908b;`
- `styles.css :: .private-tax-scenarios article > span` — `color: var(--scenario);`
- `styles.css :: .private-tax-scenarios dt` — `color: #74807a;`
- `styles.css :: .projection-chart .grid-line` — `stroke: #e8ece9;`
- `styles.css :: .projection-chart text` — `fill: #78827d;`
- `styles.css :: .projection-table thead th` — `color: var(--scenario, #53605a);`
- `styles.css :: .projection-table-toggle small` — `color: #87908c;`
- `styles.css :: .projections-scenarios .scenario > div:first-child small` — `color: #7d8882;`
- `styles.css :: .property-card` — `background: white; box-shadow: var(--ui-shadow);`
- `styles.css :: .property-card p` — `color: #87908c;`
- `styles.css :: .property-cards .add-property-card` — `background: #edf7f1; color: #185c47;`
- `styles.css :: .property-cards .add-property-card > span` — `border-color: #bcd9ca;`
- `styles.css :: .property-cost-card > header > b small` — `color: #89928e;`
- `styles.css :: .property-cost-card > header span` — `color: var(--green);`
- `styles.css :: .property-cost-summary > b small` — `color: #89928e;`
- `styles.css :: .property-cost-summary > div > span` — `color: var(--green);`
- `styles.css :: .property-group-chevron` — `background: #fff; color: #68746e;`
- `styles.css :: .property-group-panel .data-table tbody tr:hover th.advanced-metric-label` — `background:
    linear-gradient(90deg, rgba(28, 107, 80, .14), rgba(28, 107, 80, .055) 72%, rgba(28, 107, 80, 0)),
    #f1f6f2;`
- `styles.css :: .property-group-panel .mobile-property-group-list` — `background: #fff;`
- `styles.css :: .property-group-panel.amber .group-marker` — `background: #d4a260;`
- `styles.css :: .property-group-panel.green .group-marker` — `background: #6aae8c;`
- `styles.css :: .property-group-panel.ink .group-marker` — `background: #33473f;`
- `styles.css :: .property-group-toggle` — `background: transparent; color: inherit;`
- `styles.css :: .property-group-toggle p` — `color: var(--ui-muted);`
- `styles.css :: .property-group-toggle:hover` — `background: #f5f8f5;`
- `styles.css :: .property-map .property-map-hit` — `background: transparent; box-shadow: none;`
- `styles.css :: .property-map .property-map-hit:hover` — `background: transparent;`
- `styles.css :: .property-map a:hover` — `background: #fff;`
- `styles.css :: .property-mobile-disclosure` — `background: #eef5f1; color: #315a49;`
- `styles.css :: .property-mobile-disclosure:active` — `background: #e4efe9;`
- `styles.css :: .property-mobile-expand` — `background: #f7f9f7; color: #4f5d56;`
- `styles.css :: .property-nav span small` — `color: #5f6a66;`
- `styles.css :: .property-nav-row.excluded .property-nav-visibility` — `background: #1e1816; background: transparent; border-color: #4a3935; color: #b58f87; color: inherit;`
- `styles.css :: .property-nav-row.excluded .property-nav-visibility:hover` — `background: #1a2520;`
- `styles.css :: .property-nav-visibility` — `background: #141d19; background: transparent; color: #91a39b; color: inherit;`
- `styles.css :: .property-nav-visibility > i` — `background: #4a5550; background: #59645f;`
- `styles.css :: .property-nav-visibility > i::after` — `background: #d7dfdb;`
- `styles.css :: .property-nav-visibility > span` — `color: inherit;`
- `styles.css :: .property-nav-visibility input:checked + i` — `background: #4b9f78;`
- `styles.css :: .property-nav-visibility input:checked + i::after` — `background: #fff;`
- `styles.css :: .property-nav-visibility:hover` — `background: #1a2520; border-color: #496057; color: #e9f4ee;`
- `styles.css :: .property-value span, .property-mini-grid span` — `color: #87908c;`
- `styles.css :: .property-view-choice` — `background: transparent; color: var(--ui-muted, #68756f);`
- `styles.css :: .property-view-choice.active` — `background: #185c47; box-shadow: 0 1px 3px rgba(21, 66, 51, .16); color: #fff;`
- `styles.css :: .property-view-choice:hover` — `background: var(--ui-surface-muted, #f1f5f2);`
- `styles.css :: .property-view-mode` — `background: #f7f9f6;`
- `styles.css :: .property-view-mode > span` — `color: #8a938f;`
- `styles.css :: .property-view-mode > span.active` — `color: #185c47;`
- `styles.css :: .property-view-switch i` — `background: #cbd4cf; box-shadow: inset 0 0 0 1px rgba(25,32,30,.07);`
- `styles.css :: .property-view-switch i::after` — `background: #fff; box-shadow: 0 1px 4px rgba(22,38,31,.22);`
- `styles.css :: .property-view-switch input:checked + i` — `background: #1c6b50;`
- `styles.css :: .rate-shock-stepper > button` — `background: #f5faf7; color: #205f49;`
- `styles.css :: .rate-shock-stepper > span small` — `color: #7b8781;`
- `styles.css :: .reconciliation-scenario-toggle button` — `background: #f8faf8; color: #65716b;`
- `styles.css :: .reconciliation-scenario-toggle button.active` — `background: #fff; border-color: var(--scenario); box-shadow: inset 0 0 0 1px var(--scenario); color: var(--scenario);`
- `styles.css :: .reconciliation-wrap tr.cost td` — `color: #a65048;`
- `styles.css :: .reconciliation-wrap tr.income td` — `color: var(--green);`
- `styles.css :: .reconciliation-wrap tr.subtotal` — `background: #f8faf8;`
- `styles.css :: .reconciliation-wrap tr.total` — `background: #edf6f1;`
- `styles.css :: .reconciliation-wrap tr.total th, .reconciliation-wrap tr.total td` — `color: #155c43;`
- `styles.css :: .remortgage-add label > span` — `color: #74807a;`
- `styles.css :: .remortgage-add select` — `background: #fff; color: #27332e;`
- `styles.css :: .remortgage-arrow` — `color: #6b8278;`
- `styles.css :: .remortgage-arrow svg` — `background: #f6f9f7;`
- `styles.css :: .remortgage-comparison-name` — `background: #fff;`
- `styles.css :: .remortgage-comparison-name > span` — `color: #7c8882;`
- `styles.css :: .remortgage-comparison-name input` — `background: transparent; color: #27332e;`
- `styles.css :: .remortgage-comparison-name input:focus` — `background: #fbfdfc; border-color: #b8d3c6;`
- `styles.css :: .remortgage-comparison.expanded .remortgage-summary-row` — `background: #fafbf9;`
- `styles.css :: .remortgage-comparison.is-dragging` — `box-shadow:
      0 20px 46px rgba(22, 39, 31, .22),
      0 5px 14px rgba(22, 39, 31, .11); box-shadow:
    0 18px 42px rgba(22, 39, 31, .18),
    0 4px 12px rgba(22, 39, 31, .10);`
- `styles.css :: .remortgage-difference-card` — `background: #f6f9f7;`
- `styles.css :: .remortgage-difference-card .equity-release-row dd.bad` — `color: #b54b41;`
- `styles.css :: .remortgage-difference-card .equity-release-row dd.good` — `color: #1c6b50;`
- `styles.css :: .remortgage-difference-card dd` — `color: #34423b;`
- `styles.css :: .remortgage-difference-card dt` — `color: #74807a;`
- `styles.css :: .remortgage-difference-card.negative .remortgage-impact strong` — `color: #b54b41;`
- `styles.css :: .remortgage-difference-card.positive .remortgage-impact strong` — `color: #1c6b50;`
- `styles.css :: .remortgage-empty` — `box-shadow: none;`
- `styles.css :: .remortgage-field > div` — `background: #fbfcfb;`
- `styles.css :: .remortgage-field > span, .remortgage-fee-heading > span` — `color: #647169;`
- `styles.css :: .remortgage-field b` — `color: #7e8a84;`
- `styles.css :: .remortgage-field input` — `background: transparent; color: #26342e;`
- `styles.css :: .remortgage-impact` — `background: #fff;`
- `styles.css :: .remortgage-impact small` — `color: #75817b;`
- `styles.css :: .remortgage-impact span` — `color: #6c7872;`
- `styles.css :: .remortgage-lock-icon` — `background: #e7f2ec; color: #1c6b50;`
- `styles.css :: .remortgage-reorder-handle` — `background: transparent; border-right-color: rgba(224, 229, 223, .72); color: #9aa49f;`
- `styles.css :: .remortgage-reorder-handle:active, .remortgage-comparison.is-dragging .remortgage-reorder-handle` — `background: rgba(28, 107, 80, .09); color: var(--green);`
- `styles.css :: .remortgage-reorder-handle:hover, .remortgage-reorder-handle:focus-visible` — `background: rgba(28, 107, 80, .055); color: var(--green);`
- `styles.css :: .remortgage-result-strip dd` — `color: #34423b;`
- `styles.css :: .remortgage-result-strip dt` — `color: #8a938f;`
- `styles.css :: .remortgage-scenario-card` — `background: #fff;`
- `styles.css :: .remortgage-scenario-card > header .remortgage-scenario-cashflow-metric` — `background: var(--ui-surface-subtle);`
- `styles.css :: .remortgage-scenario-card > header .remortgage-scenario-cashflow-metric > b` — `color: var(--ui-accent);`
- `styles.css :: .remortgage-scenario-card > header .remortgage-scenario-cashflow-metric > span, .remortgage-scenario-card > header .remortgage-scenario-manual-note` — `color: var(--ui-muted);`
- `styles.css :: .remortgage-scenario-card > header .remortgage-scenario-cost-metric > small, .remortgage-scenario-card > header .remortgage-scenario-cashflow-metric > small` — `color: var(--ui-muted);`
- `styles.css :: .remortgage-scenario-card > header .remortgage-scenario-cost-metric > strong` — `color: var(--ui-text);`
- `styles.css :: .remortgage-scenario-card > header > small` — `color: #8a938f;`
- `styles.css :: .remortgage-scenario-card > header span` — `color: #52625b;`
- `styles.css :: .remortgage-scenario-card > header strong` — `color: #1c6b50;`
- `styles.css :: .remortgage-scenario-card > header strong small` — `color: #7d8882;`
- `styles.css :: .remortgage-scenario-rate-metric > small` — `color: #7a8580;`
- `styles.css :: .remortgage-scenario-rate-metric > strong, .remortgage-summary-rate, .mobile-remortgage-rate-hero > strong, .remortgage-summary-mobile-rates b` — `color: var(--remortgage-rate-accent) !important;`
- `styles.css :: .remortgage-segmented` — `background: #f7f9f7;`
- `styles.css :: .remortgage-segmented button` — `background: transparent; color: #74807a;`
- `styles.css :: .remortgage-segmented button.active` — `background: #426f5d; color: #fff;`
- `styles.css :: .remortgage-summary-arrow` — `color: #8aa095;`
- `styles.css :: .remortgage-summary-chevron` — `background: #fff; color: #6f7b75;`
- `styles.css :: .remortgage-summary-difference` — `background: #f4f8f5; background: var(--ui-accent-soft);`
- `styles.css :: .remortgage-summary-difference.negative strong` — `color: #b54b41;`
- `styles.css :: .remortgage-summary-difference.positive strong` — `color: #1c6b50;`
- `styles.css :: .remortgage-summary-main` — `background: transparent; color: #27332e;`
- `styles.css :: .remortgage-summary-main:hover` — `background: #f7faf8;`
- `styles.css :: .remortgage-summary-mobile-cash > small:first-child` — `color: var(--ui-muted);`
- `styles.css :: .remortgage-summary-mobile-cash.negative` — `color: #b54b41;`
- `styles.css :: .remortgage-summary-mobile-cash.positive` — `color: #1c6b50;`
- `styles.css :: .remortgage-summary-mobile-costs b` — `color: var(--ui-text);`
- `styles.css :: .remortgage-summary-mobile-costs small` — `color: var(--ui-muted);`
- `styles.css :: .remortgage-summary-mobile-costs svg` — `color: var(--ui-muted);`
- `styles.css :: .remortgage-summary-mobile-name` — `color: #66736c;`
- `styles.css :: .remortgage-summary-mobile-rates` — `color: #27332e;`
- `styles.css :: .remortgage-summary-mobile-rates em` — `color: #69766f;`
- `styles.css :: .remortgage-summary-mobile-rates small` — `color: #7c8982;`
- `styles.css :: .remortgage-summary-mobile-rates svg` — `color: #7f948a; color: #87958e;`
- `styles.css :: .remortgage-summary-mortgage-cost` — `color: #52625b;`
- `styles.css :: .remortgage-summary-name small, .remortgage-summary-option small, .remortgage-summary-difference small` — `color: #84908a;`
- `styles.css :: .remortgage-summary-option > em` — `color: var(--ui-accent);`
- `styles.css :: .remortgage-summary-option > strong` — `color: var(--ui-text);`
- `styles.css :: .remortgage-summary-option span` — `color: #66736c;`
- `styles.css :: .remortgage-switch-row > i` — `background: #cbd4cf;`
- `styles.css :: .remortgage-switch-row > i::after` — `background: #fff;`
- `styles.css :: .remortgage-switch-row b` — `color: #52625b;`
- `styles.css :: .remortgage-switch-row input:checked + i` — `background: #1c6b50;`
- `styles.css :: .remortgage-switch-row small` — `color: #8a938f;`
- `styles.css :: .remortgage-toolbar > div:first-child > small` — `color: #8a938f;`
- `styles.css :: .remortgage-toolbar p, .remortgage-empty p, .remortgage-locked p` — `color: #74807a;`
- `styles.css :: .report-export-control > span` — `color: var(--muted);`
- `styles.css :: .report-export-control button` — `background: transparent; color: #52605a;`
- `styles.css :: .report-export-control button:hover:not(:disabled)` — `background: #edf6f1; color: var(--green);`
- `styles.css :: .save-status` — `background: var(--ui-surface);`
- `styles.css :: .save-status.error` — `background: #fff6f4; border-color: rgba(181, 75, 65, .25); color: #b14b43; color: var(--ui-danger);`
- `styles.css :: .save-status.saving` — `color: #9a732f;`
- `styles.css :: .scenario i` — `background: color-mix(in srgb, var(--scenario) 12%, white);`
- `styles.css :: .scenario-selector button` — `background: #fff; color: #69746f;`
- `styles.css :: .scenario-selector button.desktop-active` — `background: #fff; background: color-mix(in srgb, var(--scenario) 8%, #fff); border-color: color-mix(in srgb, var(--scenario) 45%, #dbe2de); border-color: var(--line); color: #69746f; color: var(--scenario);`
- `styles.css :: .scenario-selector button.mobile-active` — `background: color-mix(in srgb, var(--scenario) 8%, #fff); border-color: color-mix(in srgb, var(--scenario) 45%, #dbe2de); color: var(--scenario);`
- `styles.css :: .secondary-button` — `background: var(--ui-surface); background: white; border-color: var(--ui-line);`
- `styles.css :: .secondary-button:hover` — `background: var(--ui-surface-subtle); border-color: #b8c2bc; border-color: var(--ui-line-strong);`
- `styles.css :: .segmented button.active` — `background: #1c6b50;`
- `styles.css :: .settings-close` — `background: var(--ui-surface); color: var(--ui-muted);`
- `styles.css :: .settings-close:hover` — `background: var(--ui-surface-muted); border-color: var(--ui-line-strong); color: var(--ui-text);`
- `styles.css :: .settings-layer` — `background: rgba(8, 13, 11, .46);`
- `styles.css :: .settings-modal` — `background: var(--ui-surface); box-shadow: 0 24px 70px rgba(10, 18, 14, .20); color: var(--ui-text);`
- `styles.css :: .settings-modal > header p, .settings-section-copy p` — `color: var(--ui-muted);`
- `styles.css :: .setup-account-types > button.active` — `border-color: #67a88b;`
- `styles.css :: .setup-account-types b` — `color: #34413b;`
- `styles.css :: .setup-account-types small` — `color: #84908a;`
- `styles.css :: .setup-company-name input:focus` — `border-color: #69aa8d;`
- `styles.css :: .setup-company-name small` — `color: #8c9591;`
- `styles.css :: .sidebar nav > small` — `color: #65706c; color: #73807a;`
- `styles.css :: .sidebar nav button.active` — `background: #24332c; box-shadow: inset 3px 0 #78cfa7; color: #fff;`
- `styles.css :: .sidebar nav button:hover` — `color: white;`
- `styles.css :: .sidebar nav button[aria-current='page']` — `color: #fff;`
- `styles.css :: .sidebar-disclosure > summary` — `color: #8fddb9;`
- `styles.css :: .sidebar-disclosure > summary b` — `color: #edf4f0;`
- `styles.css :: .sidebar-disclosure > summary small` — `color: #7f8c86;`
- `styles.css :: .sidebar-disclosure > summary:hover` — `background: #1b2521;`
- `styles.css :: .sidebar-disclosure-body > .model-controls label.selected` — `color: #eafff4;`
- `styles.css :: .sidebar-disclosure-chevron` — `color: #728078;`
- `styles.css :: .sidebar-foot small` — `color: #68736f;`
- `styles.css :: .sidebar-input-list label > span` — `color: #9ca7a2;`
- `styles.css :: .sidebar-model-inputs > header b` — `color: #edf4f0;`
- `styles.css :: .sidebar-model-inputs > header small` — `color: #77837e;`
- `styles.css :: .sidebar-plan.pro` — `color: #dbf7e9;`
- `styles.css :: .sidebar-plan:hover` — `border-color: #638271;`
- `styles.css :: .sidebar-profile-editor .sidebar-disclosure-body > label > span` — `color: #9ca7a2;`
- `styles.css :: .sidebar-profile-editor .sidebar-disclosure-body > label input` — `background: #101614; color: #f1f6f3;`
- `styles.css :: .sidebar-profile-editor > header b` — `color: #edf4f0;`
- `styles.css :: .sidebar-profile-editor > label > span` — `color: #9ca7a2;`
- `styles.css :: .sidebar-profile-editor > label input:focus` — `border-color: #619a80;`
- `styles.css :: .sidebar-profile-editor > label small` — `color: #6f7b75;`
- `styles.css :: .sidebar-settings, .sidebar-signout` — `background: transparent; color: #85928c;`
- `styles.css :: .sidebar-settings:hover` — `background: color-mix(in srgb, var(--theme-accent-light) 8%, transparent); border-color: color-mix(in srgb, var(--theme-accent-light) 42%, #303a36); color: var(--theme-accent-light);`
- `styles.css :: .sidebar-signout:hover` — `background: #241a18; border-color: #5d3b38; color: #e28a82; color: #fff;`
- `styles.css :: .sidebar-support b` — `color: #f1dfb8;`
- `styles.css :: .sidebar-support:hover` — `border-color: #8a7038;`
- `styles.css :: .switch-label input:checked + i` — `background: var(--green);`
- `styles.css :: .tax-jurisdiction button.active` — `color: #fff;`
- `styles.css :: .tenant-card > header svg` — `color: #779087;`
- `styles.css :: .tenant-card dt` — `color: #87918c;`
- `styles.css :: .tenant-card.live` — `border-color: #cfe3d8;`
- `styles.css :: .tenant-delete` — `color: #9c514b;`
- `styles.css :: .tenant-editor select:focus, .tenant-editor input:focus` — `border-color: #6ba789;`
- `styles.css :: .tenant-status.archived` — `color: #65716b;`
- `styles.css :: .tenant-status.live` — `color: #226548;`
- `styles.css :: .text-button:hover` — `color: var(--green);`
- `styles.css :: .theme-toggle:hover` — `color: var(--green);`
- `styles.css :: .toggle-row input` — `accent-color: var(--green);`
- `styles.css :: .topbar span, .topbar b` — `color: #8d9592;`
- `styles.css :: .weighted-rate-card .rate-shock-stepper > button.decrease` — `background: #fff; color: #185c47;`
- `styles.css :: .weighted-rate-card .rate-shock-stepper > button.increase` — `background: #185c47; color: #fff;`
- `styles.css :: /* Advanced property metric labels */ .property-group-panel .data-table tbody th.advanced-metric-label` — `background:
    linear-gradient(90deg, rgba(28, 107, 80, .10), rgba(28, 107, 80, .035) 72%, rgba(28, 107, 80, 0)),
    #fafbf9; box-shadow: inset 3px 0 #8bbda6; color: #456257;`
- `styles.css :: /* Authentication */ .auth-card` — `box-shadow: 0 24px 70px rgba(18, 38, 29, .10);`
- `styles.css :: /* Brain Drain 2026-08-22 13:46 BST — orange deal-rate identity + eased remortgage results */ :root` — `--remortgage-rate-accent: #bd5a1d;`
- `styles.css :: /* Brain Drain: shared report export controls */ .report-export-control` — `background: var(--white);`
- `styles.css :: /* Clearer projections scenario card */ .projections-scenarios > header p` — `color: #74807a;`
- `styles.css :: /* Interface design system + usability audit Consolidates the previous readability overrides into one intentional layer. */ :root` — `--ui-accent-soft: #e7f3ed; --ui-accent: #1c6b50; --ui-line-strong: #cbd5cf; --ui-line: #dde4df; --ui-shadow: 0 1px 2px rgba(22, 39, 31, .035), 0 8px 26px rgba(22, 39, 31, .035); --ui-surface-muted: #f1f5f2; --ui-surface-subtle: #f8faf8; --ui-surface: #ffffff;`
- `styles.css :: /* Mobile editing is a compact modal; saved values are untouched until Save Changes. */ .mobile-remortgage-layer` — `background: rgba(8, 14, 11, .56);`
- `styles.css :: /* Mobile import/export is one action opening a bottom-sheet choice. */ .expense-transfer-layer` — `background: rgba(8, 14, 11, .5);`
- `styles.css :: /* Secondary sidebar controls are available without permanently filling the tray. */ .sidebar-disclosure` — `background: #151d1a;`
- `styles.css :: :root[data-theme='dark']` — `--remortgage-rate-accent: #f2a261; --ui-accent-soft: #20372d; --ui-accent: #83d1aa; --ui-line-strong: #3d4a43; --ui-line: #303b35; --ui-shadow: 0 1px 2px rgba(0, 0, 0, .12), 0 10px 30px rgba(0, 0, 0, .10); --ui-surface-muted: #202923; --ui-surface-subtle: #1a231e; --ui-surface: #161d19;`
- `styles.css :: :root[data-theme='dark'] .accent-swatch` — `border-color: rgba(255,255,255,.56); box-shadow: 0 0 0 1px rgba(0,0,0,.34);`
- `styles.css :: :root[data-theme='dark'] .archived-tenants > .tenant-grid, :root[data-theme='dark'] .ch-profile-grid > div, :root[data-theme='dark'] .bank-toolbar, :root[data-theme='dark'] .projection-table-wrap` — `background: #111713;`
- `styles.css :: :root[data-theme='dark'] .asset-mobile-chevron, :root[data-theme='dark'] .mobile-expand-cue, :root[data-theme='dark'] .property-mobile-disclosure, :root[data-theme='dark'] .overview-property-card .property-card-edit` — `background: #202a25; border-color: #37433d; color: #a9dcc1;`
- `styles.css :: :root[data-theme='dark'] .asset-mobile-toggle` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .billing-features` — `background: #111713;`
- `styles.css :: :root[data-theme='dark'] .billing-features > div` — `color: #c4d0c9;`
- `styles.css :: :root[data-theme='dark'] .billing-modal-close` — `color: #c8d3cd;`
- `styles.css :: :root[data-theme='dark'] .buffer-ring::before` — `background: #161d19;`
- `styles.css :: :root[data-theme='dark'] .credential-field > input, :root[data-theme='dark'] .credential-value-input` — `background: #111713;`
- `styles.css :: :root[data-theme='dark'] .credential-icon-action.danger:hover` — `background: rgba(223, 130, 121, .10);`
- `styles.css :: :root[data-theme='dark'] .credential-row, :root[data-theme='dark'] .credentials-summary > div, :root[data-theme='dark'] .credentials-search` — `background: var(--ui-surface);`
- `styles.css :: :root[data-theme='dark'] .data-table th, :root[data-theme='dark'] .data-table td, :root[data-theme='dark'] .projection-table th, :root[data-theme='dark'] .projection-table td, :root[data-theme='dark'] .reconciliation-wrap th, :root[data-theme='dark'] .reconciliation-wrap td` — `border-color: #2b3530;`
- `styles.css :: :root[data-theme='dark'] .data-table tr > :first-child, :root[data-theme='dark'] .projection-table tr > :first-child` — `background: #19211d;`
- `styles.css :: :root[data-theme='dark'] .expense-mobile-card` — `background: #161d19;`
- `styles.css :: :root[data-theme='dark'] .expense-mobile-fields` — `background: #121814;`
- `styles.css :: :root[data-theme='dark'] .expense-mobile-fields input` — `color: #eaf2ee;`
- `styles.css :: :root[data-theme='dark'] .expense-modal` — `background: #161d19;`
- `styles.css :: :root[data-theme='dark'] .expense-modal > footer` — `background: #161d19;`
- `styles.css :: :root[data-theme='dark'] .expense-modal input, :root[data-theme='dark'] .expense-modal textarea, :root[data-theme='dark'] .expense-modal-money` — `color: #eaf2ee;`
- `styles.css :: :root[data-theme='dark'] .expense-modal-required` — `background: #17261f;`
- `styles.css :: :root[data-theme='dark'] .expense-modal-type` — `background: #101614;`
- `styles.css :: :root[data-theme='dark'] .expense-transfer-primary` — `background: #1b2c24; border-color: #315541; color: #a9dfc2;`
- `styles.css :: :root[data-theme='dark'] .expense-type.expense` — `color: #e5aaa5;`
- `styles.css :: :root[data-theme='dark'] .expense-type.income` — `color: #9be0bd;`
- `styles.css :: :root[data-theme='dark'] .expense-type.neutral, :root[data-theme='dark'] .expense-type.unspecified` — `background: #27302c;`
- `styles.css :: :root[data-theme='dark'] .expenses-filter-panel input, :root[data-theme='dark'] .expenses-filter-panel select, :root[data-theme='dark'] .expenses-search` — `color: #eaf2ee;`
- `styles.css :: :root[data-theme='dark'] .expenses-table input` — `color: #eaf2ee;`
- `styles.css :: :root[data-theme='dark'] .expenses-table input:focus` — `border-color: #53655c;`
- `styles.css :: :root[data-theme='dark'] .expenses-table tbody tr:hover` — `background: #19211e;`
- `styles.css :: :root[data-theme='dark'] .expenses-table td` — `border-color: #2d3934;`
- `styles.css :: :root[data-theme='dark'] .expenses-table th` — `background: #1a211e;`
- `styles.css :: :root[data-theme='dark'] .metric-card.green, :root[data-theme='dark'] .private-tax-inputs, :root[data-theme='dark'] .private-tax-summary` — `background: #17261f;`
- `styles.css :: :root[data-theme='dark'] .mobile-bottom-nav` — `border-color: #303b36;`
- `styles.css :: :root[data-theme='dark'] .mobile-bottom-nav button.active` — `color: #8ad8b2;`
- `styles.css :: :root[data-theme='dark'] .mobile-expense-filter-toggle, :root[data-theme='dark'] .expenses-filter-fields .expenses-clear, :root[data-theme='dark'] .expense-transfer-sheet, :root[data-theme='dark'] .expense-transfer-export button` — `background: #161d19; border-color: #33413b; color: #dbe5df;`
- `styles.css :: :root[data-theme='dark'] .mobile-line-summary > span b` — `color: #e6ede9;`
- `styles.css :: :root[data-theme='dark'] .mobile-portfolio-ltv, :root[data-theme='dark'] .mobile-buffer-toggle small` — `color: #a1ada7;`
- `styles.css :: :root[data-theme='dark'] .mobile-property-context span, :root[data-theme='dark'] .mobile-property-row > span` — `color: #9aa6a0;`
- `styles.css :: :root[data-theme='dark'] .mobile-property-edit` — `color: #91ddb9;`
- `styles.css :: :root[data-theme='dark'] .mobile-property-row > strong` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .mobile-property-row.advanced` — `background:
    linear-gradient(90deg, rgba(83, 160, 123, .16), rgba(83, 160, 123, .05) 72%, rgba(83, 160, 123, 0)),
    #19211d; box-shadow: inset 3px 0 #4f8c70; color: #a8cfbc;`
- `styles.css :: :root[data-theme='dark'] .mobile-property-row.advanced > span` — `color: #a8cfbc;`
- `styles.css :: :root[data-theme='dark'] .mobile-remortgage-decision-row, :root[data-theme='dark'] .mobile-remortgage-field-modal, :root[data-theme='dark'] .mobile-remortgage-focused-input` — `border-color: #3b4942;`
- `styles.css :: :root[data-theme='dark'] .mobile-remortgage-details-body` — `border-color: #303b35;`
- `styles.css :: :root[data-theme='dark'] .mobile-remortgage-modal, :root[data-theme='dark'] .mobile-remortgage-details, :root[data-theme='dark'] .mobile-remortgage-derived, :root[data-theme='dark'] .mobile-remortgage-primary-fields .remortgage-field > div, :root[data-theme='dark'] .mobile-remortgage-close` — `background: #161d19; border-color: #37433d; color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .mobile-remortgage-rate-hero` — `background: color-mix(in srgb, var(--remortgage-rate-accent) 7%, #161d19); border-color: color-mix(in srgb, var(--remortgage-rate-accent) 30%, #303b35); color: #c5d0ca;`
- `styles.css :: :root[data-theme='dark'] .mobile-remortgage-step` — `background: #2a7857;`
- `styles.css :: :root[data-theme='dark'] .mobile-scenario-toggle-enabled .scenario, :root[data-theme='dark'] .mobile-property-switcher, :root[data-theme='dark'] .property-group-panel .mobile-property-group-list` — `background: #161d19;`
- `styles.css :: :root[data-theme='dark'] .model-help::after, :root[data-theme='dark'] .assumptions-grid .model-help::after` — `color: #eaf2ee;`
- `styles.css :: :root[data-theme='dark'] .overview-scenario-toggle button.active, :root[data-theme='dark'] .mobile-property-segments button.active` — `color: #edf3ef;`
- `styles.css :: :root[data-theme='dark'] .overview-scenario-toggle, :root[data-theme='dark'] .mobile-property-segments` — `background: #232b27;`
- `styles.css :: :root[data-theme='dark'] .panel, :root[data-theme='dark'] .property-card, :root[data-theme='dark'] .metric-card:not(.dark), :root[data-theme='dark'] .add-property-card, :root[data-theme='dark'] .global-model-strip, :root[data-theme='dark'] .cashflow-editor, :root[data-theme='dark'] .property-cost-card, :root[data-theme='dark'] .secondary-button, :root[data-theme='dark'] .theme-toggle` — `color: #e6ede9;`
- `styles.css :: :root[data-theme='dark'] .panel-stat, :root[data-theme='dark'] .scenario i, :root[data-theme='dark'] .date-badge, :root[data-theme='dark'] .projection-table-toggle` — `color: #a6b2ac;`
- `styles.css :: :root[data-theme='dark'] .pricing-card, :root[data-theme='dark'] .billing-modal` — `color: #e6ede9;`
- `styles.css :: :root[data-theme='dark'] .property-card h3, :root[data-theme='dark'] h1, :root[data-theme='dark'] h2, :root[data-theme='dark'] h3, :root[data-theme='dark'] .data-table td, :root[data-theme='dark'] .data-table th button, :root[data-theme='dark'] .tenant-card dd, :root[data-theme='dark'] .property-cost-card h3` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .property-cards .add-property-card` — `background: #17281f; border-color: #315b48; color: #9ce0be;`
- `styles.css :: :root[data-theme='dark'] .property-group-chevron` — `background: #202823; border-color: #37433d; color: #a9b5af;`
- `styles.css :: :root[data-theme='dark'] .property-group-panel .data-table tbody th.advanced-metric-label` — `background:
    linear-gradient(90deg, rgba(83, 160, 123, .16), rgba(83, 160, 123, .05) 72%, rgba(83, 160, 123, 0)),
    #19211d; box-shadow: inset 3px 0 #4f8c70; color: #a8cfbc;`
- `styles.css :: :root[data-theme='dark'] .property-group-panel .data-table tbody tr:hover th.advanced-metric-label` — `background:
    linear-gradient(90deg, rgba(83, 160, 123, .22), rgba(83, 160, 123, .075) 72%, rgba(83, 160, 123, 0)),
    #1c2722;`
- `styles.css :: :root[data-theme='dark'] .property-group-panel > header` — `background: #161d19;`
- `styles.css :: :root[data-theme='dark'] .property-group-toggle` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .property-group-toggle:hover` — `background: #1b241f;`
- `styles.css :: :root[data-theme='dark'] .property-map, :root[data-theme='dark'] .projection-chart-wrap, :root[data-theme='dark'] .bar-chart, :root[data-theme='dark'] .cashflow-reconciliation` — `background-color: #151b18;`
- `styles.css :: :root[data-theme='dark'] .property-view-choice` — `color: #95a49d;`
- `styles.css :: :root[data-theme='dark'] .property-view-choice.active` — `background: #2a7857; color: #f1fff7;`
- `styles.css :: :root[data-theme='dark'] .property-view-choice:hover` — `background: #202923;`
- `styles.css :: :root[data-theme='dark'] .property-view-mode` — `background: #111713; border-color: #37433d;`
- `styles.css :: :root[data-theme='dark'] .property-view-mode > span` — `color: #7f8b85;`
- `styles.css :: :root[data-theme='dark'] .property-view-mode > span.active` — `color: #8ad8b2;`
- `styles.css :: :root[data-theme='dark'] .property-view-switch i` — `background: #45514b;`
- `styles.css :: :root[data-theme='dark'] .property-view-switch input:checked + i` — `background: #347b5d;`
- `styles.css :: :root[data-theme='dark'] .rate-shock-stepper > button, :root[data-theme='dark'] .mobile-asset-row .asset-numbers span, :root[data-theme='dark'] .property-mobile-expand` — `background: #202823; border-color: #37433d; color: #c9d7d0;`
- `styles.css :: :root[data-theme='dark'] .reconciliation-scenario-toggle button` — `border-color: #37433d;`
- `styles.css :: :root[data-theme='dark'] .reconciliation-scenario-toggle button.active` — `border-color: var(--scenario);`
- `styles.css :: :root[data-theme='dark'] .remortgage-arrow svg` — `background: #202923; border-color: #37433d; color: #9db0a7;`
- `styles.css :: :root[data-theme='dark'] .remortgage-comparison-name input, :root[data-theme='dark'] .remortgage-field input, :root[data-theme='dark'] .remortgage-result-strip dd, :root[data-theme='dark'] .remortgage-difference-card dd` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .remortgage-difference-card` — `background: #19211d; border-color: #303b35;`
- `styles.css :: :root[data-theme='dark'] .remortgage-field > div, :root[data-theme='dark'] .remortgage-add select` — `background: #101612; border-color: #37433d; color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .remortgage-reorder-handle` — `border-color: #303b36; color: #74817a;`
- `styles.css :: :root[data-theme='dark'] .remortgage-reorder-handle:hover, :root[data-theme='dark'] .remortgage-reorder-handle:focus-visible, :root[data-theme='dark'] .remortgage-comparison.is-dragging .remortgage-reorder-handle` — `background: rgba(83, 160, 123, .10); color: #91ddb9;`
- `styles.css :: :root[data-theme='dark'] .remortgage-segmented` — `background: #111713; border-color: #37433d;`
- `styles.css :: :root[data-theme='dark'] .remortgage-summary-chevron, :root[data-theme='dark'] .remortgage-scenario-card, :root[data-theme='dark'] .remortgage-impact` — `background: #161d19; border-color: #303b35;`
- `styles.css :: :root[data-theme='dark'] .remortgage-summary-difference` — `background: #202923;`
- `styles.css :: :root[data-theme='dark'] .remortgage-summary-main` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .remortgage-summary-main:hover, :root[data-theme='dark'] .remortgage-comparison.expanded .remortgage-summary-row, :root[data-theme='dark'] .remortgage-comparison-name` — `background: #19211d;`
- `styles.css :: :root[data-theme='dark'] .remortgage-summary-mobile-rates` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] .remortgage-summary-mortgage-cost, :root[data-theme='dark'] .remortgage-summary-mobile-rates em, :root[data-theme='dark'] .mobile-remortgage-rate-hero > span` — `color: #a2afa8;`
- `styles.css :: :root[data-theme='dark'] .report-export-control` — `background: #161d19; border-color: #33413b;`
- `styles.css :: :root[data-theme='dark'] .report-export-control button` — `color: #bdc9c3;`
- `styles.css :: :root[data-theme='dark'] .report-export-control button:hover:not(:disabled)` — `background: #1d3027; color: #9ce0be;`
- `styles.css :: :root[data-theme='dark'] .save-status.error` — `background: #2a1c1a;`
- `styles.css :: :root[data-theme='dark'] .settings-layer` — `background: rgba(0, 0, 0, .58);`
- `styles.css :: :root[data-theme='dark'] .settings-modal` — `box-shadow: 0 28px 78px rgba(0, 0, 0, .36);`
- `styles.css :: :root[data-theme='dark'] .topbar` — `background: rgba(17,23,20,.92);`
- `styles.css :: :root[data-theme='dark'] .weighted-rate-card .rate-shock-stepper > button.decrease` — `background: #17221d; border-color: #4d9a76; color: #9ee0bf;`
- `styles.css :: :root[data-theme='dark'] .weighted-rate-card .rate-shock-stepper > button.increase` — `background: #286d50; border-color: #41906c; color: #f2fff8;`
- `styles.css :: :root[data-theme='dark'] body, :root[data-theme='dark'] .app-shell, :root[data-theme='dark'] main` — `color: #e7eee9;`
- `styles.css :: :root[data-theme='dark'] input, :root[data-theme='dark'] select, :root[data-theme='dark'] .money-input, :root[data-theme='dark'] .table-tools > label, :root[data-theme='dark'] .tenant-editor input, :root[data-theme='dark'] .tenant-editor select` — `color: #e8efeb;`
- `styles.css :: body` — `color: var(--ui-text);`
- `styles.css :: input::placeholder, textarea::placeholder` — `color: #98a29d;`
- `theme.css :: /* ---------- Application shell and navigation ---------- */ :root[data-accent] body, :root[data-accent] .app-shell, :root[data-accent] main` — `background: var(--theme-canvas); color: var(--ui-text);`
- `theme.css :: /* ---------- Billing/product identity ---------- */ :root[data-accent] .billing-mark, :root[data-accent] .loading-mark` — `background: linear-gradient(
    145deg,
    var(--theme-accent-strong),
    color-mix(in srgb, var(--theme-accent-strong) 78%, var(--theme-accent-light))
  ); box-shadow: 0 14px 30px color-mix(in srgb, var(--theme-accent-strong) 22%, transparent); color: var(--theme-accent-contrast);`
- `theme.css :: /* ---------- Curated product palettes ---------- */ :root, :root[data-accent='forest']` — `--theme-accent-contrast: #ffffff; --theme-accent-hover: #145a42; --theme-accent-light: #83d1aa; --theme-accent-strong: #1c6b50;`
- `theme.css :: /* ---------- Derived dark environment ---------- */ :root[data-theme='dark'][data-accent]` — `--green-light: var(--semantic-positive-soft); --green: var(--semantic-positive); --theme-accent-border: color-mix(in srgb, var(--theme-accent-light) 34%, #303b35); --theme-accent-focus: color-mix(in srgb, var(--theme-accent-light) 30%, transparent); --theme-accent-soft-strong: color-mix(in srgb, var(--theme-accent-strong) 27%, #161d19); --theme-accent-soft: color-mix(in srgb, var(--theme-accent-strong) 19%, #161d19); --theme-bar-mid: color-mix(in srgb, var(--theme-accent-light) 72%, #315143); --theme-bar-soft: color-mix(in srgb, var(--theme-accent-strong) 28%, #25302b); --theme-bar-strong: color-mix(in srgb, var(--theme-accent-light) 46%, #17251f); --theme-bar-track: color-mix(in srgb, var(--theme-accent-strong) 13%, #26302c); --theme-canvas: color-mix(in srgb, var(--theme-accent-strong) 6%, #111613); --theme-line-strong: color-mix(in srgb, var(--theme-accent-light) 18%, #3d4a43); --theme-line: color-mix(in srgb, var(--theme-accent-light) 12%, #303b35); --theme-shadow: 0 1px 2px rgba(0, 0, 0, .15), 0 10px 32px rgba(0, 0, 0, .16); --theme-sidebar-active: color-mix(in srgb, var(--theme-accent-strong) 28%, #202b26); --theme-sidebar-hover: color-mix(in srgb, var(--theme-accent-strong) 21%, #19211d); --theme-sidebar-line: color-mix(in srgb, var(--theme-accent-light) 15%, #29342f); --theme-sidebar-surface: color-mix(in srgb, var(--theme-accent-strong) 16%, #141b18); --theme-sidebar: color-mix(in srgb, var(--theme-accent-strong) 12%, #0d1210); --theme-surface-muted: color-mix(in srgb, var(--theme-accent-strong) 9%, #202923); --theme-surface-subtle: color-mix(in srgb, var(--theme-accent-strong) 7%, #1a231e); --theme-surface: color-mix(in srgb, var(--theme-accent-strong) 5%, #161d19); --ui-accent-soft: var(--theme-accent-soft); --ui-accent: var(--theme-accent-light);`
- `theme.css :: /* ---------- Derived light environment ---------- */ :root[data-accent]` — `--green-light: var(--semantic-positive-soft); --green: var(--semantic-positive); --line: var(--ui-line); --sidebar: var(--theme-sidebar); --theme-accent-border: color-mix(in srgb, var(--theme-accent-strong) 34%, #d8e0db); --theme-accent-focus: color-mix(in srgb, var(--theme-accent-strong) 28%, transparent); --theme-accent-soft-strong: color-mix(in srgb, var(--theme-accent-strong) 15%, #ffffff); --theme-accent-soft: color-mix(in srgb, var(--theme-accent-strong) 8%, #ffffff); --theme-bar-mid: color-mix(in srgb, var(--theme-accent-strong) 78%, #a9c6b8); --theme-bar-soft: color-mix(in srgb, var(--theme-accent-strong) 20%, #edf1ee); --theme-bar-strong: color-mix(in srgb, var(--theme-accent-strong) 58%, #20342d); --theme-bar-track: color-mix(in srgb, var(--theme-accent-strong) 9%, #e9edea); --theme-canvas: color-mix(in srgb, var(--theme-accent-strong) 3.2%, #f5f7f4); --theme-line-strong: color-mix(in srgb, var(--theme-accent-strong) 18%, #cbd5cf); --theme-line: color-mix(in srgb, var(--theme-accent-strong) 10%, #dde4df); --theme-shadow: 0 1px 2px rgba(22, 39, 31, .03), 0 9px 28px rgba(22, 39, 31, .045); --theme-sidebar-active: color-mix(in srgb, var(--theme-accent-strong) 31%, #1c2923); --theme-sidebar-hover: color-mix(in srgb, var(--theme-accent-strong) 23%, #18201d); --theme-sidebar-line: color-mix(in srgb, var(--theme-accent-strong) 23%, #2d3934); --theme-sidebar-surface: color-mix(in srgb, var(--theme-accent-strong) 19%, #151d1a); --theme-sidebar: color-mix(in srgb, var(--theme-accent-strong) 17%, #101614); --theme-surface-muted: color-mix(in srgb, var(--theme-accent-strong) 7.5%, #f2f5f3); --theme-surface-subtle: color-mix(in srgb, var(--theme-accent-strong) 4.5%, #fafbf9); --theme-surface: color-mix(in srgb, var(--theme-accent-strong) 1.6%, #ffffff); --ui-accent-soft: var(--theme-accent-soft); --ui-accent: var(--theme-accent-strong); --ui-line-strong: var(--theme-line-strong); --ui-line: var(--theme-line); --ui-surface-muted: var(--theme-surface-muted); --ui-surface-subtle: var(--theme-surface-subtle); --ui-surface: var(--theme-surface);`
- `theme.css :: /* ---------- Drawers, sheets and editors ---------- */ :root[data-accent] .drawer, :root[data-accent] .billing-modal` — `background: var(--theme-canvas); color: var(--ui-text);`
- `theme.css :: /* ---------- Primary surfaces, cards and panel hierarchy ---------- */ :root[data-accent] .panel, :root[data-accent] .property-card, :root[data-accent] .metric-card, :root[data-accent] .tenant-card, :root[data-accent] .bank-account, :root[data-accent] .bank-metric, :root[data-accent] .pricing-card, :root[data-accent] .credential-row, :root[data-accent] .remortgage-comparison, :root[data-accent] .remortgage-scenario-card, :root[data-accent] .expense-summary, :root[data-accent] .settings-modal, :root[data-accent] .expense-modal, :root[data-accent] .tenant-editor` — `background: var(--theme-surface); border-color: var(--ui-line);`
- `theme.css :: /* ---------- Product highlights and controls ---------- */ :root[data-accent] .eyebrow, :root[data-accent] .kicker, :root[data-accent] .text-button, :root[data-accent] .theme-toggle:hover, :root[data-accent] .assumption-pill, :root[data-accent] .sidebar-disclosure > summary, :root[data-accent] .sidebar-model-inputs > header, :root[data-accent] .sidebar-profile-editor > header, :root[data-accent] .property-index, :root[data-accent] .date-badge:not(.urgent), :root[data-accent] .setup-icon, :root[data-accent] .ch-mark, :root[data-accent] .tenants-empty > svg, :root[data-accent] .bank-empty-state > svg, :root[data-accent] .ch-list-panel > header a, :root[data-accent] .property-map a, :root[data-accent] .billing-features svg, :root[data-accent] .owner-access-panel > header > svg` — `color: var(--ui-accent);`
- `theme.css :: /* ---------- SEMANTIC CONTRACT: sign/status colours never follow the theme ---------- */ :root[data-accent] .positive, :root[data-accent] .data-table td.money-positive, :root[data-accent] .mobile-property-row > strong.money-positive, :root[data-accent] .expense-summary.income strong, :root[data-accent] .reconciliation-wrap tr.income td, :root[data-accent] .bank-metric.positive strong, :root[data-accent] .bank-average-grid .positive, :root[data-accent] .bank-transaction-table td.positive` — `color: var(--semantic-positive) !important;`
- `theme.css :: /* ---------- Theme-coloured non-semantic data visualisation ---------- */ :root[data-accent] .asset-track` — `box-shadow: inset 0 0 0 1px var(--theme-accent-border);`
- `theme.css :: /* Advanced fields are product highlights, not financial semantics. */ :root[data-accent] .property-group-panel .data-table tbody th.advanced-metric-label` — `background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--theme-accent-strong) 12%, transparent),
      color-mix(in srgb, var(--theme-accent-strong) 4%, transparent) 72%,
      transparent
    ),
    var(--theme-surface-subtle); box-shadow: inset 3px 0 var(--theme-accent-border); color: color-mix(in srgb, var(--ui-accent) 74%, var(--ui-text));`
- `theme.css :: :root[data-accent='amber']` — `--theme-accent-contrast: #ffffff; --theme-accent-hover: #8b4e05; --theme-accent-light: #e6b468; --theme-accent-strong: #a8610c;`
- `theme.css :: :root[data-accent='indigo']` — `--theme-accent-contrast: #ffffff; --theme-accent-hover: #493ba9; --theme-accent-light: #aaa0ed; --theme-accent-strong: #5b4bc4;`
- `theme.css :: :root[data-accent='ocean']` — `--theme-accent-contrast: #ffffff; --theme-accent-hover: #2555aa; --theme-accent-light: #8eb7f1; --theme-accent-strong: #2f67c7;`
- `theme.css :: :root[data-accent='teal']` — `--theme-accent-contrast: #ffffff; --theme-accent-hover: #0b5f59; --theme-accent-light: #68d9cf; --theme-accent-strong: #0f766e;`
- `theme.css :: :root[data-accent] .asset-loan-bar` — `background: var(--theme-bar-strong);`
- `theme.css :: :root[data-accent] .asset-value-bar` — `background: var(--theme-bar-soft);`
- `theme.css :: :root[data-accent] .brand > span` — `background: var(--theme-sidebar-surface); border-color: var(--theme-sidebar-line); color: var(--theme-accent-light);`
- `theme.css :: :root[data-accent] .danger-button, :root[data-accent] .billing-message.error, :root[data-accent] .auth-message.error, :root[data-accent] .bank-error, :root[data-accent] .ch-error` — `color: var(--semantic-danger);`
- `theme.css :: :root[data-accent] .data-table tbody tr:hover td, :root[data-accent] .data-table tbody tr:hover th:not(.advanced-metric-label), :root[data-accent] .ch-search-results button:hover` — `background: var(--theme-surface-muted);`
- `theme.css :: :root[data-accent] .data-table tr > :first-child` — `background: var(--theme-surface-subtle);`
- `theme.css :: :root[data-accent] .date-badge.urgent, :root[data-accent] .ch-status.warning` — `background: var(--semantic-warning-soft); color: var(--semantic-warning);`
- `theme.css :: :root[data-accent] .dot.equity, :root[data-accent] .dot.value, :root[data-accent] .bar-values span` — `background: var(--theme-bar-mid);`
- `theme.css :: :root[data-accent] .dot.loan, :root[data-accent] .bar-values i` — `background: var(--theme-bar-strong);`
- `theme.css :: :root[data-accent] .drawer > header, :root[data-accent] .drawer > footer, :root[data-accent] .form-section, :root[data-accent] .setup-modal, :root[data-accent] .expense-transfer-sheet, :root[data-accent] .mobile-remortgage-modal, :root[data-accent] .mobile-remortgage-field-modal, :root[data-accent] .mobile-remortgage-details, :root[data-accent] .mobile-remortgage-derived` — `background: var(--theme-surface); border-color: var(--ui-line); color: var(--ui-text);`
- `theme.css :: :root[data-accent] .drawer-body, :root[data-accent] .mobile-remortgage-cost-strip, :root[data-accent] .mobile-remortgage-decision-row, :root[data-accent] .mobile-remortgage-focused-input` — `background: var(--theme-surface-subtle);`
- `theme.css :: :root[data-accent] .equity-bar` — `background: var(--theme-bar-track);`
- `theme.css :: :root[data-accent] .equity-bar i` — `background: var(--theme-accent-strong);`
- `theme.css :: :root[data-accent] .form-grid input:focus, :root[data-accent] .money-input:focus-within, :root[data-accent] .cashflow-line > label > input:focus, :root[data-accent] .cashflow-line > label > select:focus, :root[data-accent] .tenant-editor select:focus, :root[data-accent] .tenant-editor input:focus, :root[data-accent] .setup-company-name input:focus, :root[data-accent] .auth-card form label div:focus-within` — `border-color: var(--theme-accent-border); box-shadow: 0 0 0 3px var(--theme-accent-focus);`
- `theme.css :: :root[data-accent] .metric-card.dark, :root[data-accent] .bank-metric.dark` — `background: var(--theme-sidebar-surface); border-color: var(--theme-sidebar-line);`
- `theme.css :: :root[data-accent] .metric-card.green` — `background: var(--theme-accent-soft); border-color: var(--theme-accent-border);`
- `theme.css :: :root[data-accent] .mobile-bottom-nav` — `background: color-mix(in srgb, var(--theme-surface) 96%, transparent); border-color: var(--ui-line);`
- `theme.css :: :root[data-accent] .mobile-property-row.advanced` — `background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--theme-accent-strong) 12%, transparent),
        color-mix(in srgb, var(--theme-accent-strong) 4%, transparent) 72%,
        transparent
      ),
      var(--theme-surface-subtle); box-shadow: inset 3px 0 var(--theme-accent-border); color: color-mix(in srgb, var(--ui-accent) 74%, var(--ui-text));`
- `theme.css :: :root[data-accent] .mobile-property-row.advanced > span` — `color: inherit;`
- `theme.css :: :root[data-accent] .negative, :root[data-accent] .data-table td.money-negative, :root[data-accent] .mobile-property-row > strong.money-negative, :root[data-accent] .expense-summary.expense strong, :root[data-accent] .reconciliation-wrap tr.cost td, :root[data-accent] .bank-metric.negative strong, :root[data-accent] .bank-average-grid .negative, :root[data-accent] .bank-transaction-table td.negative` — `color: var(--semantic-negative) !important;`
- `theme.css :: :root[data-accent] .panel, :root[data-accent] .property-card, :root[data-accent] .metric-card, :root[data-accent] .tenant-card, :root[data-accent] .bank-account, :root[data-accent] .pricing-card, :root[data-accent] .remortgage-comparison` — `box-shadow: var(--theme-shadow);`
- `theme.css :: :root[data-accent] .pricing-card > i` — `background: var(--theme-accent-strong);`
- `theme.css :: :root[data-accent] .pricing-card.featured` — `border-color: var(--theme-accent-strong); box-shadow: 0 15px 40px color-mix(in srgb, var(--theme-accent-strong) 13%, transparent);`
- `theme.css :: :root[data-accent] .primary-button, :root[data-accent] .tax-jurisdiction button.active, :root[data-accent] .account-type-toggle button.active, :root[data-accent] .property-view-choice.active, :root[data-accent] .segmented button.active, :root[data-accent] .remortgage-segmented button.active` — `background: var(--theme-accent-strong); border-color: var(--theme-accent-strong); color: var(--theme-accent-contrast);`
- `theme.css :: :root[data-accent] .primary-button:hover` — `background: var(--theme-accent-hover);`
- `theme.css :: :root[data-accent] .property-group-panel .data-table tbody tr:hover th.advanced-metric-label` — `background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--theme-accent-strong) 16%, transparent),
      color-mix(in srgb, var(--theme-accent-strong) 6%, transparent) 72%,
      transparent
    ),
    var(--theme-surface-muted);`
- `theme.css :: :root[data-accent] .property-group-panel > header, :root[data-accent] .projection-toolbar, :root[data-accent] .projection-table-toggle, :root[data-accent] .private-tax-summary > footer, :root[data-accent] .archived-tenants > .tenant-grid, :root[data-accent] .credentials-archive-list, :root[data-accent] .data-table thead th, :root[data-accent] .expenses-table th, :root[data-accent] .bank-transaction-table th` — `background: var(--theme-surface-subtle);`
- `theme.css :: :root[data-accent] .property-index, :root[data-accent] .date-badge:not(.urgent), :root[data-accent] .setup-icon, :root[data-accent] .ch-mark` — `background: var(--theme-accent-soft-strong);`
- `theme.css :: :root[data-accent] .property-nav > i` — `background: color-mix(in srgb, var(--theme-accent-strong) 12%, #222b28);`
- `theme.css :: :root[data-accent] .remortgage-scenario-cashflow-metric > b.negative, :root[data-accent] .remortgage-summary-option > em.negative, :root[data-accent] .mobile-remortgage-cost-strip span.negative, :root[data-accent] .mobile-remortgage-detail-row b.negative` — `color: var(--semantic-negative) !important;`
- `theme.css :: :root[data-accent] .remortgage-scenario-cashflow-metric > b.positive, :root[data-accent] .remortgage-summary-option > em.positive, :root[data-accent] .mobile-remortgage-cost-strip span.positive, :root[data-accent] .mobile-remortgage-detail-row b.positive` — `color: var(--semantic-positive) !important;`
- `theme.css :: :root[data-accent] .sidebar` — `background: var(--theme-sidebar);`
- `theme.css :: :root[data-accent] .sidebar nav button.active` — `background: var(--theme-sidebar-active); box-shadow: inset 3px 0 var(--theme-accent-light);`
- `theme.css :: :root[data-accent] .sidebar nav button:hover` — `background: var(--theme-sidebar-hover);`
- `theme.css :: :root[data-accent] .sidebar-model-inputs, :root[data-accent] .sidebar-profile-editor` — `background: var(--theme-sidebar-surface); border-color: var(--theme-sidebar-line);`
- `theme.css :: :root[data-accent] .sidebar-plan` — `background: var(--theme-sidebar-surface); border-color: var(--theme-sidebar-line);`
- `theme.css :: :root[data-accent] .sidebar-plan.pro` — `background: color-mix(in srgb, var(--theme-accent-strong) 30%, var(--theme-sidebar)); border-color: color-mix(in srgb, var(--theme-accent-light) 42%, var(--theme-sidebar-line)); color: var(--theme-accent-light);`
- `theme.css :: :root[data-accent] .sidebar-plan:hover` — `background: var(--theme-sidebar-hover); border-color: color-mix(in srgb, var(--theme-accent-light) 36%, var(--theme-sidebar-line));`
- `theme.css :: :root[data-accent] .sidebar-settings:hover` — `background: color-mix(in srgb, var(--theme-accent-light) 8%, transparent); border-color: color-mix(in srgb, var(--theme-accent-light) 42%, var(--theme-sidebar-line)); color: var(--theme-accent-light);`
- `theme.css :: :root[data-accent] .switch-label input:checked + i, :root[data-accent] .property-nav-visibility input:checked + i, :root[data-accent] .per-flat-toggle input:checked + i, :root[data-accent] .cashflow-enabled input:checked + i, :root[data-accent] .bank-account > header input:checked + i` — `background: var(--theme-accent-strong); border-color: var(--theme-accent-strong);`
- `theme.css :: :root[data-accent] .topbar` — `background: color-mix(in srgb, var(--theme-surface) 92%, transparent); border-color: var(--ui-line);`
- `theme.css :: :root[data-accent] button:focus-visible, :root[data-accent] summary:focus-visible, :root[data-accent] input:focus-visible, :root[data-accent] select:focus-visible, :root[data-accent] textarea:focus-visible` — `outline-color: var(--theme-accent-focus);`
- `theme.css :: :root[data-accent] input[type='checkbox'], :root[data-accent] input[type='radio']` — `accent-color: var(--theme-accent-strong);`
