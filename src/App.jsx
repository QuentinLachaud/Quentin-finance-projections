import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Building2, CalendarClock, Check, ChevronDown,
  ChevronUp, PoundSterling, Copy, ExternalLink, Gauge, Home, Landmark, MapPin, Menu, MoreHorizontal,
  Pencil, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, TrendingUp,
  WalletCards, X, LogOut, Cloud, CloudOff, ReceiptText, FileText, Users, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { assumptions, createBlankProperty, editableSections } from './data.js'
import { anchorMortgageOverride, calculatePortfolio, calculateProperty, currency, migrateMortgageOverride, percent, projectPortfolio, shortDate } from './calculations.js'
import { TAX_YEAR } from './tax.js'
import {
  activeOfficers, activePsc, companyDeadlines, formatCompanyAddress,
  identityVerificationSummary, officialCompanyUrl, outstandingCharges,
} from './companiesHouse.js'
import AuthScreen from './AuthScreen.jsx'
import BankWorkspace from './BankWorkspace.jsx'
import { isSupabaseConfigured, supabase } from './supabase.js'

// Keep the completed Open Banking workspace dormant until a production data
// provider is available. It can be restored without code changes at deploy time.
const BANKING_ENABLED = import.meta.env.VITE_BANKING_ENABLED === 'true'

const defaultSettings = { ...assumptions, fullyManaged: false, companyCosts: [], extractions: [], accountType: 'company', companyName: '', onboardingComplete: false, grossAnnualIncome: 0, taxJurisdiction: 'england' }
const percentInputValue = (value) => Number((Number(value || 0) * 100).toFixed(4))
const moneyInputValue = (value) => Number(Number(value || 0).toFixed(2))

const propertyGroups = [
  { title: 'Property basics', description: 'Identity, location and physical details', tone: 'blue', rows: [
    ['Address', (p) => `${p.flatNumber}, ${p.address}`, 'text'], ['Postcode', (p) => p.postcode, 'text'],
    ['Bedrooms', (p) => p.bedrooms, 'integer'], ['Area', (p) => `${p.areaSqm} m²`, 'integer'],
    ['EPC rating', (p) => p.epc, 'text'], ['First purchased', (p) => shortDate(p.purchaseDate), 'date'],
  ]},
  { title: 'Value & leverage', description: 'Acquisition, debt and current equity position', tone: 'ink', rows: [
    ['Purchase price', (p) => currency(p.purchasePrice), 'money'], ['Home report at purchase', (p) => currency(p.homeReportPurchase), 'money'],
    ['Latest valuation', (p) => currency(p.latestValuation), 'money'], ['Expected value at remortgage', (p) => currency(p.expectedRemortgageValue), 'money'],
    ['Loan amount', (p) => currency(p.loanAmount), 'money-negative'], ['Equity', (p) => currency(p.equity), 'money-positive'],
    ['Current LTV', (p) => percent(p.currentLtv), 'percent'], ['Expected LTV at remortgage', (p) => percent(p.expectedRemortgageLtv), 'percent'],
    ['Releasable equity at 75% LTV', (p) => currency(p.releasableEquity), 'money-positive'],
  ]},
  { title: 'Income & performance', description: 'Rent, finance costs and return metrics', tone: 'green', rows: [
    ['Monthly rent', (p) => currency(p.rent), 'money-positive'], ['Monthly mortgage', (p) => currency(p.monthlyPayment, 0), 'money-negative'],
    ['Gross yield', (p) => percent(p.grossYield, 2), 'percent'], ['Net yield', (p) => percent(p.netYield, 2), 'percent'],
    ['Interest coverage ratio', (p) => percent(p.icr, 0), 'percent'], ['Annual appreciation', (p) => currency(p.appreciationAnnual), 'money-positive'],
    ['Current rate + shock', (p) => percent(p.currentRate, 2), 'percent'], ['Current lender', (p) => p.lender, 'text'],
  ]},
  { title: 'Key dates', description: 'Remortgage and compliance milestones', tone: 'amber', rows: [
    ['Next remortgage', (p) => shortDate(p.nextRemortgage), 'date'], ['Call broker', (p) => shortDate(p.brokerDate), 'date'],
    ['Gas certificate expiry', (p) => shortDate(p.gasExpiry), 'date'], ['EICR expiry', (p) => shortDate(p.eicrExpiry), 'date'],
    ['PAT testing expiry', (p) => shortDate(p.patExpiry), 'date'], ['EPC expiry', (p) => shortDate(p.epcExpiry), 'date'],
  ]},
]

const scenarioMeta = [
  { name: 'All inclusive', note: 'Conservative', colour: '#b35c54' },
  { name: 'No voids', note: 'Occupied throughout', colour: '#c78b3e' },
  { name: 'No problems', note: 'Best case', colour: '#27795c' },
]

const modelInputFields = [
  ['appreciationRate', 'Annual appreciation', '%', 'percent'],
  ['rateShock', 'Interest rate shock', '%', 'percent'],
  ['corporationTaxRate', 'Corporation tax', '%', 'percent', 'company'],
  ['managementRate', 'Management fee', '%', 'percent'],
  ['cashHeld', 'Cash held', '£', 'number'],
  ['bufferMonths', 'Target buffer', 'months', 'number'],
]

const workspaceNavigation = [
  ['Overview', 'Overview', Gauge],
  ['Properties', 'Properties', Home],
  ['Costs & Cash Flows', 'Costs', ReceiptText],
  ['Banking', 'Banking', WalletCards],
  ['Projections', 'Projections', TrendingUp],
  ['Compliance', 'Compliance', ShieldCheck],
  ['Companies House', 'Companies', Landmark],
]

function MetricCard({ eyebrow, value, delta, icon: Icon, tone = 'neutral', disabled = false }) {
  return (
    <article className={`metric-card ${tone} ${disabled ? 'not-applicable' : ''}`} title={disabled ? 'Not used for private landlords.' : undefined}>
      <div className="metric-top"><span>{eyebrow}</span><Icon size={18} strokeWidth={1.8} /></div>
      <strong>{value}</strong>
      {delta && <small>{delta}</small>}
    </article>
  )
}

function PropertyCard({ property, onEdit, onClone, onToggle }) {
  const equityPercent = property.latestValuation ? property.equity / property.latestValuation : 0
  const mapQuery = [property.flatNumber, property.address, property.postcode, 'UK'].filter(Boolean).join(', ')
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}`
  return (
    <article className={`property-card ${property.active ? '' : 'muted'}`}>
      <div className="property-card-head">
        <span className="property-index">{property.name.replace(/\D/g, '') || '•'}</span>
        <button className="icon-button" aria-label={`Edit ${property.name}`} onClick={() => onEdit(property.id)}><MoreHorizontal size={20} /></button>
      </div>
      <div>
        <span className="kicker">{property.name}</span>
        <h3>{property.flatNumber}, {property.address}</h3>
        <p>{property.postcode} · {property.bedrooms} bed · {property.areaSqm}m²</p>
      </div>
      <div className="property-value">
        <span>Current valuation</span>
        <strong>{currency(property.latestValuation)}</strong>
      </div>
      <div className="equity-bar"><i style={{ width: `${Math.max(0, Math.min(100, equityPercent * 100))}%` }} /></div>
      <div className="property-mini-grid">
        <div><span>Equity</span><b>{currency(property.equity)}</b></div>
        <div><span>Rent / mo</span><b>{currency(property.rent)}</b></div>
        <div><span>Net yield</span><b>{percent(property.netYield, 1)}</b></div>
      </div>
      <div className="property-map">
        <iframe title={`${property.name} location on Google Maps`} src={`${mapUrl}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={15} /><span>View location</span><ExternalLink size={13} /></a>
      </div>
      <div className="property-actions">
        <label className="switch-label"><input type="checkbox" checked={property.active} onChange={() => onToggle(property.id)} /><i /><span>In totals</span></label>
        <button className="text-button" onClick={() => onClone(property.id)}><Copy size={15} /> Clone</button>
        <button className="text-button" onClick={() => onEdit(property.id)}><Pencil size={15} /> Edit</button>
      </div>
    </article>
  )
}

function ModelInputFields({ settings, onSettingChange, onPercentChange, compact = false }) {
  const isPrivate = settings.accountType === 'private'
  return <div className={compact ? 'sidebar-input-list' : 'assumptions-grid'}>{modelInputFields.map(([key, label, suffix, type, scope]) => {
    const disabled = scope === 'company' && isPrivate
    return <label key={key} className={disabled ? 'not-applicable' : ''} title={disabled ? 'Not used for private landlords.' : undefined}><span>{label}</span><div><input aria-label={label} disabled={disabled} type="number" step={type === 'percent' ? '0.1' : 'any'} value={type === 'percent' ? percentInputValue(settings[key]) : settings[key]} onChange={(event) => type === 'percent' ? onPercentChange(key, event.target.value) : onSettingChange(key, Number(event.target.value))} /><b>{suffix}</b></div></label>
  })}</div>
}

function PrivateLandlordInputs({ settings, onSettingChange, compact = false }) {
  if (settings.accountType !== 'private') return null
  return <section className={`private-tax-inputs ${compact ? 'compact' : ''}`}><header><PoundSterling size={15} /><div><b>Private landlord tax</b><small>{TAX_YEAR} income-tax assumptions</small></div></header><label><span>Other gross annual income</span><div className="private-income-field"><b>£</b><input aria-label="Other gross annual income" type="number" min="0" step="100" value={Number(settings.grossAnnualIncome || 0)} onChange={(event) => onSettingChange('grossAnnualIncome', Number(event.target.value))} /></div><small>Before property income; excludes savings and dividends.</small>{!Number(settings.grossAnnualIncome) && <small className="tax-input-warning">Currently assumes you have no other taxable income.</small>}</label><div className="tax-jurisdiction"><span>Tax jurisdiction</span><div><button className={settings.taxJurisdiction !== 'scotland' ? 'active' : ''} onClick={() => onSettingChange('taxJurisdiction', 'england')}>England</button><button className={settings.taxJurisdiction === 'scotland' ? 'active' : ''} onClick={() => onSettingChange('taxJurisdiction', 'scotland')}>Scotland</button></div></div></section>
}

function PrivateTaxSummary({ portfolio, settings }) {
  if (settings.accountType !== 'private') return null
  return <section className="panel private-tax-summary"><header><div><span className="kicker">PRIVATE LANDLORD · {TAX_YEAR}</span><h2>Estimated property income tax</h2><p>Rental profit is stacked on your other gross income. Residential mortgage interest receives basic-rate relief instead of being deducted from profit.</p></div><span className="panel-stat">{settings.taxJurisdiction === 'scotland' ? 'Scotland' : 'England'}</span></header><div className="private-tax-scenarios">{portfolio.scenarios.map((scenario, index) => <article key={scenario.id} style={{ '--scenario': scenarioMeta[index].colour }}><span>{scenarioMeta[index].name}</span><strong>{currency(scenario.tax * 12)}</strong><small>estimated annual tax</small><dl><div><dt>Taxable property profit</dt><dd>{currency(scenario.privateTax?.propertyProfit)}</dd></div><div><dt>Finance-cost reduction</dt><dd>{currency(scenario.privateTax?.financeCostTaxReduction)}</dd></div><div><dt>Marginal income-tax rate</dt><dd>{percent(scenario.privateTax?.marginalRate, 0)}</dd></div></dl></article>)}</div><footer>Planning estimate only · excludes pension reliefs, losses brought forward, savings, dividends and unused finance costs carried forward.</footer></section>
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
  return <section className="sidebar-profile-editor"><header><Building2 size={15} /><div><b>Portfolio profile</b><small>Account identity</small></div></header><div className="account-type-toggle"><button className={!isPrivate ? 'active' : ''} onClick={() => onChange('accountType', 'company')}>Company</button><button className={isPrivate ? 'active' : ''} onClick={() => onChange('accountType', 'private')}>Private</button></div><label className={isPrivate ? 'not-applicable' : ''} title={isPrivate ? 'Not used for private landlords.' : undefined}><span>Company name <small>optional</small></span><input disabled={isPrivate} value={settings.companyName || ''} onChange={(event) => onChange('companyName', event.target.value)} placeholder="Property company" /></label></section>
}

function AccountSetupModal({ onComplete }) {
  const [accountType, setAccountType] = useState('company')
  const [companyName, setCompanyName] = useState('')
  const isPrivate = accountType === 'private'
  return <div className="setup-layer"><section className="setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title"><span className="setup-icon">{isPrivate ? <Home /> : <Building2 />}</span><span className="kicker">ONE QUICK DETAIL</span><h2 id="setup-title">How do you hold your properties?</h2><p>This keeps company-only fields out of the way when they do not apply.</p><div className="setup-account-types"><button className={!isPrivate ? 'active' : ''} onClick={() => setAccountType('company')}><Building2 /><span><b>Limited company</b><small>Company costs and corporation tax</small></span><Check /></button><button className={isPrivate ? 'active' : ''} onClick={() => setAccountType('private')}><Home /><span><b>Private landlord</b><small>Personal property portfolio</small></span><Check /></button></div>{!isPrivate && <label className="setup-company-name"><span>Company name <small>optional</small></span><input autoFocus value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="e.g. Quark Holdings" /></label>}<button className="primary-button setup-continue" onClick={() => onComplete({ accountType, companyName: isPrivate ? '' : companyName.trim(), onboardingComplete: true })}>Continue to portfolio <ArrowUpRight size={17} /></button></section></div>
}

function AssetPositionChart({ properties }) {
  const maxValue = Math.max(1, ...properties.map((p) => p.latestValuation))
  return (
    <div className="asset-position" role="img" aria-label="Overlapping property valuation and loan bars">
      <div className="chart-legend"><span><i className="dot value" />Full valuation (100%)</span><span><i className="dot loan" />Loan share</span><span><i className="dot equity" />Equity share</span></div>
      <div className="asset-rows">
        {properties.map((p) => (
          <div className="asset-row" key={p.id}>
            <div className="asset-label"><b>{p.name}</b><small>{p.flatNumber}, {p.address}</small></div>
            <div className="asset-track-wrap"><div className="asset-track" style={{ width: `${Math.max(30, p.latestValuation / maxValue * 100)}%` }}><span className="asset-value-bar" /><span className="asset-loan-bar" style={{ width: `${Math.min(100, p.currentLtv * 100)}%` }} /></div></div>
            <div className="asset-numbers"><span><b>{currency(p.latestValuation)}</b><small>Value · 100%</small></span><span><b>{currency(p.loanAmount)}</b><small>Loan · {percent(p.currentLtv, 1)}</small></span><span><b>{currency(p.equity)}</b><small>Equity · {percent(1 - p.currentLtv, 1)}</small></span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelControls({ settings, onChange, compact = false }) {
  return (
    <div className={`model-controls ${compact ? 'compact' : ''}`}>
      {[['fullyManaged', 'Fully managed']].map(([key, label]) => <label key={key} className={settings[key] ? 'selected' : ''}><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => onChange(key, event.target.checked)} /><i><Check size={12} /></i><span>{label}</span></label>)}
    </div>
  )
}

function ScenarioTable({ scenarios, count }) {
  return <div className="scenario-list">{scenarios.map((scenario, index) => <div className="scenario" key={scenario.id} style={{ '--scenario': scenarioMeta[index].colour }}><div><i>{scenario.id}</i><span><b>{scenarioMeta[index].name}</b><small>{scenarioMeta[index].note}</small></span></div><div><span>Tax / mo</span><b className="negative">{currency(scenario.tax)}</b></div><div><span>Cashflow / mo</span><b className={scenario.cashflow >= 0 ? 'positive' : 'negative'}>{currency(scenario.cashflow)}</b></div><div><span>Total gain / yr</span><b>{currency(scenario.totalGain * 12)}</b></div><div><span>Per flat / mo</span><b>{currency(count ? scenario.cashflow / count : 0)}</b></div></div>)}</div>
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

function ProjectionExplorer({ properties, settings, portfolio, onSettingChange }) {
  const [metric, setMetric] = useState('cashPot')
  const [perFlat, setPerFlat] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const points = useMemo(() => projectPortfolio(properties, settings, settings.projectionMonths), [properties, settings])
  const tablePoints = points.filter((point) => point.month > 0 && point.month % 12 === 0)
  const metricLabels = { cashPot: 'Cash pot', totalGain: 'Total gain', cashflow: 'Cash flow', appreciation: 'Appreciation' }
  const divisor = perFlat ? Math.max(1, portfolio.count) : 1
  return <section className="panel projection-explorer"><header><div><span className="kicker">FORWARD VIEW</span><h2>Scenario accumulation over time</h2><p>Compare how cash and value build across the three sheet scenarios.</p></div><div className="projection-duration"><span>Horizon</span><select value={settings.projectionMonths} onChange={(event) => onSettingChange('projectionMonths', Number(event.target.value))}><option value={36}>3 years</option><option value={60}>5 years</option><option value={120}>10 years</option></select></div></header><div className="projection-toolbar"><div className="segmented">{Object.entries(metricLabels).map(([key, label]) => <button className={metric === key ? 'active' : ''} key={key} onClick={() => setMetric(key)}>{label}</button>)}</div><label className="per-flat-toggle"><input type="checkbox" checked={perFlat} onChange={(event) => setPerFlat(event.target.checked)} /><i /><span>Per flat</span></label></div><ProjectionChart points={points} metric={metric} perFlat={perFlat} count={portfolio.count} /><button className="projection-table-toggle" onClick={() => setTableOpen((open) => !open)}>{tableOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}<span><b>{tableOpen ? 'Hide' : 'Expand'} projection table</b><small>Annual snapshots · {metricLabels[metric]}{perFlat ? ' per flat' : ''}</small></span></button>{tableOpen && <div className="projection-table-wrap"><table className="projection-table"><thead><tr><th>Point in time</th>{scenarioMeta.map((scenario) => <th key={scenario.name} style={{ '--scenario': scenario.colour }}>{scenario.name}<small>{scenario.note}</small></th>)}</tr></thead><tbody>{tablePoints.map((point) => <tr key={point.month}><th>{point.month / 12} year{point.month === 12 ? '' : 's'}<small>{shortDate(point.date)}</small></th>{point.scenarios.map((scenario, index) => <td key={index} style={{ '--scenario': scenarioMeta[index].colour }}><b>{currency(scenario[metric] / divisor)}</b><span className={scenario[metric] >= 0 ? 'positive' : 'negative'}>{scenario[metric] >= 0 ? 'Positive' : 'Negative'}</span></td>)}</tr>)}</tbody></table></div>}</section>
}

const propertyCostFields = [
  ['factorsFees', 'Factors / service charge', 'fixed'],
  ['legionella', 'Legionella reserve', 'fixed'],
  ['gasCertificate', 'Gas certificate reserve', 'fixed'],
  ['eicr', 'EICR reserve', 'fixed'],
  ['mortgageAdmin', 'Mortgage filing reserve', 'fixed'],
  ['repairs', 'Repairs reserve', 'variable'],
  ['applianceReserve', 'Appliance reserve', 'variable'],
]

function LineItemsEditor({ title, description, items, onChange, onAdd, onRemove, timed = false, tone, disabled = false }) {
  const total = items.filter((item) => item.enabled !== false).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return <section className={`panel cashflow-editor ${tone} ${disabled ? 'not-applicable' : ''}`} title={disabled ? 'Not used for private landlords.' : undefined}><header><div><span className="kicker">{title}</span><h2>{currency(disabled ? 0 : total)} <small>/ month</small></h2><p>{disabled ? 'Not used for private landlords.' : description}</p></div><button disabled={disabled} className="secondary-button small" onClick={onAdd}><Plus size={15} /> Add line</button></header><div className="cashflow-lines">{items.length === 0 && <div className="empty-cashflow"><ReceiptText size={22} /><b>No line items yet</b><span>Add one when this account has a recurring cash flow.</span></div>}{items.map((item) => <div className={`cashflow-line ${item.enabled === false ? 'disabled' : ''}`} key={item.id}><label className="cashflow-enabled"><input disabled={disabled} type="checkbox" checked={item.enabled !== false} onChange={(event) => onChange(item.id, 'enabled', event.target.checked)} /><i><Check size={12} /></i></label><label className="cashflow-name"><span>Description</span><input disabled={disabled} value={item.name} onChange={(event) => onChange(item.id, 'name', event.target.value)} placeholder="New monthly item" /></label><label><span>Monthly amount</span><div className="money-input"><b>£</b><input disabled={disabled} type="number" min="0" step="0.01" value={moneyInputValue(item.amount)} onChange={(event) => onChange(item.id, 'amount', Number(event.target.value))} /></div></label>{timed && <label><span>Months remaining</span><input disabled={disabled} type="number" min="0" step="1" value={item.monthsRemaining || ''} onChange={(event) => onChange(item.id, 'monthsRemaining', Number(event.target.value))} placeholder="Ongoing" /></label>}<button disabled={disabled} className="icon-button cashflow-delete" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name || 'line item'}`}><Trash2 size={16} /></button></div>)}</div></section>
}

function CostsWorkspace({ properties, calculated, settings, portfolio, onPropertyChange, onLineItemChange, onLineItemAdd, onLineItemRemove }) {
  const isPrivate = settings.accountType === 'private'
  return <div className="costs-workspace">
    <section className="metrics-grid">
      <MetricCard eyebrow="PROPERTY FIXED COSTS" value={currency(portfolio.propertyFixedCosts)} delta="Mortgages, factors & compliance" icon={Home} tone="dark" />
      <MetricCard eyebrow="PROPERTY VARIABLE COSTS" value={currency(portfolio.variableCosts)} delta="Voids, repairs & appliances" icon={Gauge} />
      <MetricCard eyebrow="COMPANY COSTS" value={currency(portfolio.companyCosts)} delta={isPrivate ? 'Not used for private landlords' : 'Editable recurring overheads'} icon={Landmark} disabled={isPrivate} />
      <MetricCard eyebrow="OWNER EXTRACTIONS" value={currency(portfolio.extractionTotal)} delta="Editable tax-deductible value" icon={WalletCards} tone="green" />
    </section>

    <section className="panel property-cost-panel"><header><div><span className="kicker">PROPERTY CASH FLOWS</span><h2>Every property, line by line</h2><p>Income and monthly cost assumptions feed directly into all scenarios and projections.</p></div></header><div className="property-cost-grid">{calculated.map((property) => {
      const source = properties.find((item) => item.id === property.id)
      const mortgageAutomatic = source.mortgageOverride === '' || source.mortgageOverride == null
      const voidsAutomatic = source.voidsOverride === '' || source.voidsOverride == null
      return <article className="property-cost-card" key={property.id}><header><div><span>{property.name}</span><h3>{property.flatNumber}, {property.address}</h3></div><b>{currency(property.rent - property.fixedCosts - property.variableCosts)}<small> before company costs</small></b></header><div className="cost-category income"><span>Monthly income</span><label><b>Rent</b><div className="money-input"><i>£</i><input type="number" min="0" step="1" value={moneyInputValue(source.rent)} onChange={(event) => onPropertyChange(property.id, 'rent', Number(event.target.value))} /></div></label></div><div className="cost-category"><span>Fixed property costs</span><label><b>Mortgage payment {mortgageAutomatic && <small>calculated</small>}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(property.monthlyPayment)} onChange={(event) => onPropertyChange(property.id, 'mortgageOverride', Number(event.target.value))} /></div></label>{propertyCostFields.filter(([, , group]) => group === 'fixed').map(([key, label]) => <label key={key}><b>{label}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(source[key] ?? property[key])} onChange={(event) => onPropertyChange(property.id, key, Number(event.target.value))} /></div></label>)}</div><div className="cost-category variable"><span>Variable property costs</span><label><b>Void allowance {voidsAutomatic && <small>1/12 rent</small>}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(property.voids)} onChange={(event) => onPropertyChange(property.id, 'voidsOverride', Number(event.target.value))} /></div></label>{propertyCostFields.filter(([, , group]) => group === 'variable').map(([key, label]) => <label key={key}><b>{label}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(source[key])} onChange={(event) => onPropertyChange(property.id, key, Number(event.target.value))} /></div></label>)}</div></article>
    })}{calculated.length === 0 && <div className="empty-cashflow"><Home size={24} /><b>No properties yet</b><span>Add a BTL to start entering its income and costs.</span></div>}</div></section>

    <div className="cashflow-editor-grid">
      <LineItemsEditor title="COMPANY COSTS" description="Account-level overheads and finance payments. Set a remaining term for temporary costs." items={settings.companyCosts} timed tone="company" disabled={isPrivate} onChange={(id, key, value) => onLineItemChange('companyCosts', id, key, value)} onAdd={() => onLineItemAdd('companyCosts', 'New company cost')} onRemove={(id) => onLineItemRemove('companyCosts', id)} />
      <LineItemsEditor title="EXTRACTIONS" description="Generic owner or employee value items. Add, rename, switch off or remove anything." items={settings.extractions} tone="extraction" onChange={(id, key, value) => onLineItemChange('extractions', id, key, value)} onAdd={() => onLineItemAdd('extractions', 'New extraction')} onRemove={(id) => onLineItemRemove('extractions', id)} />
    </div>
    <section className="panel cashflow-reconciliation"><header><div><span className="kicker">CASH-FLOW RECONCILIATION</span><h2>Where every pound goes</h2><p>Management is calculated from the model toggle and rate. {isPrivate ? 'Estimated income tax' : 'Corporation tax'} changes with each scenario.</p></div></header><div className="reconciliation-wrap"><table><thead><tr><th>Monthly line</th>{scenarioMeta.map((scenario) => <th key={scenario.name} style={{ '--scenario': scenario.colour }}>{scenario.name}<small>{scenario.note}</small></th>)}</tr></thead><tbody>{[
      ['Rent received', () => portfolio.rent, 'income'],
      ['Property fixed costs', () => -portfolio.propertyFixedCosts, 'cost'],
      ['Company costs', () => -portfolio.companyCosts, 'cost', true],
      ['Management fee', () => -portfolio.management, 'cost'],
      ['Variable property costs', (_, index) => index === 0 ? -portfolio.variableCosts : index === 1 ? -(portfolio.variableCosts - portfolio.selected.reduce((sum, property) => sum + property.voids, 0)) : 0, 'cost'],
      ['Extraction deductions', () => -portfolio.extractionTotal, 'cost'],
      ['Taxable profit', (scenario) => scenario.taxable, 'subtotal'],
      [isPrivate ? 'Estimated income tax' : 'Corporation tax', (scenario) => -scenario.tax, 'cost', false],
      ['Extractions returned as owner value', () => portfolio.extractionTotal, 'income'],
      ['Net monthly owner value', (scenario) => scenario.cashflow, 'total'],
    ].map(([label, getter, kind, companyOnly]) => <tr className={`${kind} ${companyOnly && isPrivate ? 'not-applicable-row' : ''}`} title={companyOnly && isPrivate ? 'Not used for private landlords.' : undefined} key={label}><th>{label}</th>{portfolio.scenarios.map((scenario, index) => <td key={scenario.id}>{currency(getter(scenario, index))}</td>)}</tr>)}</tbody></table></div></section>
  </div>
}

function EditDrawer({ property, onSave, onClose, onDelete, isNew }) {
  const [draft, setDraft] = useState(property)
  useEffect(() => setDraft(property), [property])
  const update = (key, value, type) => setDraft((current) => ({
    ...current,
    [key]: type === 'percent' ? Number(value) / 100 : type === 'number' ? Number(value) : value,
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
                        type={type === 'percent' ? 'number' : type}
                        step={type === 'percent' ? '0.1' : type === 'number' ? 'any' : undefined}
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

function PortfolioApp({ user }) {
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const loaded = useRef(false)
  const [editingId, setEditingId] = useState(null)
  const [pendingProperty, setPendingProperty] = useState(null)
  const [section, setSection] = useState(() => BANKING_ENABLED && new URLSearchParams(window.location.search).get('bank_callback') === '1' ? 'Banking' : 'Overview')
  const [search, setSearch] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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
      loaded.current = true
      setState({
        properties: storedProperties
          .map((property) => migrateMortgageOverride(property, { ...defaultSettings, ...(portfolioState.settings || {}) })),
        settings: {
          ...defaultSettings,
          ...existingAccountDefaults,
          ...(portfolioState.settings || {}),
          companyName: portfolioState.settings?.companyName || (isEstablishedPortfolio ? 'Quark Holdings' : ''),
          onboardingComplete: isEstablishedPortfolio || Boolean(portfolioState.settings?.onboardingComplete),
          companyCosts: Array.isArray(portfolioState.settings?.companyCosts) ? portfolioState.settings.companyCosts : [],
          extractions: Array.isArray(portfolioState.settings?.extractions) ? portfolioState.settings.extractions : [],
        },
      })
    }
    loadPortfolio()
    return () => { active = false }
  }, [user.id])

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
  const calculated = state.properties.map((p) => calculateProperty(p, state.settings))

  const editing = pendingProperty || state.properties.find((p) => p.id === editingId)
  const closeEditor = () => { setEditingId(null); setPendingProperty(null) }
  const saveProperty = (draft) => {
    setState((current) => ({ ...current, properties: current.properties.some((p) => p.id === draft.id) ? current.properties.map((p) => p.id === draft.id ? draft : p) : [...current.properties, draft] }))
    closeEditor()
  }
  const cloneProperty = (id) => {
    const source = state.properties.find((p) => p.id === id)
    const clone = { ...source, id: crypto.randomUUID(), name: `BTL${state.properties.length + 1}`, address: `${source.address} (copy)`, active: true, tenantName: '', tenantEmail: '', tenantPhone: '', mortgageNumber: '' }
    setPendingProperty(clone)
    setEditingId(null)
  }
  const addProperty = () => {
    const next = createBlankProperty(`BTL${state.properties.length + 1}`)
    setPendingProperty(next)
    setEditingId(null)
  }
  const removeProperty = (id) => {
    setState((current) => ({ ...current, properties: current.properties.filter((p) => p.id !== id) }))
    closeEditor()
  }
  const toggleProperty = (id) => setState((current) => ({ ...current, properties: current.properties.map((p) => p.id === id ? { ...p, active: !p.active } : p) }))
  const updatePropertyField = (id, key, value) => setState((current) => ({
    ...current,
    properties: current.properties.map((property) => {
      if (property.id !== id) return property
      if (key === 'mortgageOverride') return anchorMortgageOverride(property, value, current.settings)
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
  const addLineItem = (collection, name) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: [...current.settings[collection], { id: crypto.randomUUID(), name, amount: 0, enabled: true, ...(collection === 'companyCosts' ? { monthsRemaining: 0 } : {}) }] } }))
  const removeLineItem = (collection, id) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: current.settings[collection].filter((item) => item.id !== id) } }))
  const reset = () => { if (window.confirm('Reset the model inputs to their defaults? Your properties and cash-flow lines will be kept.')) setState((current) => ({ ...current, settings: { ...current.settings, ...assumptions, fullyManaged: false } })) }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Portfolio owner'
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const portfolioName = state.settings.accountType === 'private' ? `${displayName}'s portfolio` : state.settings.companyName || 'Property portfolio'

  const filtered = calculated.filter((p) => `${p.name} ${p.address} ${p.postcode}`.toLowerCase().includes(search.toLowerCase()))
  const visibleWorkspaceNavigation = workspaceNavigation.filter(([label]) => {
    if (!BANKING_ENABLED && label === 'Banking') return false
    if (state.settings.accountType === 'private' && label === 'Companies House') return false
    return true
  })
  const navigateMobile = (nextSection) => {
    setSection(nextSection)
    setMobileNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <button className={`mobile-nav-backdrop ${mobileNavOpen ? 'open' : ''}`} onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" tabIndex={mobileNavOpen ? 0 : -1} />
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Portfolio navigation">
        <div className="brand"><span><Building2 size={20} /></span><div><strong>{state.settings.companyName || (state.settings.accountType === 'private' ? 'PRIVATE' : 'PROPERTY')}</strong><small>PORTFOLIO</small></div><button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
        <div className="sidebar-body">
          <nav>
            <small>WORKSPACE</small>
            {visibleWorkspaceNavigation.map(([label, , Icon]) => <button key={label} className={section === label ? 'active' : ''} onClick={() => { setSection(label); setMobileNavOpen(false) }}><Icon size={18} />{label}</button>)}
            <small>PORTFOLIO</small>
            {calculated.map((p) => <button key={p.id} className="property-nav" onClick={() => { setSection('Properties'); setSearch(p.name); setMobileNavOpen(false) }}><i>{p.name.replace(/\D/g, '')}</i><span>{p.name}<small>{p.postcode}</small></span></button>)}
          </nav>
          <section className="sidebar-model-inputs">
            <header><Sparkles size={15} /><div><b>Model inputs</b><small>Portfolio assumptions</small></div></header>
            <ModelInputFields settings={state.settings} onSettingChange={updateSetting} onPercentChange={updatePercentSetting} compact />
            <PrivateLandlordInputs settings={state.settings} onSettingChange={updateSetting} compact />
          </section>
          <AccountProfileEditor settings={state.settings} onChange={updateSetting} />
        </div>
        <div className="sidebar-foot"><div className="avatar">{initials}</div><span><b>{displayName}</b><small>{user.email}</small></span><button className="sidebar-signout" onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut size={16} /></button></div>
      </aside>

      <main>
        <header className="topbar">
          <div><button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-expanded={mobileNavOpen}><Menu /></button><span>{portfolioName}</span><b>/</b><strong>{section}</strong></div>
          <div><span className={`save-status ${saveStatus}`} title={saveStatus === 'error' ? 'Could not save changes' : 'Your account data is saved securely'}>{saveStatus === 'error' ? <CloudOff size={15} /> : <Cloud size={15} />}{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}</span><button className="secondary-button small" onClick={reset}><RotateCcw size={15} /> Reset inputs</button></div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div><span className="eyebrow">LIVE PORTFOLIO MODEL</span><h1>{section === 'Overview' ? 'Portfolio overview' : section}</h1><p>{portfolio.count} active BTLs · Last calculated just now · GBP</p></div>
          </section>

          {(section === 'Overview' || section === 'Projections') && <section className="global-model-strip"><div><span className="kicker">LIVE MODEL OPTIONS</span><p>Changes recalculate every overview, property metric and projection.</p></div><ModelControls settings={state.settings} onChange={updateSetting} /></section>}

          {(section === 'Overview' || section === 'Projections') && <PrivateTaxSummary portfolio={portfolio} settings={state.settings} />}

          {section === 'Overview' && <>
            <section className="metrics-grid">
              <MetricCard eyebrow="PORTFOLIO VALUE" value={currency(portfolio.totalValue)} delta={`${currency(portfolio.totalEquity)} total equity`} icon={Landmark} tone="dark" />
              <MetricCard eyebrow="MONTHLY RENT" value={currency(portfolio.rent)} delta={`${currency(portfolio.rent * 12)} annually`} icon={PoundSterling} tone="green" />
              <MetricCard eyebrow="MONTHLY CASHFLOW" value={currency(portfolio.scenarios[0]?.cashflow)} delta="Conservative scenario" icon={portfolio.scenarios[0]?.cashflow >= 0 ? ArrowUpRight : ArrowDownRight} />
              <MetricCard eyebrow="WEIGHTED RATE" value={percent(portfolio.weightedRate, 2)} delta={`${percent(state.settings.rateShock, 2)} rate shock included`} icon={TrendingUp} />
            </section>

            <section className="main-grid">
              <article className="panel span-2"><header><div><span className="kicker">ASSET POSITION</span><h2>How much of each flat is financed?</h2></div><span className="panel-stat">{percent(portfolio.totalLoans / portfolio.totalValue, 1)} portfolio LTV</span></header><AssetPositionChart properties={portfolio.selected} /></article>
              <article className="panel buffer-panel"><header><div><span className="kicker">SAFETY BUFFER</span><h2>Cash resilience</h2></div><ShieldCheck size={20} /></header><div className="buffer-ring" style={{ '--value': `${Math.min(100, portfolio.cashHeld / Math.max(1, portfolio.safeCashNeeded) * 100)}%` }}><div><strong>{portfolio.bufferMonths.toFixed(1)}</strong><span>months</span></div></div><div className="buffer-lines"><p><span>Cash held</span><b>{currency(portfolio.cashHeld)}</b></p><p><span>Six-month target</span><b>{currency(portfolio.safeCashNeeded)}</b></p><p className={portfolio.extraCashNeeded ? 'warn' : 'ok'}><span>{portfolio.extraCashNeeded ? 'Additional cash needed' : 'Buffer status'}</span><b>{portfolio.extraCashNeeded ? currency(portfolio.extraCashNeeded) : 'Safe'}</b></p></div></article>
            </section>

            <section className="properties-heading"><div><span className="kicker">THE PORTFOLIO</span><h2>Properties</h2></div><button className="text-button" onClick={() => setSection('Properties')}>View full table <ArrowUpRight size={16} /></button></section>
            <section className="property-cards">{calculated.map((p) => <PropertyCard key={p.id} property={p} onEdit={setEditingId} onClone={cloneProperty} onToggle={toggleProperty} />)}<button className="add-property-card" onClick={addProperty}><span><Plus /></span><b>Add another BTL</b><small>Start blank or clone an existing property</small></button></section>

            <section className="panel scenarios-panel"><header><div><span className="kicker">DYNAMIC PROJECTIONS</span><h2>Cashflow scenarios</h2></div><ModelControls settings={state.settings} onChange={updateSetting} compact /></header><ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} /></section>
          </>}

          {section === 'Properties' && <><section className="panel properties-toolbar"><div><span className="kicker">CLEAR COMPARISON VIEW</span><h2>Property information by section</h2><p>Basics, performance and dates are separated so each property is easier to scan.</p></div><div className="table-tools"><label><Search size={17} /><input placeholder="Search BTLs" value={search} onChange={(e) => setSearch(e.target.value)} /></label><button className="primary-button small" onClick={addProperty}><Plus size={16} /> New BTL</button></div></section><div className="property-group-stack">{propertyGroups.map((group) => <section className={`panel data-panel property-group-panel ${group.tone}`} key={group.title}><header><div><span className="group-marker" /><div><h2>{group.title}</h2><p>{group.description}</p></div></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Metric</th>{filtered.map((p) => <th key={p.id}><button onClick={() => setEditingId(p.id)}>{p.name}<small>{p.postcode}</small></button></th>)}</tr></thead><tbody>{group.rows.map(([label, getter, kind]) => <tr key={label}><th>{label}</th>{filtered.map((p) => <td className={kind} key={p.id}>{getter(p)}</td>)}</tr>)}</tbody></table></div></section>)}</div></>}

          {section === 'Costs & Cash Flows' && <CostsWorkspace properties={state.properties} calculated={calculated} settings={state.settings} portfolio={portfolio} onPropertyChange={updatePropertyField} onLineItemChange={updateLineItem} onLineItemAdd={addLineItem} onLineItemRemove={removeLineItem} />}

          {BANKING_ENABLED && section === 'Banking' && <BankWorkspace user={user} onCashHeldChange={updateConnectedCashHeld} />}

          {section === 'Projections' && <>
            <section className="metrics-grid"><MetricCard eyebrow="MONTHLY APPRECIATION" value={currency(portfolio.appreciation)} delta={`${currency(portfolio.appreciation * 12)} annually`} icon={TrendingUp} tone="green" /><MetricCard eyebrow="FIXED COSTS" value={currency(portfolio.fixedCosts)} delta={`${currency(portfolio.fixedCosts * 12)} annually`} icon={Landmark} /><MetricCard eyebrow="VARIABLE COSTS" value={currency(portfolio.variableCosts)} delta="Voids, repairs & appliances" icon={Gauge} /><MetricCard eyebrow="EXTRACTIONS" value={currency(portfolio.extractionTotal)} delta="Editable in Costs & Cash Flows" icon={WalletCards} /></section>
            <section className="panel scenarios-panel"><header><div><span className="kicker">SHEET-MATCHED MODEL</span><h2>Current monthly scenarios</h2></div><ModelControls settings={state.settings} onChange={updateSetting} compact /></header><ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} /></section>
            <ProjectionExplorer properties={state.properties} settings={state.settings} portfolio={portfolio} onSettingChange={updateSetting} />
            <section className="panel assumptions-panel"><header><div><span className="kicker">MODEL INPUTS</span><h2>Portfolio assumptions</h2><p>Percentages are entered and displayed as true percentage values.</p></div></header><ModelInputFields settings={state.settings} onSettingChange={updateSetting} onPercentChange={updatePercentSetting} /><PrivateLandlordInputs settings={state.settings} onSettingChange={updateSetting} /></section>
          </>}

          {section === 'Compliance' && <section className="panel compliance-panel"><header><div><span className="kicker">RELEVANT DATES</span><h2>Compliance & remortgage diary</h2></div></header><div className="compliance-list">{calculated.flatMap((p) => [['Call broker',p.brokerDate],['Gas certificate',p.gasExpiry],['EICR',p.eicrExpiry],['PAT testing',p.patExpiry],['EPC',p.epcExpiry]].map(([label,date]) => ({ property:p.name,label,date:new Date(date instanceof Date ? date : `${date}T12:00:00`) }))).filter((item) => !Number.isNaN(item.date.getTime())).sort((a,b) => a.date-b.date).map((item, index) => <div key={`${item.property}-${item.label}`}><span className={index < 3 ? 'date-badge urgent' : 'date-badge'}><CalendarClock size={17} /></span><p><b>{item.label}</b><small>{item.property}</small></p><time>{shortDate(item.date)}</time></div>)}</div></section>}

          {section === 'Companies House' && state.settings.accountType !== 'private' && <CompaniesHouseWorkspace settings={state.settings} onSettingChange={updateSetting} />}
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile workspace navigation">
        {visibleWorkspaceNavigation.slice(0, 4).map(([label, shortLabel, Icon]) => <button key={label} className={section === label ? 'active' : ''} onClick={() => navigateMobile(label)}><Icon size={20} /><span>{shortLabel}</span></button>)}
        <button className={visibleWorkspaceNavigation.slice(4).some(([label]) => label === section) ? 'active' : ''} onClick={() => setMobileNavOpen(true)}><Menu size={20} /><span>More</span></button>
      </nav>

      {editing && <EditDrawer property={editing} isNew={!state.properties.some((p) => p.id === editing.id)} onSave={saveProperty} onClose={closeEditor} onDelete={removeProperty} />}
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
  if (session === undefined) return <div className="app-status-screen"><span className="loading-mark"><Building2 /></span><h1>Checking your session…</h1></div>
  return session ? <PortfolioApp user={session.user} /> : <AuthScreen />
}
