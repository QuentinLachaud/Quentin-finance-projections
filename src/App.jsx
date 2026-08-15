import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Building2, CalendarClock, Check, ChevronDown,
  ChevronUp, PoundSterling, Copy, ExternalLink, Gauge, Home, Landmark, MapPin, Menu, MoreHorizontal,
  Pencil, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, TrendingUp,
  WalletCards, X, LogOut, Cloud, CloudOff, ReceiptText,
} from 'lucide-react'
import { assumptions, createBlankProperty, editableSections } from './data.js'
import { calculatePortfolio, calculateProperty, currency, percent, projectPortfolio, shortDate } from './calculations.js'
import AuthScreen from './AuthScreen.jsx'
import { isSupabaseConfigured, supabase } from './supabase.js'

const defaultSettings = { ...assumptions, fullyManaged: false, companyCosts: [], extractions: [] }
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
  ['corporationTaxRate', 'Corporation tax', '%', 'percent'],
  ['managementRate', 'Management fee', '%', 'percent'],
  ['cashHeld', 'Cash held', '£', 'number'],
  ['bufferMonths', 'Target buffer', 'months', 'number'],
]

function MetricCard({ eyebrow, value, delta, icon: Icon, tone = 'neutral' }) {
  return (
    <article className={`metric-card ${tone}`}>
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
  return <div className={compact ? 'sidebar-input-list' : 'assumptions-grid'}>{modelInputFields.map(([key, label, suffix, type]) => <label key={key}><span>{label}</span><div><input aria-label={label} type="number" step={type === 'percent' ? '0.1' : 'any'} value={type === 'percent' ? percentInputValue(settings[key]) : settings[key]} onChange={(event) => type === 'percent' ? onPercentChange(key, event.target.value) : onSettingChange(key, Number(event.target.value))} /><b>{suffix}</b></div></label>)}</div>
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
  return <div className="scenario-list">{scenarios.map((scenario, index) => <div className="scenario" key={scenario.id} style={{ '--scenario': scenarioMeta[index].colour }}><div><i>{scenario.id}</i><span><b>{scenarioMeta[index].name}</b><small>{scenarioMeta[index].note}</small></span></div><div><span>Cashflow / mo</span><b className={scenario.cashflow >= 0 ? 'positive' : 'negative'}>{currency(scenario.cashflow)}</b></div><div><span>Total gain / yr</span><b>{currency(scenario.totalGain * 12)}</b></div><div><span>Per flat / mo</span><b>{currency(count ? scenario.cashflow / count : 0)}</b></div></div>)}</div>
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

function LineItemsEditor({ title, description, items, onChange, onAdd, onRemove, timed = false, tone }) {
  const total = items.filter((item) => item.enabled !== false).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return <section className={`panel cashflow-editor ${tone}`}><header><div><span className="kicker">{title}</span><h2>{currency(total)} <small>/ month</small></h2><p>{description}</p></div><button className="secondary-button small" onClick={onAdd}><Plus size={15} /> Add line</button></header><div className="cashflow-lines">{items.length === 0 && <div className="empty-cashflow"><ReceiptText size={22} /><b>No line items yet</b><span>Add one when this account has a recurring cash flow.</span></div>}{items.map((item) => <div className={`cashflow-line ${item.enabled === false ? 'disabled' : ''}`} key={item.id}><label className="cashflow-enabled"><input type="checkbox" checked={item.enabled !== false} onChange={(event) => onChange(item.id, 'enabled', event.target.checked)} /><i><Check size={12} /></i></label><label className="cashflow-name"><span>Description</span><input value={item.name} onChange={(event) => onChange(item.id, 'name', event.target.value)} placeholder="New monthly item" /></label><label><span>Monthly amount</span><div className="money-input"><b>£</b><input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => onChange(item.id, 'amount', Number(event.target.value))} /></div></label>{timed && <label><span>Months remaining</span><input type="number" min="0" step="1" value={item.monthsRemaining || ''} onChange={(event) => onChange(item.id, 'monthsRemaining', Number(event.target.value))} placeholder="Ongoing" /></label>}<button className="icon-button cashflow-delete" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name || 'line item'}`}><Trash2 size={16} /></button></div>)}</div></section>
}

function CostsWorkspace({ properties, calculated, settings, portfolio, onPropertyChange, onLineItemChange, onLineItemAdd, onLineItemRemove }) {
  return <div className="costs-workspace">
    <section className="metrics-grid">
      <MetricCard eyebrow="PROPERTY FIXED COSTS" value={currency(portfolio.propertyFixedCosts)} delta="Mortgages, factors & compliance" icon={Home} tone="dark" />
      <MetricCard eyebrow="PROPERTY VARIABLE COSTS" value={currency(portfolio.variableCosts)} delta="Voids, repairs & appliances" icon={Gauge} />
      <MetricCard eyebrow="COMPANY COSTS" value={currency(portfolio.companyCosts)} delta="Editable recurring overheads" icon={Landmark} />
      <MetricCard eyebrow="OWNER EXTRACTIONS" value={currency(portfolio.extractionTotal)} delta="Editable tax-deductible value" icon={WalletCards} tone="green" />
    </section>

    <section className="panel property-cost-panel"><header><div><span className="kicker">PROPERTY CASH FLOWS</span><h2>Every property, line by line</h2><p>Income and monthly cost assumptions feed directly into all scenarios and projections.</p></div></header><div className="property-cost-grid">{calculated.map((property) => {
      const source = properties.find((item) => item.id === property.id)
      const mortgageAutomatic = source.mortgageOverride === '' || source.mortgageOverride == null
      const voidsAutomatic = source.voidsOverride === '' || source.voidsOverride == null
      return <article className="property-cost-card" key={property.id}><header><div><span>{property.name}</span><h3>{property.flatNumber}, {property.address}</h3></div><b>{currency(property.rent - property.fixedCosts - property.variableCosts)}<small> before company costs</small></b></header><div className="cost-category income"><span>Monthly income</span><label><b>Rent</b><div className="money-input"><i>£</i><input type="number" min="0" step="1" value={moneyInputValue(source.rent)} onChange={(event) => onPropertyChange(property.id, 'rent', Number(event.target.value))} /></div></label></div><div className="cost-category"><span>Fixed property costs</span><label><b>Mortgage payment {mortgageAutomatic && <small>calculated</small>}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(property.monthlyPayment)} onChange={(event) => onPropertyChange(property.id, 'mortgageOverride', Number(event.target.value))} /></div></label>{propertyCostFields.filter(([, , group]) => group === 'fixed').map(([key, label]) => <label key={key}><b>{label}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(source[key] ?? property[key])} onChange={(event) => onPropertyChange(property.id, key, Number(event.target.value))} /></div></label>)}</div><div className="cost-category variable"><span>Variable property costs</span><label><b>Void allowance {voidsAutomatic && <small>1/12 rent</small>}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(property.voids)} onChange={(event) => onPropertyChange(property.id, 'voidsOverride', Number(event.target.value))} /></div></label>{propertyCostFields.filter(([, , group]) => group === 'variable').map(([key, label]) => <label key={key}><b>{label}</b><div className="money-input"><i>£</i><input type="number" min="0" step="0.01" value={moneyInputValue(source[key])} onChange={(event) => onPropertyChange(property.id, key, Number(event.target.value))} /></div></label>)}</div></article>
    })}{calculated.length === 0 && <div className="empty-cashflow"><Home size={24} /><b>No properties yet</b><span>Add a BTL to start entering its income and costs.</span></div>}</div></section>

    <div className="cashflow-editor-grid">
      <LineItemsEditor title="COMPANY COSTS" description="Account-level overheads and finance payments. Set a remaining term for temporary costs." items={settings.companyCosts} timed tone="company" onChange={(id, key, value) => onLineItemChange('companyCosts', id, key, value)} onAdd={() => onLineItemAdd('companyCosts', 'New company cost')} onRemove={(id) => onLineItemRemove('companyCosts', id)} />
      <LineItemsEditor title="EXTRACTIONS" description="Generic owner or employee value items. Add, rename, switch off or remove anything." items={settings.extractions} tone="extraction" onChange={(id, key, value) => onLineItemChange('extractions', id, key, value)} onAdd={() => onLineItemAdd('extractions', 'New extraction')} onRemove={(id) => onLineItemRemove('extractions', id)} />
    </div>
    <section className="panel cashflow-reconciliation"><header><div><span className="kicker">CASH-FLOW RECONCILIATION</span><h2>Where every pound goes</h2><p>Management is calculated from the model toggle and rate. Corporation tax changes with each scenario.</p></div></header><div className="reconciliation-wrap"><table><thead><tr><th>Monthly line</th>{scenarioMeta.map((scenario) => <th key={scenario.name} style={{ '--scenario': scenario.colour }}>{scenario.name}<small>{scenario.note}</small></th>)}</tr></thead><tbody>{[
      ['Rent received', () => portfolio.rent, 'income'],
      ['Property fixed costs', () => -portfolio.propertyFixedCosts, 'cost'],
      ['Company costs', () => -portfolio.companyCosts, 'cost'],
      ['Management fee', () => -portfolio.management, 'cost'],
      ['Variable property costs', (_, index) => index === 0 ? -portfolio.variableCosts : index === 1 ? -(portfolio.variableCosts - portfolio.selected.reduce((sum, property) => sum + property.voids, 0)) : 0, 'cost'],
      ['Extraction deductions', () => -portfolio.extractionTotal, 'cost'],
      ['Taxable profit', (scenario) => scenario.taxable, 'subtotal'],
      ['Corporation tax', (scenario) => -scenario.tax, 'cost'],
      ['Extractions returned as owner value', () => portfolio.extractionTotal, 'income'],
      ['Net monthly owner value', (scenario) => scenario.cashflow, 'total'],
    ].map(([label, getter, kind]) => <tr className={kind} key={label}><th>{label}</th>{portfolio.scenarios.map((scenario, index) => <td key={scenario.id}>{currency(getter(scenario, index))}</td>)}</tr>)}</tbody></table></div></section>
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
  const [section, setSection] = useState('Overview')
  const [search, setSearch] = useState('')

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
      loaded.current = true
      setState({
        properties: Array.isArray(portfolioState.properties) ? portfolioState.properties : [],
        settings: {
          ...defaultSettings,
          ...(portfolioState.settings || {}),
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
  const updatePropertyField = (id, key, value) => setState((current) => ({ ...current, properties: current.properties.map((property) => property.id === id ? { ...property, [key]: value } : property) }))
  const updateSetting = (key, value) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  const updatePercentSetting = (key, value) => updateSetting(key, Number(value) / 100)
  const updateLineItem = (collection, id, key, value) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: current.settings[collection].map((item) => item.id === id ? { ...item, [key]: value } : item) } }))
  const addLineItem = (collection, name) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: [...current.settings[collection], { id: crypto.randomUUID(), name, amount: 0, enabled: true, ...(collection === 'companyCosts' ? { monthsRemaining: 0 } : {}) }] } }))
  const removeLineItem = (collection, id) => setState((current) => ({ ...current, settings: { ...current.settings, [collection]: current.settings[collection].filter((item) => item.id !== id) } }))
  const reset = () => { if (window.confirm('Reset the model inputs to their defaults? Your properties and cash-flow lines will be kept.')) setState((current) => ({ ...current, settings: { ...current.settings, ...assumptions, fullyManaged: false } })) }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Portfolio owner'
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  const filtered = calculated.filter((p) => `${p.name} ${p.address} ${p.postcode}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><Building2 size={20} /></span><div><strong>QUARK</strong><small>HOLDINGS</small></div></div>
        <div className="sidebar-body">
          <nav>
            <small>WORKSPACE</small>
            {[
              ['Overview', Gauge], ['Properties', Home], ['Costs & Cash Flows', ReceiptText], ['Projections', TrendingUp], ['Compliance', ShieldCheck],
            ].map(([label, Icon]) => <button key={label} className={section === label ? 'active' : ''} onClick={() => setSection(label)}><Icon size={18} />{label}</button>)}
            <small>PORTFOLIO</small>
            {calculated.map((p) => <button key={p.id} className="property-nav" onClick={() => { setSection('Properties'); setSearch(p.name) }}><i>{p.name.replace(/\D/g, '')}</i><span>{p.name}<small>{p.postcode}</small></span></button>)}
          </nav>
          <section className="sidebar-model-inputs">
            <header><Sparkles size={15} /><div><b>Model inputs</b><small>Portfolio assumptions</small></div></header>
            <ModelInputFields settings={state.settings} onSettingChange={updateSetting} onPercentChange={updatePercentSetting} compact />
          </section>
        </div>
        <div className="sidebar-foot"><div className="avatar">{initials}</div><span><b>{displayName}</b><small>{user.email}</small></span><button className="sidebar-signout" onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut size={16} /></button></div>
      </aside>

      <main>
        <header className="topbar">
          <div><button className="mobile-menu"><Menu /></button><span>Quark Holdings</span><b>/</b><strong>{section}</strong></div>
          <div><span className={`save-status ${saveStatus}`} title={saveStatus === 'error' ? 'Could not save changes' : 'Your account data is saved securely'}>{saveStatus === 'error' ? <CloudOff size={15} /> : <Cloud size={15} />}{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}</span><button className="secondary-button small" onClick={reset}><RotateCcw size={15} /> Reset inputs</button><button className="primary-button small" onClick={addProperty}><Plus size={16} /> Add BTL</button></div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div><span className="eyebrow">LIVE PORTFOLIO MODEL</span><h1>{section === 'Overview' ? 'Portfolio overview' : section}</h1><p>{portfolio.count} active BTLs · Last calculated just now · GBP</p></div>
          </section>

          {(section === 'Overview' || section === 'Projections') && <section className="global-model-strip"><div><span className="kicker">LIVE MODEL OPTIONS</span><p>Changes recalculate every overview, property metric and projection.</p></div><ModelControls settings={state.settings} onChange={updateSetting} /></section>}

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

          {section === 'Projections' && <>
            <section className="metrics-grid"><MetricCard eyebrow="MONTHLY APPRECIATION" value={currency(portfolio.appreciation)} delta={`${currency(portfolio.appreciation * 12)} annually`} icon={TrendingUp} tone="green" /><MetricCard eyebrow="FIXED COSTS" value={currency(portfolio.fixedCosts)} delta={`${currency(portfolio.fixedCosts * 12)} annually`} icon={Landmark} /><MetricCard eyebrow="VARIABLE COSTS" value={currency(portfolio.variableCosts)} delta="Voids, repairs & appliances" icon={Gauge} /><MetricCard eyebrow="EXTRACTIONS" value={currency(portfolio.extractionTotal)} delta="Editable in Costs & Cash Flows" icon={WalletCards} /></section>
            <section className="panel scenarios-panel"><header><div><span className="kicker">SHEET-MATCHED MODEL</span><h2>Current monthly scenarios</h2></div><ModelControls settings={state.settings} onChange={updateSetting} compact /></header><ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} /></section>
            <ProjectionExplorer properties={state.properties} settings={state.settings} portfolio={portfolio} onSettingChange={updateSetting} />
            <section className="panel assumptions-panel"><header><div><span className="kicker">MODEL INPUTS</span><h2>Portfolio assumptions</h2><p>Percentages are entered and displayed as true percentage values.</p></div></header><ModelInputFields settings={state.settings} onSettingChange={updateSetting} onPercentChange={updatePercentSetting} /></section>
          </>}

          {section === 'Compliance' && <section className="panel compliance-panel"><header><div><span className="kicker">RELEVANT DATES</span><h2>Compliance & remortgage diary</h2></div></header><div className="compliance-list">{calculated.flatMap((p) => [['Call broker',p.brokerDate],['Gas certificate',p.gasExpiry],['EICR',p.eicrExpiry],['PAT testing',p.patExpiry],['EPC',p.epcExpiry]].map(([label,date]) => ({ property:p.name,label,date:new Date(date instanceof Date ? date : `${date}T12:00:00`) }))).filter((item) => !Number.isNaN(item.date.getTime())).sort((a,b) => a.date-b.date).map((item, index) => <div key={`${item.property}-${item.label}`}><span className={index < 3 ? 'date-badge urgent' : 'date-badge'}><CalendarClock size={17} /></span><p><b>{item.label}</b><small>{item.property}</small></p><time>{shortDate(item.date)}</time></div>)}</div></section>}
        </div>
      </main>

      {editing && <EditDrawer property={editing} isNew={!state.properties.some((p) => p.id === editing.id)} onSave={saveProperty} onClose={closeEditor} onDelete={removeProperty} />}
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
