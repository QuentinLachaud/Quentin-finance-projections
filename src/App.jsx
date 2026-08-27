import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Building2, CalendarClock, Check, ChevronDown, CircleHelp,
  ChevronUp, PoundSterling, Copy, ExternalLink, Gauge, Home, Landmark, MapPin, Menu,
  Pencil, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, TrendingUp, Moon, Sun,
  WalletCards, X, LogOut, Settings, Cloud, CloudOff, ReceiptText, FileText, Users, RefreshCw, AlertTriangle, Coffee, KeyRound,
} from 'lucide-react'
import { assumptions, createBlankProperty, editableSections, newAccountDefaults } from './data.js'
import { calculatePortfolio, calculateProperty, currency, percent, projectPortfolio, shortDate } from './calculations.js'
import {
  activeOfficers, activePsc, companyDeadlines, formatCompanyAddress,
  identityVerificationSummary, officialCompanyUrl, outstandingCharges,
} from './companiesHouse.js'
import AuthScreen from './AuthScreen.jsx'
import BrandLogo from './BrandLogo.jsx'
import BankWorkspace from './BankWorkspace.jsx'
import BillingWorkspace, { billingRequest } from './BillingWorkspace.jsx'
import ExpensesWorkspace from './ExpensesWorkspace.jsx'
import CredentialsWorkspace from './CredentialsWorkspace.jsx'
import RemortgageSimulator from './RemortgageSimulator.jsx'
import AcquisitionSimulator from './AcquisitionSimulator.jsx'
import OverviewPortfolioDashboard from './OverviewPortfolioDashboard.jsx'
import { canAddProperty, normalizeEntitlement, showFreeSupport } from './billing.js'
import { isSupabaseConfigured, supabase } from './supabase.js'
import { formatPropertyAddress, formatRateComposition, includedPortfolioProperties, shouldSelectZeroInput, tenantsForIncludedProperties, visiblePropertyRows } from './portfolioFields.js'
import { applyTenantToProperty, createTenant, importPropertyTenants, propertyVoidHistory, removeTenantsForProperty, syncPropertyTenant, tenantBelongsToProperty, tenantTenure } from './tenants.js'
import { accentOptions, accentStorageKey, initialAccent, initialTheme, userAvatarUrl } from './preferences.js'
import { normalizeNextBtlPreferences } from './nextBtlPreferences.js'
import MoneyPeriodInput from './MoneyPeriodInput.jsx'
import { moneyEntryPeriodFor, normalizeMoneyEntryPreferences, setMoneyEntryPeriod } from './moneyPeriods.js'
import { supportConfig } from './support.js'
import { exportTabularReport } from './reportExports.js'
import { bufferStrokeOffset, bufferVisualTarget, interpolateBufferVisual } from './bufferAnimation.js'

// Keep the completed Open Banking workspace dormant until a production data
// provider is available. It can be restored without code changes at deploy time.
const BANKING_ENABLED = import.meta.env.VITE_BANKING_ENABLED === 'true'
const SUPPORT = supportConfig({ enabled: import.meta.env.VITE_SUPPORT_ENABLED, url: import.meta.env.VITE_BUY_ME_A_COFFEE_URL || 'https://buymeacoffee.com/btlportfolio.co.uk' })

const defaultSettings = { ...assumptions, ...newAccountDefaults, fullyManaged: false, companyCosts: [], extractions: [], accountType: 'company', companyName: '', onboardingComplete: false, grossAnnualIncome: 0, taxJurisdiction: 'england' }
const percentInputValue = (value) => Number((Number(value || 0) * 100).toFixed(4))
const moneyInputValue = (value) => Number(Number(value || 0).toFixed(2))
const propertyGroups = [
  { title: 'Property basics', description: 'Identity, location and physical details', tone: 'blue', rows: [
    ['Address', (p) => formatPropertyAddress(p.flatNumber, p.address), 'text'], ['Postcode', (p) => p.postcode, 'text'],
    ['Bedrooms', (p) => p.bedrooms, 'integer'], ['Area', (p) => `${p.areaSqm} m²`, 'integer', true],
    ['EPC rating', (p) => p.epc, 'text', true], ['First purchased', (p) => shortDate(p.purchaseDate), 'date', true],
  ]},
  { title: 'Value & leverage', description: 'Acquisition, debt and current equity position', tone: 'ink', rows: [
    ['Purchase price', (p) => currency(p.purchasePrice), 'money', true], ['Home report at purchase', (p) => currency(p.homeReportPurchase), 'money', true],
    ['Latest valuation', (p) => currency(p.latestValuation), 'money'], ['Expected value at remortgage', (p) => currency(p.expectedRemortgageValue), 'money', true],
    ['Loan amount', (p) => currency(p.loanAmount), 'money-negative'], ['Equity', (p) => currency(p.equity), 'money-positive'],
    ['Current LTV', (p) => percent(p.currentLtv), 'percent'], ['Expected LTV at remortgage', (p) => percent(p.expectedRemortgageLtv), 'percent', true],
    ['Releasable equity at 75% LTV', (p) => currency(p.releasableEquity), 'money-positive', true],
  ]},
  { title: 'Income & performance', description: 'Rent, finance costs and return metrics', tone: 'green', rows: [
    ['Monthly rent', (p) => currency(p.rent), 'money-positive'], ['Monthly mortgage', (p) => currency(p.monthlyPayment, 0), 'money-negative'],
    ['Gross yield', (p) => percent(p.grossYield, 2), 'percent', true], ['Net yield', (p) => percent(p.netYield, 2), 'percent', true],
    ['Interest coverage ratio', (p) => percent(p.icr, 0), 'percent', true], ['Annual appreciation', (p) => currency(p.appreciationAnnual), 'money-positive', true],
    ['Voids since ownership', (p) => p.ownedDays ? `${p.voidDays} / ${p.ownedDays} days (${percent(p.voidRate, 1)})` : 'Purchase date required', 'text', true],
    ['Actual interest rate', (p) => formatRateComposition(p.baseRate, p.currentRate), 'percent', true], ['Current lender', (p) => p.lender, 'text', true],
  ]},
  { title: 'Key dates', description: 'Remortgage and compliance milestones', tone: 'amber', rows: [
    ['Next remortgage', (p) => shortDate(p.nextRemortgage), 'date'], ['Call broker', (p) => shortDate(p.brokerDate), 'date'],
    ['Gas certificate expiry', (p) => shortDate(p.gasExpiry), 'date', true], ['EICR expiry', (p) => shortDate(p.eicrExpiry), 'date', true],
    ['PAT testing expiry', (p) => shortDate(p.patExpiry), 'date', true], ['EPC expiry', (p) => shortDate(p.epcExpiry), 'date', true],
  ]},
]

const scenarioMeta = [
  { name: 'Conservative', note: 'Expected cash flow', colour: '#b35c54' },
  { name: 'No voids', note: 'Assumes full occupancy', colour: '#c78b3e' },
  { name: 'No repairs or voids', note: 'Best-case operating ceiling', colour: '#27795c' },
]

const overviewScenarioMeta = [
  {
    title: 'Conservative',
    selector: 'Conservative',
    note: 'Voids + repair reserve included',
  },
  {
    title: 'Full occupancy',
    selector: 'Full occupancy',
    note: 'No void allowance · repair reserve included',
  },
  {
    title: 'Maximum cash',
    selector: 'Maximum',
    note: 'No voids · no repair reserve',
  },
]

const modelInputFields = [
  ['appreciationRate', 'Annual appreciation', '%', 'percent'],
  ['rateShock', 'Interest rate shock', '%', 'percent', null, 'Adds this many percentage points to every BTL mortgage rate throughout the model.'],
  ['associatedCompanies', 'Associated companies', 'companies', 'number', 'company', 'Other companies associated for Corporation Tax threshold purposes. Enter the number of other associated companies.'],
  ['accountingPeriodMonths', 'CT accounting period', 'months', 'number', 'company', 'Corporation Tax thresholds are reduced for accounting periods shorter than 12 months.'],
  ['augmentedProfitDistributions', 'Qualifying distributions', '£ / period', 'number', 'company', 'Qualifying distributions included in augmented profits for Corporation Tax marginal-relief thresholds. Usually zero for a property SPV.'],
  ['managementRate', 'Management fee', '%', 'percent', null, 'Applied to monthly rent only when the Fully managed option is enabled.'],
  ['cashHeld', 'Cash held', '£', 'number'],
  ['bufferMonths', 'Target buffer', 'months', 'number', null, 'The target cash reserve expressed as months of fixed and variable property costs.'],
]

const workspaceNavigation = [
  ['Overview', 'Overview', Gauge, 'PORTFOLIO'],
  ['Properties', 'Properties', Home, 'PORTFOLIO'],
  ['Tenants', 'Tenants', Users, 'PORTFOLIO'],
  ['Costs & Cash Flows', 'Costs', ReceiptText, 'PORTFOLIO'],
  ['Expenses', 'Expenses', FileText, 'PORTFOLIO'],
  ['Banking', 'Banking', WalletCards, 'PORTFOLIO'],
  ['Projections', 'Projections', TrendingUp, 'PLANNING'],
  ['Acquisition Simulator', 'Acquisition', MapPin, 'PLANNING'],
  ['Remortgage Simulator', 'Remortgage', RefreshCw, 'PLANNING'],
  ['Compliance', 'Compliance', ShieldCheck, 'PLANNING'],
  ['Companies House', 'Companies', Landmark, 'COMPANY'],
  ['IDs & Credentials', 'Credentials', KeyRound, 'COMPANY'],
  ['Plan & billing', 'Plan', Sparkles, 'ACCOUNT'],
]

const navigationGroups = ['PORTFOLIO', 'PLANNING', 'COMPANY', 'ACCOUNT']

const sectionMeta = {
  Overview: {
    eyebrow: 'PORTFOLIO',
    title: 'Portfolio overview',
    description: 'See value, equity, cash flow and resilience across the properties included in your model.',
  },
  Properties: {
    eyebrow: 'PROPERTY DETAILS',
    title: 'Properties',
    description: 'Compare the key facts, values, borrowing and performance of each BTL.',
  },
  Tenants: {
    eyebrow: 'TENANCIES',
    title: 'Tenants',
    description: 'Keep current and historic tenancy details linked to the right property.',
  },
  'Costs & Cash Flows': {
    eyebrow: 'MONTHLY MODEL',
    title: 'Costs & Cash Flows',
    description: 'Review the income and recurring costs that drive your portfolio cash flow.',
  },
  Expenses: {
    eyebrow: 'HISTORICAL LEDGER',
    title: 'Expenses',
    description: 'Record actual income and spending, then filter the ledger when you need it.',
  },
  Banking: {
    eyebrow: 'CONNECTED ACCOUNTS',
    title: 'Banking',
    description: 'Review connected balances, transactions and actual cash-flow history.',
  },
  Projections: {
    eyebrow: 'FORWARD VIEW',
    title: 'Projections',
    description: 'Explore how cash and value may develop under different operating assumptions.',
  },
  'Acquisition Simulator': {
    eyebrow: 'PURCHASE PLANNING',
    title: 'Acquisition Simulator',
    description: 'Import or enter a potential BTL and calculate the cash required to complete the purchase.',
  },
  'Remortgage Simulator': {
    eyebrow: 'FINANCE DECISIONS',
    title: 'Remortgage Simulator',
    description: 'Compare mortgage options side by side and see the monthly cash-flow effect.',
  },
  Compliance: {
    eyebrow: 'KEY DATES',
    title: 'Compliance',
    description: 'See upcoming remortgage and compliance dates across the active portfolio.',
  },
  'Companies House': {
    eyebrow: 'COMPANY RECORD',
    title: 'Companies House',
    description: 'Check your company against the official public register and upcoming filing dates.',
  },
  'IDs & Credentials': {
    eyebrow: 'PRIVATE RECORDS',
    title: 'IDs & Credentials',
    description: 'Keep important IDs, reference numbers and filing codes organised in one private workspace.',
  },
  'Plan & billing': {
    eyebrow: 'ACCOUNT',
    title: 'Plan & billing',
    description: 'Review your access level and manage your subscription.',
  },
}


function AnimatedNumber({ value, duration = 1000, decimals = 1 }) {
  const numericValue = Number(value || 0)
  const [displayValue, setDisplayValue] = useState(numericValue)
  const previousValue = useRef(numericValue)

  useEffect(() => {
    const from = previousValue.current
    const to = numericValue
    previousValue.current = to

    if (from === to || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(to)
      return undefined
    }

    let frame = 0
    const startedAt = performance.now()
    const ease = (progress) => 1 - Math.pow(1 - progress, 3)

    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      setDisplayValue(from + (to - from) * ease(progress))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [numericValue, duration])

  return displayValue.toFixed(decimals)
}


function AnimatedBufferRing({
  cashHeld,
  safeCashNeeded,
  bufferMonths,
  expanded,
  onToggle,
  duration = 1000,
}) {
  const target = useMemo(
    () => bufferVisualTarget(cashHeld, safeCashNeeded),
    [cashHeld, safeCashNeeded],
  )
  const [visual, setVisual] = useState(target)
  const currentVisual = useRef(target)

  useEffect(() => {
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion || typeof requestAnimationFrame !== 'function') {
      currentVisual.current = target
      setVisual(target)
      return undefined
    }

    const from = currentVisual.current
    if (
      Math.abs(from.progress - target.progress) < 0.001
      && from.colour.toLowerCase() === target.colour.toLowerCase()
    ) {
      currentVisual.current = target
      setVisual(target)
      return undefined
    }

    let frame = 0
    const startedAt = performance.now()

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const next = interpolateBufferVisual(from, target, progress)
      currentVisual.current = next
      setVisual(next)

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        currentVisual.current = target
        setVisual(target)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return <button
    type="button"
    className="buffer-ring mobile-buffer-toggle"
    aria-expanded={expanded}
    aria-label={`${expanded ? 'Hide' : 'Show'} safety cash buffer details`}
    onClick={onToggle}
    style={{
      '--value': `${visual.progress}%`,
      '--buffer-colour': visual.colour,
    }}
  >
    <svg
      className="buffer-ring-desktop-visual"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="buffer-ring-desktop-track" cx="50" cy="50" r="45" pathLength="100" />
      <circle
        className="buffer-ring-desktop-progress"
        cx="50"
        cy="50"
        r="45"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={bufferStrokeOffset(visual.progress)}
        stroke={visual.colour}
      />
    </svg>
    <div>
      <strong><AnimatedNumber value={bufferMonths} duration={duration} decimals={1} /></strong>
      <span>months</span>
    </div>
  </button>
}

function MetricCard({ eyebrow, value, delta, icon: Icon, tone = 'neutral', disabled = false, className = '', children = null }) {
  return (
    <article className={`metric-card ${tone} ${className} ${disabled ? 'not-applicable' : ''}`} title={disabled ? 'Not used for private landlords.' : undefined}>
      <div className="metric-top"><span>{eyebrow}</span><Icon size={18} strokeWidth={1.8} /></div>
      <strong>{value}</strong>
      {delta && <small>{delta}</small>}
      {children}
    </article>
  )
}

function overviewPropertySubtitle(property) {
  const address = formatPropertyAddress(property.flatNumber, property.address) || 'Address not set'
  return property.postcode ? `${address} · ${property.postcode}` : address
}

function OverviewPropertyMetric({ label, value, emphasis = false }) {
  return <span className={`overview-property-metric ${emphasis ? 'emphasis' : ''}`}>
    <small>{label}</small>
    <b>{value}</b>
  </span>
}

function OverviewLtvBar({ property, compact = false }) {
  const ltv = Math.min(1, Math.max(0, Number(property.currentLtv) || 0))
  return <span
    className={`overview-property-ltv-bar ${compact ? 'compact' : ''}`}
    role="img"
    aria-label={`Current LTV ${percent(ltv, 1)}`}
  >
    <span style={{ width: `${ltv * 100}%` }} />
  </span>
}

function OverviewPropertyActionMenu({ property, onEdit, onClone, onToggle }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus?.({ preventScroll: true }))
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const runAction = (event, action) => {
    event.stopPropagation()
    setOpen(false)
    action()
  }

  return <span className="overview-property-action-menu" ref={rootRef} onPointerDown={(event) => event.stopPropagation()}>
    <button
      ref={triggerRef}
      type="button"
      className="overview-property-menu-trigger"
      aria-label={`More actions for ${property.name}`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(event) => {
        event.stopPropagation()
        setOpen((current) => !current)
      }}
    >
      <span aria-hidden="true">•••</span>
    </button>
    {open && <span className="overview-property-menu-popover" role="menu" aria-label={`${property.name} actions`}>
      <button type="button" role="menuitem" onClick={(event) => runAction(event, () => onEdit(property.id))}>
        <Pencil size={15} /><span>Edit</span>
      </button>
      <button type="button" role="menuitem" onClick={(event) => runAction(event, () => onClone(property.id))}>
        <Copy size={15} /><span>Duplicate</span>
      </button>
      <button type="button" role="menuitem" onClick={(event) => runAction(event, () => onToggle(property.id))}>
        <Check size={15} /><span>{property.active ? 'Exclude from totals' : 'Include in totals'}</span>
      </button>
    </span>}
  </span>
}

function PropertyCard({ property, onEdit, onClone, onToggle }) {
  const subtitle = overviewPropertySubtitle(property)
  return <article className={`overview-property-card ${property.active ? '' : 'muted'}`}>
    <button
      type="button"
      className="overview-property-card-open"
      aria-label={`Open ${property.name} property details`}
      onClick={() => onEdit(property.id)}
    >
      <span className="overview-property-card-top">
        <span className="overview-property-card-identity">
          <b>{property.name}</b>
          <small>{subtitle}</small>
        </span>
        <span className="overview-property-card-ltv-pill">{percent(property.currentLtv, 1)} LTV</span>
      </span>
      <span className="overview-property-card-value">
        <strong>{currency(property.latestValuation)}</strong>
        <small>Current value</small>
      </span>
      <span className="overview-property-card-ltv-line"><small>Loan to value</small><b>{percent(property.currentLtv, 1)}</b></span>
      <OverviewLtvBar property={property} />
      <span className="overview-property-card-metrics">
        <OverviewPropertyMetric label="Equity" value={currency(property.equity)} emphasis />
        <OverviewPropertyMetric label="Rent / mo" value={currency(property.rent)} />
        <OverviewPropertyMetric label="Net yield" value={percent(property.netYield, 1)} />
        <OverviewPropertyMetric label="Mortgage / mo" value={currency(property.monthlyPayment, 0)} />
      </span>
    </button>
    <OverviewPropertyActionMenu property={property} onEdit={onEdit} onClone={onClone} onToggle={onToggle} />
  </article>
}

function OverviewPropertyRow({ property, onEdit, onClone, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const subtitle = overviewPropertySubtitle(property)

  return <article className={`overview-property-row ${expanded ? 'expanded' : ''} ${property.active ? '' : 'muted'}`}>
    <span className="overview-property-row-top">
      <button
        type="button"
        className="overview-property-row-toggle"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${property.name} property overview`}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="overview-property-row-index">{property.name.replace(/\D/g, '') || '•'}</span>
        <span className="overview-property-row-identity">
          <b>{property.name}</b>
          <small>{subtitle}</small>
        </span>
        <span className="overview-property-row-key">
          <OverviewPropertyMetric label="Value" value={currency(property.latestValuation)} emphasis />
          <OverviewPropertyMetric label="LTV" value={percent(property.currentLtv, 1)} />
        </span>
        <span className="overview-property-row-quick">
          <OverviewPropertyMetric label="Equity" value={currency(property.equity)} emphasis />
          <OverviewPropertyMetric label="Rent / mo" value={currency(property.rent)} />
          <OverviewPropertyMetric label="Net yield" value={percent(property.netYield, 1)} />
        </span>
        <span className="overview-property-row-chevron" aria-hidden="true">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      <OverviewPropertyActionMenu property={property} onEdit={onEdit} onClone={onClone} onToggle={onToggle} />
    </span>

    <div className="overview-property-row-shell" aria-hidden={!expanded}>
      <div className="overview-property-row-inner">
        <PropertyFinancingSummary property={property} variant="row" />
        <div className="overview-property-row-metrics overview-property-row-detail-metrics">
          <div><span>Rent / mo</span><b>{currency(property.rent)}</b></div>
          <div><span>Mortgage / mo</span><b>{currency(property.monthlyPayment, 0)}</b></div>
          <div><span>Net yield</span><b>{percent(property.netYield, 1)}</b></div>
          <div><span>Current rate</span><b>{percent(property.currentRate, 2)}</b></div>
        </div>
        <div className="overview-property-row-lender">
          <span>Lender</span><b>{property.lender || 'Not set'}</b>
        </div>
        <div className="overview-property-row-open-action">
          <button type="button" onClick={() => onEdit(property.id)}>Open property <ArrowUpRight size={15} /></button>
        </div>
      </div>
    </div>
  </article>
}

function OverviewPropertyMiniCard({ property, onEdit, onClone, onToggle }) {
  const subtitle = overviewPropertySubtitle(property)
  return <article className={`overview-property-mini-card ${property.active ? '' : 'muted'}`}>
    <button
      type="button"
      className="overview-property-mini-open"
      aria-label={`Open ${property.name} property details`}
      onClick={() => onEdit(property.id)}
    >
      <span className="overview-property-mini-identity">
        <b>{property.name}</b>
        <small>{subtitle}</small>
      </span>
      <span className="overview-property-mini-value">
        <strong>{currency(property.latestValuation)}</strong>
        <small>Value</small>
      </span>
      <span className="overview-property-mini-metrics">
        <OverviewPropertyMetric label="LTV" value={percent(property.currentLtv, 1)} />
        <OverviewPropertyMetric label="Rent / mo" value={currency(property.rent)} />
        <OverviewPropertyMetric label="Net yield" value={percent(property.netYield, 1)} />
      </span>
    </button>
    <OverviewPropertyActionMenu property={property} onEdit={onEdit} onClone={onClone} onToggle={onToggle} />
  </article>
}


const overviewPropertyViewOptions = [
  ['cards', 'Cards'],
  ['rows', 'Rows'],
  ['mini', 'Mini'],
]

function OverviewPropertyViewSelector({ value, onChange }) {
  return <div
    className="overview-property-view-selector"
    data-view={value}
    role="radiogroup"
    aria-label="Property overview display"
  >
    {overviewPropertyViewOptions.map(([id, label]) => <button
      key={id}
      type="button"
      role="radio"
      aria-checked={value === id}
      className={value === id ? 'selected' : ''}
      onClick={() => onChange(id)}
    >{label}</button>)}
  </div>
}

function ModelInputFields({ settings, onSettingChange, onPercentChange, compact = false }) {
  const isPrivate = settings.accountType === 'private'
  return <div className={compact ? 'sidebar-input-list' : 'assumptions-grid'}>{modelInputFields.map(([key, label, suffix, type, scope, help]) => {
    const disabled = scope === 'company' && isPrivate
    return <label key={key} className={disabled ? 'not-applicable' : ''} title={disabled ? 'Not used for private landlords.' : undefined}><span>{label}{help && <button type="button" className="model-help" aria-label={`${label}: ${help}`} data-tooltip={help}><CircleHelp size={13} /></button>}</span><div><input aria-label={label} disabled={disabled} type="number" step={type === 'percent' ? '0.1' : 'any'} value={type === 'percent' ? percentInputValue(settings[key]) : settings[key]} onChange={(event) => type === 'percent' ? onPercentChange(key, event.target.value) : onSettingChange(key, Number(event.target.value))} /><b>{suffix}</b></div></label>
  })}</div>
}

function PrivateLandlordInputs({ settings, onSettingChange, compact = false }) {
  if (settings.accountType !== 'private') return null
  const moneyField = (key, label, note) => <label><span>{label}</span><div className="private-income-field"><b>£</b><input aria-label={label} type="number" min="0" step="100" value={Number(settings[key] || 0)} onChange={(event) => onSettingChange(key, Number(event.target.value))} /></div>{note && <small>{note}</small>}</label>
  return <section className={`private-tax-inputs ${compact ? 'compact' : ''}`}><header><PoundSterling size={15} /><div><b>Private landlord tax</b><small>Tax-year-aware planning assumptions</small></div></header>{moneyField('grossAnnualIncome', 'Other gross annual income', 'Before property income; excludes savings and dividends.')}{!Number(settings.grossAnnualIncome) && <small className="tax-input-warning">Currently assumes you have no other taxable income.</small>}{moneyField('propertyLossBroughtForward', 'Property loss brought forward', 'Unused loss from the same property business.')}{moneyField('financeCostsBroughtForward', 'Finance costs brought forward', 'Unused restricted residential finance costs from earlier tax years.')}<div className="tax-jurisdiction"><span>Tax jurisdiction</span><div><button className={settings.taxJurisdiction !== 'scotland' ? 'active' : ''} onClick={() => onSettingChange('taxJurisdiction', 'england')}>England / Wales / NI</button><button className={settings.taxJurisdiction === 'scotland' ? 'active' : ''} onClick={() => onSettingChange('taxJurisdiction', 'scotland')}>Scotland</button></div></div></section>
}

const companiesHouseRequest = async (params) => {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(`/api/companies-house?${new URLSearchParams(params)}`, {
    headers: { authorization: `Bearer ${data.session?.access_token || ''}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Companies House is temporarily unavailable.')
    error.code = payload.code
    throw error
  }
  return payload
}

function CompaniesHouseWorkspace({ settings, onSettingChange }) {
  const [query, setQuery] = useState(settings.companyName || '')
  const [results, setResults] = useState([])
  const [details, setDetails] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const loadCompany = async (companyNumber) => {
    setStatus('loading')
    setError('')
    try {
      const company = await companiesHouseRequest({ mode: 'company', number: companyNumber })
      setDetails(company)
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus(requestError.code === 'not_configured' ? 'not-configured' : 'error')
    }
  }

  useEffect(() => {
    if (settings.companyNumber) loadCompany(settings.companyNumber)
    else setDetails(null)
  }, [settings.companyNumber])

  const searchCompanies = async (event) => {
    event.preventDefault()
    setStatus('searching')
    setError('')
    try {
      const response = await companiesHouseRequest({ mode: 'search', q: query })
      setResults(response.items)
      setStatus('results')
    } catch (requestError) {
      setError(requestError.message)
      setStatus(requestError.code === 'not_configured' ? 'not-configured' : 'error')
    }
  }

  const selectCompany = (company) => {
    onSettingChange('companyNumber', company.company_number)
    onSettingChange('companyMatchedName', company.title)
    onSettingChange('companyName', settings.companyName || company.title)
    setResults([])
  }

  if (status === 'not-configured') return <section className="panel ch-setup-needed"><AlertTriangle /><div><span className="kicker">ONE-TIME CONNECTION</span><h2>Companies House needs an API key</h2><p>The workspace is ready, but the free server-side Companies House credential has not been added to Cloudflare yet.</p></div></section>

  if (settings.companyNumber && status === 'loading' && !details) return <div className="app-inline-loading"><RefreshCw /><b>Checking Companies House…</b></div>

  if (!settings.companyNumber || !details) return <div className="companies-house-workspace"><section className="panel ch-search-panel"><span className="ch-mark"><Landmark /></span><span className="kicker">OFFICIAL PUBLIC REGISTER</span><h2>Connect your company</h2><p>Search by company name, then confirm the exact legal entity. The app saves its unique company number, not an ambiguous name.</p><form onSubmit={searchCompanies}><label><Search /><input aria-label="Companies House company name" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company name" /></label><button className="primary-button" disabled={status === 'searching' || query.trim().length < 2}>{status === 'searching' ? 'Searching…' : 'Search Companies House'}</button></form>{error && <p className="ch-error">{error}</p>}{results.length > 0 && <div className="ch-search-results">{results.map((company) => <button key={company.company_number} onClick={() => selectCompany(company)}><span><b>{company.title}</b><small>{company.company_number} · {company.company_status || 'Status unavailable'}</small><small>{formatCompanyAddress(company.address)}</small></span><ArrowUpRight /></button>)}</div>}</section></div>

  const { profile, filings, officers, psc, charges, fetchedAt } = details
  const deadlines = companyDeadlines(profile)
  const directors = activeOfficers(officers)
  const controllers = activePsc(psc)
  const openCharges = outstandingCharges(charges)
  const verification = identityVerificationSummary(officers, psc)
  const officialUrl = officialCompanyUrl(profile.company_number)
  return <div className="companies-house-workspace"><section className="panel ch-company-hero"><header><div><span className="kicker">COMPANIES HOUSE RECORD</span><h2>{profile.company_name}</h2><p>{profile.company_number} · Incorporated {shortDate(profile.date_of_creation)}</p></div><div className="ch-hero-actions"><span className={`ch-status ${profile.company_status === 'active' ? 'active' : 'warning'}`}>{profile.company_status}</span><button className="secondary-button small" onClick={() => loadCompany(profile.company_number)}><RefreshCw size={15} /> Refresh</button><a className="secondary-button small" href={officialUrl} target="_blank" rel="noreferrer">Official record <ExternalLink size={14} /></a></div></header><div className="ch-profile-grid"><div><span>Registered office</span><b>{formatCompanyAddress(profile.registered_office_address) || 'Not published'}</b></div><div><span>Company type</span><b>{(profile.type || 'Not published').replaceAll('-', ' ')}</b></div><div><span>SIC codes</span><b>{profile.sic_codes?.join(', ') || 'Not published'}</b></div><div><span>Last checked</span><b>{fetchedAt ? new Date(fetchedAt).toLocaleString('en-GB') : 'Just now'}</b></div></div></section>

  <section className="ch-metrics-grid">{deadlines.map((deadline) => <article className={`panel ch-deadline ${deadline.status}`} key={deadline.id}><CalendarClock /><span>{deadline.label}</span><strong>{shortDate(deadline.date)}</strong><small>{deadline.status === 'overdue' ? `${Math.abs(deadline.days)} days overdue` : deadline.days === 0 ? 'Due today' : `${deadline.days} days remaining`}</small></article>)}<article className="panel ch-register-metric"><Users /><span>Active appointments</span><strong>{directors.length} <small>officers</small> · {controllers.length} <small>PSCs</small></strong><small>{verification.published ? `${verification.verified} verified · ${verification.due} due` : 'Verification detail not published'}</small></article><article className="panel ch-register-metric"><Landmark /><span>Outstanding charges</span><strong>{openCharges.length}</strong><small>{openCharges.length ? 'Review lender security below' : 'None shown on the register'}</small></article></section>

  <div className="ch-detail-grid"><section className="panel ch-list-panel"><header><div><span className="kicker">RECENT FILINGS</span><h2>Filing history</h2></div><a href={`${officialUrl}/filing-history`} target="_blank" rel="noreferrer">View all <ExternalLink size={13} /></a></header><div>{(filings?.items || []).slice(0, 8).map((filing) => <article key={filing.transaction_id}><FileText /><span><b>{(filing.description || filing.category || 'Filing').replaceAll('-', ' ')}</b><small>{shortDate(filing.date)} · {filing.category}</small></span></article>)}{!filings?.items?.length && <p className="ch-empty">No filing history returned.</p>}</div></section>
  <section className="panel ch-list-panel"><header><div><span className="kicker">PEOPLE & CONTROL</span><h2>Officers and PSCs</h2></div><a href={`${officialUrl}/officers`} target="_blank" rel="noreferrer">Official list <ExternalLink size={13} /></a></header><div>{directors.slice(0, 6).map((person) => <article key={`officer-${person.links?.officer?.appointments || person.name}`}><Users /><span><b>{person.name}</b><small>{person.officer_role?.replaceAll('-', ' ')} · appointed {shortDate(person.appointed_on)}</small></span></article>)}{controllers.slice(0, 6).map((person) => <article key={`psc-${person.links?.self || person.name}`}><ShieldCheck /><span><b>{person.name}</b><small>Person with significant control</small></span></article>)}{!directors.length && !controllers.length && <p className="ch-empty">No active people returned.</p>}</div></section></div>

  <section className="panel ch-list-panel ch-charges"><header><div><span className="kicker">REGISTERED SECURITY</span><h2>Outstanding charges</h2></div><a href={`${officialUrl}/charges`} target="_blank" rel="noreferrer">Official register <ExternalLink size={13} /></a></header><div>{openCharges.map((charge) => <article key={charge.links?.self || charge.charge_number}><Landmark /><span><b>{charge.persons_entitled?.map((person) => person.name).join(', ') || 'Charge holder not published'}</b><small>{charge.classification?.description || 'Registered charge'} · delivered {shortDate(charge.delivered_on)}</small></span><em>{charge.status || 'outstanding'}</em></article>)}{!openCharges.length && <p className="ch-empty">No outstanding charges returned.</p>}</div></section>
  <button className="text-button ch-unlink" onClick={() => { onSettingChange('companyNumber', ''); onSettingChange('companyMatchedName', '') }}>Choose a different company</button></div>
}

function AccountProfileEditor({ settings, onChange }) {
  const isPrivate = settings.accountType === 'private'
  return <details className="sidebar-profile-editor sidebar-disclosure">
    <summary>
      <Building2 size={15} />
      <div><b>Portfolio profile</b><small>{isPrivate ? 'Private landlord' : settings.companyName || 'Limited company'}</small></div>
      <ChevronDown className="sidebar-disclosure-chevron" size={16} />
    </summary>
    <div className="sidebar-disclosure-body">
      <div className="account-type-toggle"><button className={!isPrivate ? 'active' : ''} onClick={() => onChange('accountType', 'company')}>Company</button><button className={isPrivate ? 'active' : ''} onClick={() => onChange('accountType', 'private')}>Private</button></div>
      <label className={isPrivate ? 'not-applicable' : ''} title={isPrivate ? 'Not used for private landlords.' : undefined}><span>Company name <small>optional</small></span><input disabled={isPrivate} value={settings.companyName || ''} onChange={(event) => onChange('companyName', event.target.value)} placeholder="Property company" /></label>
    </div>
  </details>
}

function AccountSetupModal({ onComplete }) {
  const [accountType, setAccountType] = useState('company')
  const [companyName, setCompanyName] = useState('')
  const isPrivate = accountType === 'private'
  return <div className="setup-layer"><section className="setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title"><span className="setup-icon">{isPrivate ? <Home /> : <Building2 />}</span><span className="kicker">ONE QUICK DETAIL</span><h2 id="setup-title">How do you hold your properties?</h2><p>This keeps company-only fields out of the way when they do not apply.</p><div className="setup-account-types"><button className={!isPrivate ? 'active' : ''} onClick={() => setAccountType('company')}><Building2 /><span><b>Limited company</b><small>Company costs and corporation tax</small></span><Check /></button><button className={isPrivate ? 'active' : ''} onClick={() => setAccountType('private')}><Home /><span><b>Private landlord</b><small>Personal property portfolio</small></span><Check /></button></div>{!isPrivate && <label className="setup-company-name"><span>Company name <small>optional</small></span><input autoFocus value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Quark Holdings" /></label>}<button className="primary-button setup-continue" onClick={() => onComplete({ accountType, companyName: isPrivate ? '' : companyName.trim(), onboardingComplete: true })}>Continue to portfolio <ArrowUpRight size={17} /></button></section></div>
}

function PropertyFinancingSummary({ property, variant = 'card' }) {
  const ltv = Math.max(0, Math.min(1, Number(property.currentLtv || 0)))
  return <section className={`property-financing property-financing-${variant}`} aria-label={`${property.name} asset financing`}>
    <div className="property-financing-heading">
      <span>Asset financing</span>
      <b>{percent(ltv, 1)} LTV</b>
    </div>
    <div className="property-financing-track-wrap" aria-hidden="true">
      <div className="asset-track property-financing-track">
        <span className="asset-value-bar" />
        <span className="asset-loan-bar" style={{ width: `${ltv * 100}%` }}>
          <span className="asset-ltv-label">LTV {percent(ltv, 1)}</span>
        </span>
      </div>
    </div>
    <div className="property-financing-numbers">
      <span><b>{currency(property.latestValuation)}</b><small>Value</small></span>
      <span><b>{currency(property.loanAmount)}</b><small>Loan</small></span>
      <span><b>{currency(property.equity)}</b><small>Equity</small></span>
    </div>
  </section>
}

function ModelControls({ settings, onChange, compact = false }) {
  const controls = [
    ['fullyManaged', 'Fully managed', false, 'Applies the management fee to rent actually collected in each scenario.'],
  ]
  return (
    <div className={`model-controls ${compact ? 'compact' : ''}`}>
      {controls.map(([key, label, disabled, help]) => <label key={key} className={`${settings[key] ? 'selected' : ''} ${disabled ? 'not-applicable' : ''}`} title={help}><input disabled={disabled} type="checkbox" checked={Boolean(settings[key])} onChange={(event) => onChange(key, event.target.checked)} /><i><Check size={12} /></i><span>{label}</span><span className="model-help" data-tooltip={help} aria-hidden="true"><CircleHelp size={13} /></span></label>)}
    </div>
  )
}

function ScenarioTable({ scenarios, count, accountType = 'company', variant = 'default' }) {
  const isPrivate = accountType === 'private'
  const [mobileScenario, setMobileScenario] = useState(0)
  const [desktopScenarios, setDesktopScenarios] = useState(() => new Set([0, 1, 2]))

  const selectScenario = (index) => {
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      setMobileScenario(index)
      return
    }

    setDesktopScenarios((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        if (next.size === 1) return current
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

if (variant === 'overview') {
    return <div
      className="overview-cashflow-scenarios"
      data-mobile-scenario={mobileScenario}
    >
      <div className="overview-cashflow-selector" role="group" aria-label="Cash flow scenarios">
        {overviewScenarioMeta.map((copy, index) => {
          const desktopSelected = desktopScenarios.has(index)
          return <button
            type="button"
            key={copy.title}
            className={`${mobileScenario === index ? 'mobile-active' : ''} ${desktopSelected ? 'desktop-active' : ''}`}
            aria-pressed={desktopSelected}
            style={{ '--scenario': scenarioMeta[index].colour }}
            onClick={() => selectScenario(index)}
          >
            <span>{copy.selector}</span>
          </button>
        })}
      </div>

      <div className="overview-cashflow-card-grid">
        {scenarios.map((scenario, index) => {
          const copy = overviewScenarioMeta[index]
          const positive = Number(scenario.cashflow || 0) >= 0
          const monthlyLabel = isPrivate ? 'Net cash flow' : 'Company + extraction cash'
          const monthlyNote = isPrivate
            ? 'After estimated income tax'
            : 'Before personal tax on extraction'

          return <article
            className={`overview-cashflow-card overview-cashflow-card-${index} ${desktopScenarios.has(index) ? 'desktop-selected' : 'desktop-hidden'} ${positive ? 'positive-flow' : 'negative-flow'}`}
            key={scenario.id}
            style={{ '--scenario': scenarioMeta[index].colour }}
          >
            <header className="overview-cashflow-card-head">
              <span className="overview-cashflow-scenario-dot" aria-hidden="true" />
              <span className="overview-cashflow-scenario-copy">
                <b>{copy.title}</b>
                <small>{copy.note}</small>
              </span>
              <span className="overview-cashflow-scenario-index">Scenario {scenario.id}</span>
            </header>

            <div className="overview-cashflow-hero">
              <span className="overview-cashflow-label">{monthlyLabel}</span>
              <div className="overview-cashflow-hero-number">
                <strong>{currency(scenario.cashflow)}</strong>
                <small>/ month</small>
              </div>
              <p>{monthlyNote}</p>
              <div className="overview-cashflow-annual">
                <span>Annual cash flow</span>
                <b>{currency(scenario.cashflow * 12)}</b>
              </div>
            </div>

            <dl className="overview-cashflow-secondary">
              <div>
                <dt>Tax</dt>
                <dd>{currency(scenario.tax)}<small>/ month</small></dd>
              </div>
              <div>
                <dt>Per property</dt>
                <dd>{currency(count ? scenario.cashflow / count : 0)}<small>/ month</small></dd>
              </div>
              <div className="overview-cashflow-total-gain">
                <dt>
                  <span>Total gain</span>
                  <small>Cash flow + appreciation</small>
                </dt>
                <dd>{currency(scenario.totalGain * 12)}<small>/ year</small></dd>
              </div>
            </dl>
          </article>
        })}
      </div>
    </div>
  }

  return <div className="scenario-table scenario-selector-enabled" data-mobile-scenario={mobileScenario}>
    <div className="overview-scenario-toggle scenario-selector" role="group" aria-label="Cashflow scenarios">
      {scenarioMeta.map((scenario, index) => {
        const desktopSelected = desktopScenarios.has(index)
        return <button
          type="button"
          key={scenario.name}
          className={`${mobileScenario === index ? 'mobile-active' : ''} ${desktopSelected ? 'desktop-active' : ''}`}
          aria-pressed={desktopSelected}
          style={{ '--scenario': scenario.colour }}
          onClick={() => selectScenario(index)}
        >{scenario.name}</button>
      })}
    </div>
    <div className="scenario-list">{scenarios.map((scenario, index) => <div className={`scenario scenario-${index} ${desktopScenarios.has(index) ? 'desktop-selected' : 'desktop-hidden'}`} key={scenario.id} style={{ '--scenario': scenarioMeta[index].colour }}><div><i>{scenario.id}</i><span><b>{scenarioMeta[index].name}</b><small>{scenarioMeta[index].note}</small></span></div><div><span>Tax / mo</span><b className="negative">{currency(scenario.tax)}</b></div><div><span>{isPrivate ? 'Cashflow / mo' : 'Company + extraction / mo'}</span><b className={scenario.cashflow >= 0 ? 'positive' : 'negative'}>{currency(scenario.cashflow)}</b></div><div><span>{isPrivate ? 'Total gain / yr' : 'Total gain / yr (pre-personal-tax)'}</span><b>{currency(scenario.totalGain * 12)}</b></div><div><span>Per flat / mo</span><b>{currency(count ? scenario.cashflow / count : 0)}</b></div></div>)}</div>
  </div>
}

function ProjectionChart({ points, metric, perFlat, count }) {
  const width = 920, height = 300, pad = { left: 72, right: 24, top: 24, bottom: 42 }
  const divisor = perFlat ? Math.max(1, count) : 1
  const values = points.flatMap((point) => point.scenarios.map((scenario) => scenario[metric] / divisor))
  const min = Math.min(0, ...values), max = Math.max(1, ...values), range = max - min || 1
  const x = (index) => pad.left + (index / Math.max(1, points.length - 1)) * (width - pad.left - pad.right)
  const y = (value) => pad.top + ((max - value) / range) * (height - pad.top - pad.bottom)
  const pathFor = (scenarioIndex) => points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(point.scenarios[scenarioIndex][metric] / divisor).toFixed(1)}`).join(' ')
  const ticks = Array.from({ length: 5 }, (_, index) => min + (range * index / 4)).reverse()
  const xTicks = points.filter((point) => point.month % 12 === 0)
  return <div className="projection-chart-wrap"><svg className="projection-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Projection of cumulative ${metric}`}>{ticks.map((tick) => <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="grid-line" /><text x={pad.left - 12} y={y(tick) + 4} textAnchor="end">{currency(tick)}</text></g>)}{xTicks.map((point) => <text key={point.month} x={x(points.indexOf(point))} y={height - 13} textAnchor="middle">{point.month === 0 ? 'Now' : `${point.month / 12}y`}</text>)}{scenarioMeta.map((scenario, index) => <path key={scenario.name} d={pathFor(index)} fill="none" stroke={scenario.colour} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}{scenarioMeta.map((scenario, index) => { const end = points.at(-1).scenarios[index][metric] / divisor; return <circle key={scenario.name} cx={x(points.length - 1)} cy={y(end)} r="5" fill={scenario.colour} stroke="#fff" strokeWidth="2" /> })}</svg><div className="projection-legend">{scenarioMeta.map((scenario) => <span key={scenario.name}><i style={{ background: scenario.colour }} />{scenario.name}</span>)}</div></div>
}


function MobileProjectionChart({ points, metric, perFlat, count, scenarioIndex }) {
  const width = 320
  const height = 150
  const pad = { left: 12, right: 12, top: 16, bottom: 25 }
  const divisor = perFlat ? Math.max(1, count) : 1
  const annual = points.filter((point) => point.month === 0 || point.month % 12 === 0)
  const values = annual.map((point) => point.scenarios[scenarioIndex][metric] / divisor)
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const range = max - min || 1
  const x = (index) => pad.left + (index / Math.max(1, annual.length - 1)) * (width - pad.left - pad.right)
  const y = (value) => pad.top + ((max - value) / range) * (height - pad.top - pad.bottom)
  const path = annual.map((point, index) => {
    const value = point.scenarios[scenarioIndex][metric] / divisor
    return `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`
  }).join(' ')
  const latest = values.at(-1) || 0
  const colour = scenarioMeta[scenarioIndex].colour

  return <div className="projection-mobile-chart">
    <div className="projection-mobile-chart-value">
      <span>At horizon</span>
      <strong className={latest >= 0 ? 'positive' : 'negative'}>{currency(latest)}</strong>
    </div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${scenarioMeta[scenarioIndex].name} projection trend`}>
      <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="zero-line" />
      <path d={path} fill="none" stroke={colour} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {annual.map((point, index) => {
        const value = point.scenarios[scenarioIndex][metric] / divisor
        return <circle key={point.month} cx={x(index)} cy={y(value)} r={index === annual.length - 1 ? 4.5 : 3} fill={colour} />
      })}
      <text x={pad.left} y={height - 7}>Now</text>
      <text x={width - pad.right} y={height - 7} textAnchor="end">{settingsLabelFromMonths(points.at(-1)?.month || 0)}</text>
    </svg>
  </div>
}

const settingsLabelFromMonths = (months) => months >= 12 ? `${Math.round(months / 12)}y` : `${months}m`

function MobileProjectionSnapshots({ points, metric, perFlat, count, scenarioIndex }) {
  const divisor = perFlat ? Math.max(1, count) : 1
  const rows = points.filter((point) => point.month > 0 && point.month % 12 === 0)

  return <div className="projection-mobile-snapshots">
    {rows.map((point) => {
      const value = point.scenarios[scenarioIndex][metric] / divisor
      return <article key={point.month}>
        <div>
          <span>{point.month / 12} year{point.month === 12 ? '' : 's'}</span>
          <small>{shortDate(point.date)}</small>
        </div>
        <strong className={value >= 0 ? 'positive' : 'negative'}>{currency(value)}</strong>
      </article>
    })}
  </div>
}


function ProjectionExplorer({ properties, settings, portfolio, onSettingChange }) {
  const [metric, setMetric] = useState('cashPot')
  const [perFlat, setPerFlat] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [mobileScenario, setMobileScenario] = useState(0)
  const [mobileSnapshotsOpen, setMobileSnapshotsOpen] = useState(false)
  const points = useMemo(
    () => projectPortfolio(properties, settings, settings.projectionMonths),
    [properties, settings],
  )
  const tablePoints = points.filter((point) => point.month > 0 && point.month % 12 === 0)
  const isCompany = settings.accountType !== 'private'
  const metricLabels = {
    cashPot: isCompany ? 'Company cash pot' : 'Cash pot',
    totalGain: isCompany ? 'Total gain (pre-personal-tax)' : 'Total gain',
    cashflow: isCompany ? 'Company + extraction cash' : 'Cash flow',
    appreciation: 'Appreciation',
  }
  const divisor = perFlat ? Math.max(1, portfolio.count) : 1

  return <section className="panel projection-explorer">
    <header>
      <div>
        <h2>Scenario accumulation over time</h2>
        <p>Compare how cash and value build across the three operating scenarios.</p>
      </div>
      <div className="projection-duration">
        <span>Horizon</span>
        <select value={settings.projectionMonths} onChange={(event) => onSettingChange('projectionMonths', Number(event.target.value))}>
          <option value={36}>3 years</option>
          <option value={60}>5 years</option>
          <option value={120}>10 years</option>
        </select>
      </div>
    </header>

    <div className="projection-toolbar">
      <div className="segmented projection-metric-selector">
        {Object.entries(metricLabels).map(([key, label]) => <button
          className={metric === key ? 'active' : ''}
          key={key}
          onClick={() => setMetric(key)}
        >{label}</button>)}
      </div>
      <label className="per-flat-toggle">
        <input type="checkbox" checked={perFlat} onChange={(event) => setPerFlat(event.target.checked)} />
        <i />
        <span>Per flat</span>
      </label>
    </div>

    <div className="projection-desktop-view">
      <ProjectionChart points={points} metric={metric} perFlat={perFlat} count={portfolio.count} />
      <button className="projection-table-toggle" onClick={() => setTableOpen((open) => !open)}>
        {tableOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        <span>
          <b>{tableOpen ? 'Hide' : 'Expand'} projection table</b>
          <small>Annual snapshots · {metricLabels[metric]}{perFlat ? ' per flat' : ''}</small>
        </span>
      </button>
      {tableOpen && <div className="projection-table-wrap">
        <table className="projection-table">
          <thead>
            <tr>
              <th>Point in time</th>
              {scenarioMeta.map((scenario) => <th key={scenario.name} style={{ '--scenario': scenario.colour }}>
                {scenario.name}<small>{scenario.note}</small>
              </th>)}
            </tr>
          </thead>
          <tbody>
            {tablePoints.map((point) => <tr key={point.month}>
              <th>{point.month / 12} year{point.month === 12 ? '' : 's'}<small>{shortDate(point.date)}</small></th>
              {point.scenarios.map((scenario, index) => <td key={index} style={{ '--scenario': scenarioMeta[index].colour }}>
                <b>{currency(scenario[metric] / divisor)}</b>
                <span className={scenario[metric] >= 0 ? 'positive' : 'negative'}>{scenario[metric] >= 0 ? 'Positive' : 'Negative'}</span>
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>}
    </div>

    <div className="projection-mobile-view">
      <div className="projection-mobile-scenario-selector" aria-label="Projection scenario">
        {scenarioMeta.map((scenario, index) => <button
          type="button"
          key={scenario.name}
          className={mobileScenario === index ? 'active' : ''}
          style={{ '--scenario': scenario.colour }}
          onClick={() => setMobileScenario(index)}
        >
          <span>{scenario.name}</span>
          <small>{scenario.note}</small>
        </button>)}
      </div>

      <MobileProjectionChart
        points={points}
        metric={metric}
        perFlat={perFlat}
        count={portfolio.count}
        scenarioIndex={mobileScenario}
      />

      <button
        type="button"
        className="projection-mobile-snapshot-toggle"
        aria-expanded={mobileSnapshotsOpen}
        onClick={() => setMobileSnapshotsOpen((open) => !open)}
      >
        <span>
          <b>Annual snapshots</b>
          <small>{metricLabels[metric]}{perFlat ? ' per flat' : ''}</small>
        </span>
        {mobileSnapshotsOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>

      {mobileSnapshotsOpen && <MobileProjectionSnapshots
        points={points}
        metric={metric}
        perFlat={perFlat}
        count={portfolio.count}
        scenarioIndex={mobileScenario}
      />}
    </div>
  </section>
}

const propertyCostFields = [
  ['factorsFees', 'Factors / service charge', 'fixed'],
  ['legionella', 'Legionella budget', 'fixed'],
  ['gasCertificate', 'Gas certificate budget', 'fixed'],
  ['eicr', 'EICR budget', 'fixed'],
  ['mortgageAdmin', 'Mortgage filing budget', 'fixed'],
  ['repairs', 'Repairs budget', 'variable'],
  ['applianceReserve', 'Appliance budget', 'variable'],
]

function LineItemsEditor({
  title,
  description,
  items,
  onChange,
  onAdd,
  onRemove,
  timed = false,
  tone,
  disabled = false,
  collectionKey,
  entryPeriodPreferences,
  onEntryPeriodChange,
}) {
  const total = items.filter((item) => item.enabled !== false).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return <section className={`panel cashflow-editor ${tone} ${disabled ? 'not-applicable' : ''}`} title={disabled ? 'Not used for private landlords.' : undefined}>
    <header>
      <div><span className="kicker">{title}</span><h2>{currency(disabled ? 0 : total)} <small>/ month</small></h2><p>{disabled ? 'Not used for private landlords.' : description}</p></div>
      <button disabled={disabled} className="secondary-button small" onClick={onAdd}><Plus size={15} /> Add line</button>
    </header>
    <div className="cashflow-lines">
      {items.length === 0 && <div className="empty-cashflow"><ReceiptText size={22} /><b>No line items yet</b><span>Add one when this account has a recurring cash flow.</span></div>}
      {items.map((item) => {
        const preferenceKey = `line:${collectionKey}:${item.id}:amount`
        return <details className={`cashflow-line mobile-line-details ${item.enabled === false ? 'disabled' : ''}`} key={item.id}>
          <summary className="mobile-line-summary">
            <span><b>{item.name || 'Untitled line'}</b><small>{item.enabled === false ? 'Paused' : 'Active'}</small></span>
            <strong>{currency(item.amount || 0)}</strong>
            <ChevronDown className="mobile-detail-chevron" size={18} />
          </summary>
          <div className="cashflow-line-fields">
            <label className="cashflow-enabled"><input disabled={disabled} type="checkbox" checked={item.enabled !== false} onChange={(event) => onChange(item.id, 'enabled', event.target.checked)} /><i><Check size={12} /></i></label>
            <label className="cashflow-name"><span>Description</span><input disabled={disabled} value={item.name} onChange={(event) => onChange(item.id, 'name', event.target.value)} placeholder="New recurring item" /></label>
            <label>
              <span>Amount</span>
              <MoneyPeriodInput
                ariaLabel={`${item.name || title} amount`}
                disabled={disabled}
                monthlyValue={item.amount}
                period={moneyEntryPeriodFor(entryPeriodPreferences, preferenceKey)}
                onMonthlyChange={(value) => onChange(item.id, 'amount', value)}
                onPeriodChange={(period) => onEntryPeriodChange(preferenceKey, period)}
              />
            </label>
            <label className="cashflow-tax"><span>Tax treatment</span><select disabled={disabled} value={item.taxDeductible === true ? 'deductible' : 'non-deductible'} onChange={(event) => onChange(item.id, 'taxDeductible', event.target.value === 'deductible')}><option value="non-deductible">Non-deductible</option><option value="deductible">Deductible</option></select></label>
            {timed && <label><span>Months remaining</span><input disabled={disabled} type="number" min="0" step="1" value={item.monthsRemaining || ''} onChange={(event) => onChange(item.id, 'monthsRemaining', Number(event.target.value))} placeholder="Ongoing" /></label>}
            <button disabled={disabled} className="icon-button cashflow-delete" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name || 'line item'}`}><Trash2 size={16} /></button>
          </div>
        </details>
      })}
    </div>
  </section>
}

function CostsWorkspace({
  properties,
  calculated,
  settings,
  portfolio,
  onPropertyChange,
  onLineItemChange,
  onLineItemAdd,
  onLineItemRemove,
  entryPeriodPreferences = {},
  onEntryPeriodPreferencesChange,
}) {
  const isPrivate = settings.accountType === 'private'
  const [reconciliationScenario, setReconciliationScenario] = useState(0)
  const normalizedEntryPeriods = useMemo(() => normalizeMoneyEntryPreferences(entryPeriodPreferences), [entryPeriodPreferences])
  const onEntryPeriodChange = (preferenceKey, period) =>
    onEntryPeriodPreferencesChange?.(setMoneyEntryPeriod(normalizedEntryPeriods, preferenceKey, period))

  const propertyMoneyInput = ({ property, fieldKey, monthlyValue, onMonthlyChange, step = '0.01' }) => {
    const preferenceKey = `property:${property.id}:${fieldKey}`
    return <MoneyPeriodInput
      ariaLabel={`${property.name || 'BTL'} ${fieldKey}`}
      monthlyValue={monthlyValue}
      period={moneyEntryPeriodFor(normalizedEntryPeriods, preferenceKey)}
      onMonthlyChange={onMonthlyChange}
      onPeriodChange={(period) => onEntryPeriodChange(preferenceKey, period)}
      step={step}
    />
  }

  return <div className="costs-workspace">
    <section className="metrics-grid">
      <MetricCard eyebrow="PROPERTY FIXED COSTS" value={currency(portfolio.propertyFixedCosts)} delta="Mortgages, factors & compliance" icon={Home} tone="dark" />
      <MetricCard eyebrow="PROPERTY VARIABLE COSTS" value={currency(portfolio.variableCosts)} delta="Voids, repairs & appliances" icon={Gauge} />
      <MetricCard eyebrow="COMPANY COSTS" value={currency(portfolio.companyCosts)} delta={isPrivate ? 'Not used for private landlords' : 'Editable recurring overheads'} icon={Landmark} disabled={isPrivate} />
      <MetricCard eyebrow="OWNER / EMPLOYEE CASH" value={currency(portfolio.extractionTotal)} delta={isPrivate ? 'Not used for private landlords' : 'Cash paid out; tax treatment set per line'} icon={WalletCards} tone="green" disabled={isPrivate} />
    </section>

    <section className="panel property-cost-panel">
      <header><div><span className="kicker">PROPERTY CASH FLOWS</span><h2>Every property, line by line</h2><p>Income and monthly cost assumptions feed directly into all scenarios and projections.</p></div></header>
      <div className="property-cost-grid">{calculated.map((property) => {
        const source = properties.find((item) => item.id === property.id)
        const voidsAutomatic = source.voidsOverride === '' || source.voidsOverride == null
        return <details className="property-cost-card mobile-cost-details" key={property.id}>
          <summary className="property-cost-summary">
            <div><span>{property.name}</span><h3>{formatPropertyAddress(property.flatNumber, property.address) || 'Address not set'}</h3></div>
            <b>{currency(property.rent - property.fixedCosts - property.variableCosts)}<small> before company costs</small></b>
            <ChevronDown className="mobile-detail-chevron" size={19} />
          </summary>
          <div className="property-cost-body">
            <div className="cost-category income">
              <span>Monthly income</span>
              <label>
                <b>Rent</b>
                {propertyMoneyInput({
                  property,
                  fieldKey: "rent",
                  monthlyValue: source.rent,
                  onMonthlyChange: (value) => onPropertyChange(property.id, 'rent', value),
                  step: '1',
                })}
              </label>
            </div>
            <div className="cost-category">
              <span>Fixed property costs</span>
              <label><b>Mortgage payment <small>calculated</small></b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(property.monthlyPayment)} readOnly /></div></label>
              {propertyCostFields.filter(([, , group]) => group === 'fixed').map(([key, label]) => <label key={key}>
                <b>{label}</b>
                {propertyMoneyInput({
                  property,
                  fieldKey: key,
                  monthlyValue: source[key] ?? property[key],
                  onMonthlyChange: (value) => onPropertyChange(property.id, key, value),
                })}
              </label>)}
            </div>
            <div className="cost-category variable">
              <span>Variable property costs</span>
              <label>
                <b>Void allowance {voidsAutomatic && <small>1/12 rent</small>}</b>
                {propertyMoneyInput({
                  property,
                  fieldKey: "voidsOverride",
                  monthlyValue: property.voids,
                  onMonthlyChange: (value) => onPropertyChange(property.id, 'voidsOverride', value),
                })}
              </label>
              {propertyCostFields.filter(([, , group]) => group === 'variable').map(([key, label]) => <label key={key}>
                <b>{label}</b>
                {propertyMoneyInput({
                  property,
                  fieldKey: key,
                  monthlyValue: source[key],
                  onMonthlyChange: (value) => onPropertyChange(property.id, key, value),
                })}
              </label>)}
            </div>
          </div>
        </details>
      })}{calculated.length === 0 && <div className="empty-cashflow"><Home size={24} /><b>No properties yet</b><span>Add a BTL to start entering its income and costs.</span></div>}</div>
    </section>

    <div className="cashflow-editor-grid">
      <LineItemsEditor
        title="COMPANY COSTS"
        description="Account-level cash costs. Mark a line deductible only when it genuinely qualifies for Corporation Tax."
        items={settings.companyCosts}
        timed
        tone="company"
        disabled={isPrivate}
        collectionKey="companyCosts"
        entryPeriodPreferences={normalizedEntryPeriods}
        onEntryPeriodChange={onEntryPeriodChange}
        onChange={(id, key, value) => onLineItemChange('companyCosts', id, key, value)}
        onAdd={() => onLineItemAdd('companyCosts', 'New company cost')}
        onRemove={(id) => onLineItemRemove('companyCosts', id)}
      />
      <LineItemsEditor
        title="EXTRACTIONS"
        description="Cash paid to an owner or employee. Dividends, DLA repayments and loan principal are normally non-deductible; set each line explicitly. Personal tax/NIC on the recipient is not modelled."
        items={settings.extractions}
        tone="extraction"
        disabled={isPrivate}
        collectionKey="extractions"
        entryPeriodPreferences={normalizedEntryPeriods}
        onEntryPeriodChange={onEntryPeriodChange}
        onChange={(id, key, value) => onLineItemChange('extractions', id, key, value)}
        onAdd={() => onLineItemAdd('extractions', 'New extraction')}
        onRemove={(id) => onLineItemRemove('extractions', id)}
      />
    </div>

    <section className="panel cashflow-reconciliation" data-mobile-scenario={reconciliationScenario}>
      <header><div><span className="kicker">CASH-FLOW RECONCILIATION</span><h2>Where every pound goes</h2><p>Management is calculated from the model toggle and rate. {isPrivate ? 'Estimated income tax' : 'Corporation tax'} changes with each scenario.</p></div></header>
      <div className="reconciliation-scenario-toggle" role="group" aria-label="Reconciliation scenario">
        {scenarioMeta.map((scenario, index) => <button type="button" key={scenario.name} className={reconciliationScenario === index ? 'active' : ''} aria-pressed={reconciliationScenario === index} style={{ '--scenario': scenario.colour }} onClick={() => setReconciliationScenario(index)}>{scenario.name}</button>)}
      </div>
      <div className="reconciliation-wrap"><table><thead><tr><th>Monthly line</th>{scenarioMeta.map((scenario, index) => <th className={`scenario-column scenario-${index}`} key={scenario.name} style={{ '--scenario': scenario.colour }}>{scenario.name}<small>{scenario.note}</small></th>)}</tr></thead><tbody>{[
        ['Rent received', (scenario) => scenario.collectedRent, 'income'],
        ['Property fixed cash costs', () => -portfolio.propertyFixedCosts, 'cost'],
        ['Company costs', () => -portfolio.companyCosts, 'cost', true],
        ['Management fee', (scenario) => -scenario.management, 'cost'],
        ['Repairs & appliance budget', (scenario) => -scenario.problemBudget, 'cost'],
        ['Owner / employee cash paid', () => -portfolio.extractionTotal, 'cost', true],
        ['Taxable profit', (scenario) => scenario.taxable, 'subtotal'],
        [isPrivate ? 'Estimated income tax' : 'Corporation tax', (scenario) => -scenario.tax, 'cost', false],
        ['Company bank cashflow', (scenario) => scenario.bankCashflow, 'subtotal', true],
        [isPrivate ? 'Net monthly cashflow' : 'Company + extraction cash (pre-personal-tax)', (scenario) => scenario.cashflow, 'total'],
      ].map(([label, getter, kind, companyOnly]) => <tr className={`${kind} ${companyOnly && isPrivate ? 'not-applicable-row' : ''}`} title={companyOnly && isPrivate ? 'Not used for private landlords.' : undefined} key={label}><th>{label}</th>{portfolio.scenarios.map((scenario, index) => <td className={`scenario-column scenario-${index}`} key={scenario.id}>{currency(getter(scenario, index))}</td>)}</tr>)}</tbody></table></div>
    </section>
  </div>
}

const tenantFields = [
  ['name', 'Name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'],
  ['occupation', 'Occupation', 'text'], ['moveIn', 'Move-in date', 'date'], ['moveOut', 'Move-out date (optional)', 'date'], ['depositHeld', 'Deposit held', 'text'],
]

function TenantsWorkspace({ tenants, properties, onSave, onRemove }) {
  const [draft, setDraft] = useState(null)
  const startNew = () => setDraft(createTenant(properties[0]?.id || ''))
  const edit = (tenant) => setDraft({ ...tenant })
  const propertyName = (id) => properties.find((property) => property.id === id)?.name || 'Unknown BTL'
  const currentTenants = tenants.filter((tenant) => !tenantTenure(tenant).archived)
  const archivedTenants = tenants.filter((tenant) => tenantTenure(tenant).archived)
  const exportTenantReport = (format) => {
    const columns = [
      { key: 'status', label: 'Status' },
      { key: 'name', label: 'Name' },
      { key: 'property', label: 'Linked property' },
      { key: 'address', label: 'Property address' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'moveIn', label: 'Move-in date' },
      { key: 'moveOut', label: 'Move-out date' },
      { key: 'depositHeld', label: 'Deposit held' },
      { key: 'tenure', label: 'Tenure' },
    ]
    const rows = tenants.map((tenant) => {
      const property = properties.find((candidate) => candidate.id === tenant.propertyId)
      const tenure = tenantTenure(tenant)
      return {
        status: tenure.archived ? 'Archived' : tenure.live ? 'Live tenant' : 'Upcoming',
        name: tenant.name || '',
        property: property?.name || 'Unknown BTL',
        address: property ? formatPropertyAddress(property.flatNumber, property.address) || property.postcode || '' : '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        occupation: tenant.occupation || '',
        moveIn: tenant.moveIn || '',
        moveOut: tenant.moveOut || '',
        depositHeld: tenant.depositHeld || '',
        tenure: tenure.label,
      }
    })
    const liveCount = tenants.filter((tenant) => tenantTenure(tenant).live).length
    const archivedCount = tenants.filter((tenant) => tenantTenure(tenant).archived).length
    const upcomingCount = Math.max(0, tenants.length - liveCount - archivedCount)
    return exportTabularReport(format, {
      fileBase: 'btl-portfolio-tenants',
      title: 'Tenant report',
      subtitle: 'Current and historic tenant directory',
      summary: [
        ['Tenants', String(tenants.length)],
        ['Live', String(liveCount)],
        ['Upcoming', String(upcomingCount)],
        ['Archived', String(archivedCount)],
      ],
      columns,
      rows,
      recordTitle: (row) => `${row.name || 'Unnamed tenant'} · ${row.property} · ${row.status}`,
    })
  }
  const tenantCard = (tenant) => {
    const tenure = tenantTenure(tenant)
    return <article className={`panel tenant-card ${tenure.live ? 'live' : ''}`} key={tenant.id}><header><div><span className={`tenant-status ${tenure.live ? 'live' : tenure.archived ? 'archived' : 'future'}`}>{tenure.live ? 'Live tenant' : tenure.archived ? 'Archived' : 'Upcoming'}</span><h2>{tenant.name || 'Unnamed tenant'}</h2><p>{propertyName(tenant.propertyId)} · {tenure.label}</p></div><Users size={20} /></header><dl><div><dt>Email</dt><dd>{tenant.email || '—'}</dd></div><div><dt>Phone</dt><dd>{tenant.phone || '—'}</dd></div><div><dt>Occupation</dt><dd>{tenant.occupation || '—'}</dd></div><div><dt>Deposit</dt><dd>{tenant.depositHeld || '—'}</dd></div></dl><footer><button className="text-button" onClick={() => edit(tenant)}><Pencil size={15} /> Edit</button><button className="text-button tenant-delete" onClick={() => onRemove(tenant.id)}><Trash2 size={15} /> Remove</button></footer></article>
  }
  const submit = (event) => {
    event.preventDefault()
    if (!draft.propertyId) return
    onSave(draft)
    setDraft(null)
  }

  return <div className="tenants-workspace">
    <section className="panel tenants-toolbar"><div><span className="kicker">TENANCY DIRECTORY</span><h2>Tenants linked to your BTLs</h2><p>Tenant records are private to your account. Tenure updates automatically from the move-in date.</p></div><div className="tenants-toolbar-actions"><div className={`report-export-control ${tenants.length ? '' : 'disabled'}`} aria-label="Export tenant report"><span><FileText size={14} /> Export</span><button type="button" disabled={!tenants.length} onClick={() => exportTenantReport('csv')}>CSV</button><button type="button" disabled={!tenants.length} onClick={() => exportTenantReport('xlsx')}>XLSX</button><button type="button" disabled={!tenants.length} onClick={() => exportTenantReport('pdf')}>PDF</button></div><button className="primary-button" onClick={startNew} disabled={!properties.length}><Plus size={16} /> Add tenant</button></div></section>
    {!properties.length && <section className="panel tenants-empty"><Users /><h2>Add a property first</h2><p>Every tenant must be linked to a BTL, so orphaned tenant records cannot be created.</p></section>}
    {properties.length > 0 && tenants.length === 0 && <section className="panel tenants-empty"><Users /><h2>No tenants yet</h2><p>Add a tenant here, or enter tenant details while creating or editing a BTL.</p><button className="secondary-button" onClick={startNew}><Plus size={16} /> Add your first tenant</button></section>}
    <section className="tenant-grid">{currentTenants.map(tenantCard)}</section>
    {archivedTenants.length > 0 && <details className="panel archived-tenants"><summary><span><b>Archived tenants</b><small>{archivedTenants.length} historical {archivedTenants.length === 1 ? 'record' : 'records'}</small></span><ChevronDown size={18} /></summary><section className="tenant-grid">{archivedTenants.map(tenantCard)}</section></details>}
    {draft && <div className="tenant-editor-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDraft(null)}><form className="panel tenant-editor" onSubmit={submit}><header><div><span className="kicker">TENANT RECORD</span><h2>{tenants.some((tenant) => tenant.id === draft.id) ? 'Edit tenant' : 'Add tenant'}</h2></div><button type="button" className="icon-button" onClick={() => setDraft(null)} aria-label="Close tenant editor"><X /></button></header><label className="tenant-property-field"><span>Linked BTL <b>Required</b></span><select required value={draft.propertyId} onChange={(event) => setDraft((current) => ({ ...current, propertyId: event.target.value }))}><option value="" disabled>Select a property</option>{properties.map((property) => <option value={property.id} key={property.id}>{property.name} — {formatPropertyAddress(property.flatNumber, property.address) || property.postcode || 'Address not set'}</option>)}</select></label><div className="tenant-form-grid">{tenantFields.map(([key, label, type]) => <label key={key}><span>{label}</span><input type={type} value={draft[key] || ''} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><footer><button type="button" className="secondary-button" onClick={() => setDraft(null)}>Cancel</button><button className="primary-button"><Check size={16} /> Save tenant</button></footer></form></div>}
  </div>
}

function EditDrawer({ property, onSave, onClose, onDelete, isNew }) {
  const [draft, setDraft] = useState(property)
  useEffect(() => setDraft(property), [property])
  const update = (key, value, type) => setDraft((current) => ({
    ...current,
    [key]: type === 'percent' ? Number(value) / 100 : type === 'number' ? Number(value) : type === 'optional-number' ? (value === '' ? '' : Number(value)) : value,
  }))

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="drawer" aria-label="Edit BTL">
        <header><div><span className="kicker">Portfolio property</span><h2>{isNew ? 'Add a BTL' : `Edit ${draft.name}`}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>
        <div className="drawer-body">
          {editableSections.map((section) => (
            <section className="form-section" key={section.title}>
              <h3>{section.title}</h3>
              <div className="form-grid">
                {section.fields.map(([key, label, type]) => (
                  <label key={key} className={type === 'text' && ['address', 'depositHeld', 'tenantOccupation'].includes(key) ? 'wide' : ''}>
                    <span>{label}</span>
                    <div className={type === 'percent' ? 'input-suffix' : ''}>
                      <input
                        type={type === 'percent' || type === 'optional-number' ? 'number' : type}
                        step={type === 'percent' ? '0.1' : ['number', 'optional-number'].includes(type) ? 'any' : undefined}
                        value={type === 'percent' ? percentInputValue(draft[key]) : draft[key] ?? ''}
                        onChange={(event) => update(key, event.target.value, type)}
                      />
                      {type === 'percent' && <small>%</small>}
                    </div>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer>
          {!isNew && <button className="danger-button" onClick={() => onDelete(draft.id)}><Trash2 size={16} /> Delete</button>}
          <span />
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={() => onSave(draft)}><Check size={17} /> Save BTL</button>
        </footer>
      </aside>
    </div>
  )
}


function ModelInputsPopup({ settings, onSettingChange, onPercentChange, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return <div className="model-inputs-popup-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="model-inputs-popup" role="dialog" aria-modal="true" aria-labelledby="model-inputs-popup-title">
      <div className="model-inputs-popup-grabber" aria-hidden="true" />
      <header>
        <button type="button" onClick={onClose}>Close</button>
        <div><small>PORTFOLIO ASSUMPTIONS</small><h2 id="model-inputs-popup-title">Model inputs</h2><span>Changes save automatically.</span></div>
        <button type="button" className="done" onClick={onClose}>Done</button>
      </header>
      <div className="model-inputs-popup-body">
        <section className="model-inputs-popup-group">
          <h3>Portfolio model</h3>
          <ModelInputFields settings={settings} onSettingChange={onSettingChange} onPercentChange={onPercentChange} />
        </section>
        <section className="model-inputs-popup-group">
          <h3>Management</h3>
          <ModelControls settings={settings} onChange={onSettingChange} />
        </section>
        <PrivateLandlordInputs settings={settings} onSettingChange={onSettingChange} />
      </div>
    </section>
  </div>
}

function PortfolioApp({ user }) {
  const [state, setState] = useState(null)
  const [entitlement, setEntitlement] = useState(null)
  const [billingError, setBillingError] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const loaded = useRef(false)
  const [editingId, setEditingId] = useState(null)
  const [pendingProperty, setPendingProperty] = useState(null)
  const sectionStorageKey = `btl-active-section:${user.id}`
  const overviewPropertyViewStorageKey = `btl-overview-property-view-v2:${user.id}`
  const [overviewPropertyView, setOverviewPropertyView] = useState(() => {
    const savedView = window.localStorage.getItem(overviewPropertyViewStorageKey)
    if (overviewPropertyViewOptions.some(([id]) => id === savedView)) return savedView
    return 'rows'
  })
  const [section, setSection] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (BANKING_ENABLED && params.get('bank_callback') === '1') return 'Banking'

    const savedSection = window.localStorage.getItem(sectionStorageKey)
    return workspaceNavigation.some(([label]) => label === savedSection) ? savedSection : 'Overview'
  })
  const [search, setSearch] = useState('')
  const [advancedPropertyView, setAdvancedPropertyView] = useState(false)
  const [mobilePropertyId, setMobilePropertyId] = useState('')
  const [collapsedPropertyGroups, setCollapsedPropertyGroups] = useState(
    () => new Set(propertyGroups.map(({ title }) => title)),
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [modelInputsPopupOpen, setModelInputsPopupOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const accentKey = accentStorageKey(user.id)
  const [accentHue, setAccentHue] = useState(() => initialAccent(window.localStorage.getItem(accentKey)))

  const togglePropertyGroup = (title) => {
    setCollapsedPropertyGroups((current) => {
      const next = new Set(current)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }
  const [theme, setTheme] = useState(() => initialTheme(window.localStorage.getItem('btl-theme'), window.matchMedia?.('(prefers-color-scheme: dark)').matches))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('btl-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#091A1E' : '#f5f7f4')
    return () => { delete document.documentElement.dataset.theme }
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.accent = accentHue
    window.localStorage.setItem(accentKey, accentHue)
    return () => { delete document.documentElement.dataset.accent }
  }, [accentHue, accentKey])

  useEffect(() => {
    if (!settingsOpen) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && setSettingsOpen(false)
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [settingsOpen])

  useEffect(() => {
    window.localStorage.setItem(sectionStorageKey, section)
  }, [section, sectionStorageKey])

  useEffect(() => {
    window.localStorage.setItem(overviewPropertyViewStorageKey, overviewPropertyView)
  }, [overviewPropertyView, overviewPropertyViewStorageKey])

  useEffect(() => {
    if (state?.settings.accountType === 'private' && section === 'Companies House') setSection('Overview')
    if (!BANKING_ENABLED && section === 'Banking') setSection('Overview')
  }, [state?.settings.accountType, section])

  useEffect(() => {
    if (!mobileNavOpen) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && setMobileNavOpen(false)
    document.addEventListener('keydown', closeOnEscape)
    document.body.classList.add('mobile-nav-locked')
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('mobile-nav-locked')
    }
  }, [mobileNavOpen])

  useEffect(() => {
    let active = true
    loaded.current = false
    setState(null)
    setLoadError('')
    const loadPortfolio = async () => {
      const { data, error } = await supabase.from('portfolio_states').select('portfolio').eq('user_id', user.id).maybeSingle()
      if (!active) return
      if (error) {
        setLoadError(error.message)
        return
      }
      const portfolioState = data?.portfolio || { properties: [], settings: {} }
      const storedProperties = Array.isArray(portfolioState.properties) ? portfolioState.properties : []
      const isEstablishedPortfolio = storedProperties.length > 0
      const existingAccountDefaults = isEstablishedPortfolio ? { companyName: 'Quark Holdings', onboardingComplete: true, taxJurisdiction: 'scotland' } : {}
      const migratedProperties = storedProperties
        .map((property) => ({
          ...property,
          mortgageOverride: '',
          mortgageOverrideRate: null,
          mortgageOverrideLoanAmount: null,
        }))
      const migratedTenants = importPropertyTenants(migratedProperties, portfolioState.tenants)
      loaded.current = true
      setState({
        properties: migratedProperties,
        tenants: migratedTenants,
        expenses: Array.isArray(portfolioState.expenses) ? portfolioState.expenses : [],
        credentials: Array.isArray(portfolioState.credentials) ? portfolioState.credentials : [],
        acquisitionScenarios: Array.isArray(portfolioState.acquisitionScenarios) ? portfolioState.acquisitionScenarios : [],
        nextBtlPreferences: normalizeNextBtlPreferences(portfolioState.nextBtlPreferences),
        costsCashflowPreferences: normalizeMoneyEntryPreferences(portfolioState.costsCashflowPreferences),
        remortgageComparisons: Array.isArray(portfolioState.remortgageComparisons) ? portfolioState.remortgageComparisons : [],
        settings: {
          ...defaultSettings,
          ...existingAccountDefaults,
          ...(portfolioState.settings || {}),
          companyName: portfolioState.settings?.companyName || (isEstablishedPortfolio ? 'Quark Holdings' : ''),
          onboardingComplete: isEstablishedPortfolio || Boolean(portfolioState.settings?.onboardingComplete),
          companyCosts: Array.isArray(portfolioState.settings?.companyCosts) ? portfolioState.settings.companyCosts.map((item) => ({ ...item, taxDeductible: item.taxDeductible === true })) : [],
          extractions: Array.isArray(portfolioState.settings?.extractions) ? portfolioState.settings.extractions.map((item) => ({ ...item, taxDeductible: item.taxDeductible === true })) : [],
        },
      })
    }
    loadPortfolio()
    return () => { active = false }
  }, [user.id])

  const refreshEntitlement = async () => {
    try {
      const value = normalizeEntitlement(await billingRequest())
      setEntitlement(value)
      setBillingError('')
      return value
    } catch (error) {
      setBillingError(error.message)
      setEntitlement(normalizeEntitlement())
      return null
    }
  }

  useEffect(() => { refreshEntitlement() }, [user.id])

  useEffect(() => {
    const billingResult = new URLSearchParams(window.location.search).get('billing')
    if (billingResult === 'success') {
      setSection('Plan & billing')
      const timer = window.setTimeout(refreshEntitlement, 1200)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [])

  useEffect(() => {
    if (!state || !loaded.current) return undefined
    setSaveStatus('saving')
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from('portfolio_states').upsert({ user_id: user.id, portfolio: state }, { onConflict: 'user_id' })
      setSaveStatus(error ? 'error' : 'saved')
    }, 600)
    return () => window.clearTimeout(timer)
  }, [state, user.id])

  if (loadError) return <div className="app-status-screen"><CloudOff size={32} /><h1>We couldn’t load your portfolio</h1><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></div>
  if (!state) return <div className="app-status-screen"><span className="loading-mark"><Building2 /></span><h1>Loading your private portfolio…</h1></div>

  const portfolio = calculatePortfolio(state.properties, state.settings)
  const calculated = state.properties.map((p) => ({ ...calculateProperty(p, state.settings), ...propertyVoidHistory(p, state.tenants) }))
  const includedProperties = includedPortfolioProperties(state.properties)
  const includedCalculated = includedPortfolioProperties(calculated)
  const includedTenants = tenantsForIncludedProperties(state.tenants, state.properties)

  const editing = pendingProperty || state.properties.find((p) => p.id === editingId)
  const effectiveEntitlement = normalizeEntitlement(entitlement)
  const requestPropertySlot = () => {
    if (canAddProperty(effectiveEntitlement, state.properties.length)) return true
    setUpgradeOpen(true)
    return false
  }
  const closeEditor = () => { setEditingId(null); setPendingProperty(null) }
  const saveProperty = (draft) => {
    if (!state.properties.some((property) => property.id === draft.id) && !requestPropertySlot()) return
    setState((current) => {
      const synced = syncPropertyTenant(draft, current.tenants)
      return { ...current, tenants: synced.tenants, properties: current.properties.some((p) => p.id === draft.id) ? current.properties.map((p) => p.id === draft.id ? synced.property : p) : [...current.properties, synced.property] }
    })
    closeEditor()
  }
  const cloneProperty = (id) => {
    if (!requestPropertySlot()) return
    const source = state.properties.find((p) => p.id === id)
    const clone = { ...source, id: crypto.randomUUID(), name: `BTL${state.properties.length + 1}`, address: `${source.address} (copy)`, active: true, tenantId: '', tenantName: '', tenantEmail: '', tenantPhone: '', tenantOccupation: '', tenantMoveIn: '', tenantMoveOut: '', depositHeld: '', mortgageNumber: '' }
    setPendingProperty(clone)
    setEditingId(null)
  }
  const addProperty = () => {
    if (!requestPropertySlot()) return
    const next = createBlankProperty(`BTL${state.properties.length + 1}`)
    setPendingProperty(next)
    setEditingId(null)
  }
  const removeProperty = (id) => {
    setState((current) => ({ ...current, properties: current.properties.filter((p) => p.id !== id), tenants: removeTenantsForProperty(current.tenants, id) }))
    closeEditor()
  }
  const toggleProperty = (id) => setState((current) => ({ ...current, properties: current.properties.map((p) => p.id === id ? { ...p, active: !p.active } : p) }))
  const updatePropertyField = (id, key, value) => setState((current) => ({
    ...current,
    properties: current.properties.map((property) => {
      if (property.id !== id) return property
      return { ...property, [key]: value }
    }),
  }))
  const updateSetting = (key, value) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  const updateConnectedCashHeld = (value) => setState((current) => Number(current.settings.cashHeld) === Number(value)
    ? current
    : ({ ...current, settings: { ...current.settings, cashHeld: value } }))
  const completeAccountSetup = (profile) => setState((current) => ({ ...current, settings: { ...current.settings, ...profile } }))
  const updatePercentSetting = (key, value) => updateSetting(key, Number(value) / 100)
  const updateLineItem = (collection, id, key, value) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: current.settings[collection].map((item) => item.id === id ? { ...item, [key]: value } : item) } }))
  const addLineItem = (collection, name) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: [...current.settings[collection], { id: crypto.randomUUID(), name, amount: 0, enabled: true, taxDeductible: false, ...(collection === 'companyCosts' ? { monthsRemaining: 0 } : {}) }] } }))
  const removeLineItem = (collection, id) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: current.settings[collection].filter((item) => item.id !== id) } }))
  const updateExpenses = (expenses) => setState((current) => ({ ...current, expenses }))
  const updateCredentials = (credentials) => setState((current) => ({ ...current, credentials }))
  const updateAcquisitionScenarios = (acquisitionScenarios) => setState((current) => ({ ...current, acquisitionScenarios }))
  const updateNextBtlPreferences = (nextBtlPreferences) => setState((current) => ({ ...current, nextBtlPreferences: normalizeNextBtlPreferences(nextBtlPreferences) }))
  const updateCostsCashflowPreferences = (costsCashflowPreferences) => setState((current) => ({ ...current, costsCashflowPreferences: normalizeMoneyEntryPreferences(costsCashflowPreferences) }))
  const updateRemortgageComparisons = (remortgageComparisons) => setState((current) => ({ ...current, remortgageComparisons }))
  const saveTenant = (tenant) => setState((current) => tenantBelongsToProperty(tenant, current.properties) ? ({
    ...current,
    tenants: current.tenants.some((item) => item.id === tenant.id) ? current.tenants.map((item) => item.id === tenant.id ? tenant : item) : [...current.tenants, tenant],
    properties: current.properties.map((property) => applyTenantToProperty(tenant, property)),
  }) : current)
  const removeTenant = (id) => setState((current) => {
    const tenant = current.tenants.find((item) => item.id === id)
    return {
      ...current,
      tenants: current.tenants.filter((item) => item.id !== id),
      properties: current.properties.map((property) => tenant?.importedFromProperty && property.id === tenant.propertyId ? { ...property, tenantId: '', tenantName: '', tenantEmail: '', tenantPhone: '', tenantOccupation: '', tenantMoveIn: '', tenantMoveOut: '', depositHeld: '' } : property),
    }
  })
  const reset = () => { if (window.confirm('Reset the model inputs to their defaults? Your properties and cash-flow lines will be kept.')) setState((current) => ({ ...current, settings: { ...current.settings, ...assumptions, fullyManaged: false } })) }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Portfolio owner'
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const avatarUrl = userAvatarUrl(user)
  const portfolioName = state.settings.accountType === 'private' ? `${displayName}'s portfolio` : state.settings.companyName || 'Property portfolio'

  const filtered = calculated.filter((p) => `${p.name} ${p.address} ${p.postcode}`.toLowerCase().includes(search.toLowerCase()))
  const mobileProperty = calculated.find((property) => property.id === mobilePropertyId) || filtered[0] || calculated[0] || null
  const visibleWorkspaceNavigation = workspaceNavigation.filter(([label]) => {
    if (!BANKING_ENABLED && label === 'Banking') return false
    if (state.settings.accountType === 'private' && label === 'Companies House') return false
    return true
  })
  const pageMeta = sectionMeta[section] || {
    eyebrow: 'PORTFOLIO',
    title: section,
    description: 'Review and manage your portfolio.',
  }
  const navigateMobile = (nextSection) => {
    setSection(nextSection)
    setMobileNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell" onFocusCapture={(event) => { if (shouldSelectZeroInput(event.target)) event.target.select() }}>
      <button className={`mobile-nav-backdrop ${mobileNavOpen ? 'open' : ''}`} onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" tabIndex={mobileNavOpen ? 0 : -1} />
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Portfolio navigation">
        <div className="brand">
          <div className="brand-identity">
            <BrandLogo surface="dark" className="sidebar-brand-wordmark" />
            {state.settings.companyName && <small className="brand-company-name">{state.settings.companyName}</small>}
          </div>
          <button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="sidebar-body">
          <nav>
            {navigationGroups.map((group) => {
              const items = visibleWorkspaceNavigation.filter(([, , , itemGroup]) => itemGroup === group)
              if (!items.length) return null
              return <React.Fragment key={group}>
                <small>{group}</small>
                {items.map(([label, , Icon]) => <button
                  key={label}
                  className={section === label ? 'active' : ''}
                  aria-current={section === label ? 'page' : undefined}
                  onClick={() => { setSection(label); setMobileNavOpen(false) }}
                ><Icon size={18} />{label}</button>)}
              </React.Fragment>
            })}
            <small>YOUR BTLS</small>
            {calculated.map((p) => <div key={p.id} className={`property-nav-row ${p.active ? 'included' : 'excluded'}`}>
              <button className="property-nav" onClick={() => { setSection('Properties'); setSearch(p.name); setMobilePropertyId(p.id); setMobileNavOpen(false) }}><i>{p.name.replace(/\D/g, '')}</i><span>{p.name}<small>{p.postcode}</small></span></button>
              <label
                className="property-nav-visibility"
                title={p.active ? `Exclude ${p.name} from portfolio calculations and other workspaces` : `Include ${p.name} in portfolio calculations and other workspaces`}
              >
                <input
                  aria-label={p.active ? `Exclude ${p.name}` : `Include ${p.name}`}
                  type="checkbox"
                  checked={Boolean(p.active)}
                  onChange={() => toggleProperty(p.id)}
                />
                <i />
              </label>
            </div>)}
          </nav>
          <details className="sidebar-model-inputs sidebar-disclosure sidebar-model-inputs-desktop">
            <summary>
              <Sparkles size={15} />
              <div><b>Model inputs</b><small>Portfolio assumptions</small></div>
              <ChevronDown className="sidebar-disclosure-chevron" size={16} />
            </summary>
            <div className="sidebar-disclosure-body">
              <ModelInputFields settings={state.settings} onSettingChange={updateSetting} onPercentChange={updatePercentSetting} compact />
              <ModelControls settings={state.settings} onChange={updateSetting} compact />
              <PrivateLandlordInputs settings={state.settings} onSettingChange={updateSetting} compact />
            </div>
          </details>
          <button
            type="button"
            className="model-inputs-popup-trigger"
            aria-haspopup="dialog"
            onClick={() => {
              setMobileNavOpen(false)
              setModelInputsPopupOpen(true)
            }}
          >
            <Sparkles size={15} />
            <span><b>Model inputs</b><small>Portfolio assumptions</small></span>
            <Pencil size={15} />
          </button>
          <AccountProfileEditor settings={state.settings} onChange={updateSetting} />
          <button className={`sidebar-plan ${effectiveEntitlement.isPro ? 'pro' : ''}`} onClick={() => { setSection('Plan & billing'); setMobileNavOpen(false) }}><Sparkles size={17} /><span><b>{effectiveEntitlement.isPro ? 'Pro access' : 'Free · 1 BTL'}</b><small>{effectiveEntitlement.isOwner ? 'Owner account' : effectiveEntitlement.isPro ? 'Unlimited properties' : 'View upgrade options'}</small></span></button>
          {SUPPORT.enabled && showFreeSupport(effectiveEntitlement) && <a className="sidebar-support" href={SUPPORT.url} target="_blank" rel="noreferrer"><Coffee size={17} /><span><b>Buy me a coffee</b><small>Support BTL Portfolio</small></span><ExternalLink size={13} /></a>}
        </div>
        <div className="sidebar-foot">
          <div className="avatar">{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials}</div>
          <span><b>{displayName}</b><small>{user.email}</small></span>
          <button
            type="button"
            className="sidebar-settings"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings"
          ><Settings size={16} /></button>
          <button className="sidebar-signout" onClick={() => supabase.auth.signOut()} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>

      {modelInputsPopupOpen && <ModelInputsPopup
        settings={state.settings}
        onSettingChange={updateSetting}
        onPercentChange={updatePercentSetting}
        onClose={() => setModelInputsPopupOpen(false)}
      />}

      {settingsOpen && <div className="settings-layer" onMouseDown={() => setSettingsOpen(false)}>
        <section
          className="settings-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header>
            <div>
              <span className="kicker">APPEARANCE</span>
              <h2 id="settings-title">Settings</h2>
              <p>Choose the accent used for navigation, controls and key interface highlights.</p>
            </div>
            <button type="button" className="settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={19} /></button>
          </header>

          <div className="settings-section">
            <div className="settings-section-copy">
              <h3>Theme colour</h3>
              <p>Forest is the default. Each palette is tuned separately for light and dark mode.</p>
            </div>
            <div className="accent-choice-grid" role="radiogroup" aria-label="Theme colour">
              {accentOptions.map((option) => {
                const selected = accentHue === option.id
                return <button
                  key={option.id}
                  type="button"
                  className={`accent-choice ${selected ? 'selected' : ''}`}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAccentHue(option.id)}
                  style={{ '--accent-swatch': option.swatch }}
                >
                  <span className="accent-swatch" aria-hidden="true">{selected && <Check size={16} strokeWidth={2.6} />}</span>
                  <span><b>{option.label}</b><small>{option.description}</small></span>
                </button>
              })}
            </div>
          </div>
        </section>
      </div>}

      <main>
        <header className="topbar">
          <div><button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-expanded={mobileNavOpen}><Menu /></button><span>{portfolioName}</span><b>/</b><strong>{section}</strong></div>
          <div><button className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button className="secondary-button small topbar-reset" onClick={reset} title="Reset portfolio model assumptions"><RotateCcw size={15} /> Reset model</button></div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div className="hero-copy">
              <span className="eyebrow">{pageMeta.eyebrow}</span>
              <h1>{pageMeta.title}</h1>
              <p>{pageMeta.description}</p>
            </div>
          </section>

          {section === 'Overview' && <>
            <OverviewPortfolioDashboard portfolio={portfolio} settings={state.settings} />

            <section className="properties-heading overview-properties-heading">
              <div><span className="kicker">THE PORTFOLIO</span><h2>Properties</h2></div>
              <div className="overview-properties-heading-actions">
                <OverviewPropertyViewSelector value={overviewPropertyView} onChange={setOverviewPropertyView} />
                <button className="text-button" onClick={() => setSection('Properties')}>View full table <ArrowUpRight size={16} /></button>
              </div>
            </section>

            <div key={overviewPropertyView} className="overview-property-view-stage" data-view={overviewPropertyView}>
              {overviewPropertyView === 'cards' && <section className="property-cards">
                {calculated.map((p) => <PropertyCard key={p.id} property={p} onEdit={setEditingId} onClone={cloneProperty} onToggle={toggleProperty} />)}
                <button className="add-property-card" onClick={addProperty}><span><Plus /></span><b>Add another BTL</b><small>Start blank or clone an existing property</small></button>
              </section>}

              {overviewPropertyView === 'rows' && <section className="overview-property-rows">
                {calculated.map((p) => <OverviewPropertyRow key={p.id} property={p} onEdit={setEditingId} onClone={cloneProperty} onToggle={toggleProperty} />)}
                <button type="button" className="overview-property-row-add" onClick={addProperty}><span><Plus size={17} /></span>Add another BTL</button>
              </section>}

              {overviewPropertyView === 'mini' && <section className="overview-property-mini-grid">
                {calculated.map((p) => <OverviewPropertyMiniCard key={p.id} property={p} onEdit={setEditingId} onClone={cloneProperty} onToggle={toggleProperty} />)}
                <button type="button" className="overview-property-mini-add" onClick={addProperty}><span><Plus size={17} /></span><b>Add another BTL</b></button>
              </section>}
            </div>

            <section className="panel scenarios-panel overview-cashflow-panel">
              <header>
                <div>
                  <span className="kicker">CURRENT CASH POSITION</span>
                  <h2>Cash flow scenarios</h2>
                  <p>Compare monthly cash available under different operating assumptions.</p>
                </div>
              </header>
              <ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} accountType={state.settings.accountType} variant="overview" />
            </section>
          </>}

          {section === 'Properties' && <>
            <section className="panel properties-toolbar">
              <div className="properties-toolbar-copy">
                <span className="kicker">PROPERTY COMPARISON</span>
                <h2>Compare properties</h2>
                <p>Review key BTL details side by side. Use Advanced for projected and specialist metrics.</p>
              </div>
              <div className="table-tools properties-tools">
                <div className="property-view-mode" role="group" aria-label="Property detail level">
                  <button
                    type="button"
                    className={`property-view-choice ${!advancedPropertyView ? 'active' : ''}`}
                    aria-pressed={!advancedPropertyView}
                    onClick={() => setAdvancedPropertyView(false)}
                  >
                    Basic
                  </button>
                  <button
                    type="button"
                    className={`property-view-choice ${advancedPropertyView ? 'active' : ''}`}
                    aria-pressed={advancedPropertyView}
                    onClick={() => setAdvancedPropertyView(true)}
                  >
                    Advanced
                  </button>
                </div>
                <label className="properties-search"><Search size={17} /><input placeholder="Search BTLs" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
                <button className="primary-button small properties-new-button" onClick={addProperty}><Plus size={16} /> New BTL</button>
              </div>
            </section>

            <section className="mobile-property-switcher" aria-label="Choose property">
              <div className="mobile-property-segments" role="tablist" aria-label="BTLs">
                {calculated.map((property) => <button type="button" role="tab" aria-selected={mobileProperty?.id === property.id} className={mobileProperty?.id === property.id ? 'active' : ''} key={property.id} onClick={() => { setMobilePropertyId(property.id); setSearch('') }}>{property.name}</button>)}
              </div>
              {mobileProperty && <div className="mobile-property-context">
                <div><b>{mobileProperty.name}</b><span>{formatPropertyAddress(mobileProperty.flatNumber, mobileProperty.address) || 'Address not set'}{mobileProperty.postcode ? ` · ${mobileProperty.postcode}` : ''}</span></div>
                <button type="button" className="mobile-property-edit" onClick={() => setEditingId(mobileProperty.id)}><Pencil size={15} /> Edit</button>
              </div>}
            </section>

            <div className="property-group-stack">
              {propertyGroups.map((group) => {
                const collapsed = collapsedPropertyGroups.has(group.title)
                const rows = visiblePropertyRows(group.rows, advancedPropertyView)
                return (
                  <section className={`panel data-panel property-group-panel ${group.tone}`} key={group.title}>
                    <header className={collapsed ? 'collapsed' : ''}>
                      <button
                        type="button"
                        className="property-group-toggle"
                        aria-expanded={!collapsed}
                        onClick={() => togglePropertyGroup(group.title)}
                      >
                        <div>
                          <span className="group-marker" />
                          <div><h2>{group.title}</h2><p>{group.description}</p></div>
                        </div>
                        <span className="property-group-chevron" aria-hidden="true">
                          {collapsed ? <ChevronDown size={19} /> : <ChevronUp size={19} />}
                        </span>
                      </button>
                    </header>
                    {!collapsed && <>
                      <div className="mobile-property-group-list">
                        {mobileProperty ? rows.map(([label, getter, kind, advanced]) => <div className={`mobile-property-row ${advanced ? 'advanced' : ''}`} key={label}><span>{label}</span><strong className={kind}>{getter(mobileProperty)}</strong></div>) : <div className="mobile-property-empty">No BTL selected</div>}
                      </div>
                      <div className="data-table-wrap">
                        <table
                          className="data-table property-comparison-table"
                          style={{ '--property-count': Math.max(filtered.length, 1) }}
                        >
                          <colgroup>
                            <col className="property-metric-column" />
                            {filtered.map((p) => <col className="property-value-column" key={`col-${p.id}`} />)}
                          </colgroup>
                          <thead><tr><th>Metric</th>{filtered.map((p) => <th key={p.id}><button onClick={() => setEditingId(p.id)}>{p.name}<small>{p.postcode}</small></button></th>)}</tr></thead>
                          <tbody>{rows.map(([label, getter, kind, advanced]) => <tr data-metric={label} data-kind={kind} key={label}><th className={advanced ? 'advanced-metric-label' : undefined}>{label}</th>{filtered.map((p) => <td className={kind} key={p.id}>{getter(p)}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    </>}
                  </section>
                )
              })}
            </div>
          </>}

          {section === 'Costs & Cash Flows' && <CostsWorkspace properties={includedProperties} calculated={includedCalculated} settings={state.settings} portfolio={portfolio} onPropertyChange={updatePropertyField} onLineItemChange={updateLineItem} onLineItemAdd={addLineItem} onLineItemRemove={removeLineItem} entryPeriodPreferences={state.costsCashflowPreferences} onEntryPeriodPreferencesChange={updateCostsCashflowPreferences} />}

          {section === 'Expenses' && <ExpensesWorkspace expenses={state.expenses} properties={includedProperties} accountType={state.settings.accountType} onChange={updateExpenses} />}

          {section === 'IDs & Credentials' && <CredentialsWorkspace credentials={state.credentials || []} onChange={updateCredentials} />}

          {section === 'Tenants' && <TenantsWorkspace tenants={includedTenants} properties={includedProperties} onSave={saveTenant} onRemove={removeTenant} />}

          {section === 'Plan & billing' && <><BillingWorkspace entitlement={effectiveEntitlement} onRefresh={refreshEntitlement} />{billingError && <p className="billing-message error billing-load-error">{billingError}</p>}</>}

          {BANKING_ENABLED && section === 'Banking' && <BankWorkspace user={user} onCashHeldChange={updateConnectedCashHeld} />}

          {section === 'Projections' && <>
            <section className="metrics-grid"><MetricCard eyebrow="MONTHLY APPRECIATION" value={currency(portfolio.appreciation)} delta={`${currency(portfolio.appreciation * 12)} annually`} icon={TrendingUp} tone="green" /><MetricCard eyebrow="FIXED COSTS" value={currency(portfolio.fixedCosts)} delta={`${currency(portfolio.fixedCosts * 12)} annually`} icon={Landmark} /><MetricCard eyebrow="VARIABLE COSTS" value={currency(portfolio.variableCosts)} delta="Voids, repairs & appliances" icon={Gauge} /><MetricCard eyebrow="EXTRACTIONS" value={currency(portfolio.extractionTotal)} delta={state.settings.accountType === 'private' ? 'Not used for private landlords' : 'Cash paid out; tax treatment set per line'} icon={WalletCards} disabled={state.settings.accountType === 'private'} /></section>
            <section className="panel scenarios-panel overview-cashflow-panel projections-scenarios">
              <header>
                <div>
                  <span className="kicker">CURRENT CASH POSITION</span>
                  <h2>Cash flow scenarios</h2>
                  <p>Compare monthly cash available under different operating assumptions.</p>
                </div>
              </header>
              <ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} accountType={state.settings.accountType} variant="overview" />
            </section>
            <ProjectionExplorer properties={includedProperties} settings={state.settings} portfolio={portfolio} onSettingChange={updateSetting} />
            <section className="panel assumptions-panel"><header><div><span className="kicker">MODEL INPUTS</span><h2>Portfolio assumptions</h2><p>Percentages are entered and displayed as true percentage values.</p></div></header><ModelInputFields settings={state.settings} onSettingChange={updateSetting} onPercentChange={updatePercentSetting} /><PrivateLandlordInputs settings={state.settings} onSettingChange={updateSetting} /></section>
          </>}

          {section === 'Acquisition Simulator' && <AcquisitionSimulator
            acquisitions={state.acquisitionScenarios || []}
            onChange={updateAcquisitionScenarios}
            defaultJurisdiction={state.settings.taxJurisdiction === 'scotland' ? 'scotland' : 'england-ni'}
            existingPropertyCount={state.properties.length}
            properties={includedProperties}
            settings={state.settings}
            portfolio={portfolio}
            plannerPreferences={state.nextBtlPreferences}
            onPlannerPreferencesChange={updateNextBtlPreferences}
          />}

          {section === 'Remortgage Simulator' && <RemortgageSimulator
            properties={calculated}
            comparisons={state.remortgageComparisons || []}
            onChange={updateRemortgageComparisons}
            isPro={effectiveEntitlement.isPro}
            onUpgrade={() => setUpgradeOpen(true)}
          />}

          {section === 'Compliance' && <section className="panel compliance-panel"><header><div><span className="kicker">RELEVANT DATES</span><h2>Compliance & remortgage diary</h2></div></header><div className="compliance-list">{includedCalculated.flatMap((p) => [['Call broker',p.brokerDate],['Gas certificate',p.gasExpiry],['EICR',p.eicrExpiry],['PAT testing',p.patExpiry],['EPC',p.epcExpiry]].map(([label,date]) => ({ property:p.name,label,date:new Date(date instanceof Date ? date : `${date}T12:00:00`) }))).filter((item) => !Number.isNaN(item.date.getTime())).sort((a,b) => a.date-b.date).map((item, index) => <div key={`${item.property}-${item.label}`}><span className={index < 3 ? 'date-badge urgent' : 'date-badge'}><CalendarClock size={17} /></span><p><b>{item.label}</b><small>{item.property}</small></p><time>{shortDate(item.date)}</time></div>)}</div></section>}

          {section === 'Companies House' && state.settings.accountType !== 'private' && <CompaniesHouseWorkspace settings={state.settings} onSettingChange={updateSetting} />}
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile workspace navigation">
        {visibleWorkspaceNavigation.slice(0, 4).map(([label, shortLabel, Icon]) => <button key={label} className={section === label ? 'active' : ''} onClick={() => navigateMobile(label)}><Icon size={20} /><span>{shortLabel}</span></button>)}
        <button className={visibleWorkspaceNavigation.slice(4).some(([label]) => label === section) ? 'active' : ''} onClick={() => setMobileNavOpen(true)}><Menu size={20} /><span>More</span></button>
      </nav>

        {editing && <EditDrawer property={editing} isNew={!state.properties.some((p) => p.id === editing.id)} onSave={saveProperty} onClose={closeEditor} onDelete={removeProperty} />}
        {upgradeOpen && <BillingWorkspace entitlement={effectiveEntitlement} modal onClose={() => setUpgradeOpen(false)} />}
      {!state.settings.onboardingComplete && <AccountSetupModal onComplete={completeAccountSetup} />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return undefined
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <div className="app-status-screen"><CloudOff size={32} /><h1>Authentication is not configured</h1><p>Add the Supabase project URL and publishable key to the deployment environment.</p></div>
  if (session === undefined) return <div className="app-status-screen"><BrandLogo surface="auto" className="status-brand-wordmark" /><h1>Checking your session…</h1></div>
  return session ? <PortfolioApp user={session.user} /> : <AuthScreen />
}
