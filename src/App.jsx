import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Building2, CalendarClock, Check, ChevronDown,
  PoundSterling, Copy, Gauge, Home, Landmark, Menu, MoreHorizontal,
  Pencil, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, TrendingUp, X,
} from 'lucide-react'
import { assumptions, editableSections, seedProperties } from './data.js'
import { calculatePortfolio, calculateProperty, currency, percent, shortDate } from './calculations.js'

const STORAGE_KEY = 'quark-finance-projections-v1'

const propertyRows = [
  ['Address', (p) => `${p.flatNumber}, ${p.address}`, 'text'],
  ['Postcode', (p) => p.postcode, 'text'],
  ['Purchase price', (p) => currency(p.purchasePrice), 'money'],
  ['Latest valuation', (p) => currency(p.latestValuation), 'money'],
  ['Expected value at remortgage', (p) => currency(p.expectedRemortgageValue), 'money'],
  ['Loan amount', (p) => currency(p.loanAmount), 'money'],
  ['Equity', (p) => currency(p.equity), 'money-positive'],
  ['Current LTV', (p) => percent(p.currentLtv), 'percent'],
  ['Expected LTV at remortgage', (p) => percent(p.expectedRemortgageLtv), 'percent'],
  ['Monthly rent', (p) => currency(p.rent), 'money-positive'],
  ['Monthly mortgage', (p) => currency(p.monthlyPayment, 0), 'money-negative'],
  ['Gross yield', (p) => percent(p.grossYield, 2), 'percent'],
  ['Net yield', (p) => percent(p.netYield, 2), 'percent'],
  ['ICR', (p) => percent(p.icr, 0), 'percent'],
  ['Releasable equity at 75% LTV', (p) => currency(p.releasableEquity), 'money'],
  ['Annual appreciation', (p) => currency(p.appreciationAnnual), 'money-positive'],
  ['Current rate + shock', (p) => percent(p.currentRate, 2), 'percent'],
  ['Lender', (p) => p.lender, 'text'],
  ['Next remortgage', (p) => shortDate(p.nextRemortgage), 'date'],
  ['Call broker', (p) => shortDate(p.brokerDate), 'date'],
  ['Gas certificate expiry', (p) => shortDate(p.gasExpiry), 'date'],
  ['EICR expiry', (p) => shortDate(p.eicrExpiry), 'date'],
  ['EPC expiry', (p) => shortDate(p.epcExpiry), 'date'],
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
      <div className="property-actions">
        <label className="switch-label"><input type="checkbox" checked={property.active} onChange={() => onToggle(property.id)} /><i /><span>In totals</span></label>
        <button className="text-button" onClick={() => onClone(property.id)}><Copy size={15} /> Clone</button>
        <button className="text-button" onClick={() => onEdit(property.id)}><Pencil size={15} /> Edit</button>
      </div>
    </article>
  )
}

function BarChart({ properties }) {
  const max = Math.max(1, ...properties.map((p) => p.latestValuation))
  return (
    <div className="bar-chart" role="img" aria-label="Property valuations and loan balances">
      <div className="chart-legend"><span><i className="dot value" />Valuation</span><span><i className="dot loan" />Loan</span></div>
      <div className="bars">
        {properties.map((p) => (
          <div className="bar-group" key={p.id}>
            <div className="bar-values"><span style={{ height: `${(p.latestValuation / max) * 100}%` }} /><i style={{ height: `${(p.loanAmount / max) * 100}%` }} /></div>
            <small>{p.name}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScenarioTable({ scenarios, count }) {
  const labels = ['All inclusive', 'No voids', 'No problems']
  return (
    <div className="scenario-list">
      {scenarios.map((scenario, index) => (
        <div className="scenario" key={scenario.id}>
          <div><i>{scenario.id}</i><span><b>{labels[index]}</b><small>{index === 0 ? 'Conservative' : index === 1 ? 'Occupied throughout' : 'Best case'}</small></span></div>
          <div><span>Cashflow / mo</span><b className={scenario.cashflow >= 0 ? 'positive' : 'negative'}>{currency(scenario.cashflow)}</b></div>
          <div><span>Total gain / yr</span><b>{currency(scenario.totalGain * 12)}</b></div>
          <div><span>Per flat / mo</span><b>{currency(count ? scenario.cashflow / count : 0)}</b></div>
        </div>
      ))}
    </div>
  )
}

function EditDrawer({ property, onSave, onClose, onDelete, isNew }) {
  const [draft, setDraft] = useState(property)
  useEffect(() => setDraft(property), [property])
  const update = (key, value, type) => setDraft((current) => ({
    ...current,
    [key]: type === 'number' || type === 'percent' ? Number(value) : value,
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
                        step={type === 'percent' ? '0.001' : type === 'number' ? 'any' : undefined}
                        value={draft[key] ?? ''}
                        onChange={(event) => update(key, event.target.value, type)}
                      />
                      {type === 'percent' && <small>decimal</small>}
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

function App() {
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      return saved || { properties: seedProperties, settings: { ...assumptions, fullyManaged: false, extraction: true } }
    } catch { return { properties: seedProperties, settings: { ...assumptions, fullyManaged: false, extraction: true } } }
  })
  const [editingId, setEditingId] = useState(null)
  const [pendingProperty, setPendingProperty] = useState(null)
  const [section, setSection] = useState('Overview')
  const [search, setSearch] = useState('')
  const portfolio = useMemo(() => calculatePortfolio(state.properties, state.settings), [state])
  const calculated = useMemo(() => state.properties.map((p) => calculateProperty(p, state.settings)), [state])

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state])

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
    const next = { ...seedProperties[1], id: crypto.randomUUID(), name: `BTL${state.properties.length + 1}`, address: '', postcode: '', flatNumber: '', mortgageNumber: '', tenantName: '', tenantEmail: '', tenantPhone: '', active: true }
    setPendingProperty(next)
    setEditingId(null)
  }
  const removeProperty = (id) => {
    setState((current) => ({ ...current, properties: current.properties.filter((p) => p.id !== id) }))
    closeEditor()
  }
  const toggleProperty = (id) => setState((current) => ({ ...current, properties: current.properties.map((p) => p.id === id ? { ...p, active: !p.active } : p) }))
  const updateSetting = (key, value) => setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  const reset = () => { if (window.confirm('Reset every local edit to the seeded Quark sheet data?')) setState({ properties: seedProperties, settings: { ...assumptions, fullyManaged: false, extraction: true } }) }

  const filtered = calculated.filter((p) => `${p.name} ${p.address} ${p.postcode}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><Building2 size={20} /></span><div><strong>QUARK</strong><small>HOLDINGS</small></div></div>
        <nav>
          <small>WORKSPACE</small>
          {[
            ['Overview', Gauge], ['Properties', Home], ['Projections', TrendingUp], ['Compliance', ShieldCheck],
          ].map(([label, Icon]) => <button key={label} className={section === label ? 'active' : ''} onClick={() => setSection(label)}><Icon size={18} />{label}</button>)}
          <small>PORTFOLIO</small>
          {calculated.map((p) => <button key={p.id} className="property-nav" onClick={() => { setSection('Properties'); setSearch(p.name) }}><i>{p.name.replace(/\D/g, '')}</i><span>{p.name}<small>{p.postcode}</small></span></button>)}
        </nav>
        <div className="sidebar-foot"><div className="avatar">QL</div><span><b>Quentin Lachaud</b><small>Portfolio owner</small></span><ChevronDown size={15} /></div>
      </aside>

      <main>
        <header className="topbar">
          <div><button className="mobile-menu"><Menu /></button><span>Quark Holdings</span><b>/</b><strong>{section}</strong></div>
          <div><button className="secondary-button small" onClick={reset}><RotateCcw size={15} /> Reset sheet data</button><button className="primary-button small" onClick={addProperty}><Plus size={16} /> Add BTL</button></div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div><span className="eyebrow">LIVE PORTFOLIO MODEL</span><h1>{section === 'Overview' ? 'Portfolio overview' : section}</h1><p>{portfolio.count} active BTLs · Last calculated just now · GBP</p></div>
            <div className="assumption-pill"><Sparkles size={16} /><span>Appreciation</span><input aria-label="Appreciation rate" type="number" step="0.005" value={state.settings.appreciationRate} onChange={(e) => updateSetting('appreciationRate', Number(e.target.value))} /><b>% decimal</b></div>
          </section>

          {section === 'Overview' && <>
            <section className="metrics-grid">
              <MetricCard eyebrow="PORTFOLIO VALUE" value={currency(portfolio.totalValue)} delta={`${currency(portfolio.totalEquity)} total equity`} icon={Landmark} tone="dark" />
              <MetricCard eyebrow="MONTHLY RENT" value={currency(portfolio.rent)} delta={`${currency(portfolio.rent * 12)} annually`} icon={PoundSterling} tone="green" />
              <MetricCard eyebrow="MONTHLY CASHFLOW" value={currency(portfolio.scenarios[0]?.cashflow)} delta="Conservative scenario" icon={portfolio.scenarios[0]?.cashflow >= 0 ? ArrowUpRight : ArrowDownRight} />
              <MetricCard eyebrow="WEIGHTED RATE" value={percent(portfolio.weightedRate, 2)} delta={`${percent(state.settings.rateShock, 2)} rate shock included`} icon={TrendingUp} />
            </section>

            <section className="main-grid">
              <article className="panel span-2"><header><div><span className="kicker">ASSET POSITION</span><h2>Valuation vs. debt</h2></div><span className="panel-stat">{percent(portfolio.totalLoans / portfolio.totalValue, 1)} portfolio LTV</span></header><BarChart properties={portfolio.selected} /></article>
              <article className="panel buffer-panel"><header><div><span className="kicker">SAFETY BUFFER</span><h2>Cash resilience</h2></div><ShieldCheck size={20} /></header><div className="buffer-ring" style={{ '--value': `${Math.min(100, portfolio.cashHeld / Math.max(1, portfolio.safeCashNeeded) * 100)}%` }}><div><strong>{portfolio.bufferMonths.toFixed(1)}</strong><span>months</span></div></div><div className="buffer-lines"><p><span>Cash held</span><b>{currency(portfolio.cashHeld)}</b></p><p><span>Six-month target</span><b>{currency(portfolio.safeCashNeeded)}</b></p><p className={portfolio.extraCashNeeded ? 'warn' : 'ok'}><span>{portfolio.extraCashNeeded ? 'Additional cash needed' : 'Buffer status'}</span><b>{portfolio.extraCashNeeded ? currency(portfolio.extraCashNeeded) : 'Safe'}</b></p></div></article>
            </section>

            <section className="properties-heading"><div><span className="kicker">THE PORTFOLIO</span><h2>Properties</h2></div><button className="text-button" onClick={() => setSection('Properties')}>View full table <ArrowUpRight size={16} /></button></section>
            <section className="property-cards">{calculated.map((p) => <PropertyCard key={p.id} property={p} onEdit={setEditingId} onClone={cloneProperty} onToggle={toggleProperty} />)}<button className="add-property-card" onClick={addProperty}><span><Plus /></span><b>Add another BTL</b><small>Start blank or clone an existing property</small></button></section>

            <section className="panel scenarios-panel"><header><div><span className="kicker">DYNAMIC PROJECTIONS</span><h2>Cashflow scenarios</h2></div><div className="toggle-row"><label><input type="checkbox" checked={state.settings.extraction} onChange={(e) => updateSetting('extraction', e.target.checked)} />Extraction</label><label><input type="checkbox" checked={state.settings.fullyManaged} onChange={(e) => updateSetting('fullyManaged', e.target.checked)} />Fully managed</label></div></header><ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} /></section>
          </>}

          {section === 'Properties' && <section className="panel data-panel">
            <header><div><span className="kicker">SHEET VIEW</span><h2>All property information</h2></div><div className="table-tools"><label><Search size={16} /><input placeholder="Search BTLs" value={search} onChange={(e) => setSearch(e.target.value)} /></label><button className="secondary-button small" onClick={addProperty}><Plus size={16} /> New BTL</button></div></header>
            <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Metric</th>{filtered.map((p) => <th key={p.id}><button onClick={() => setEditingId(p.id)}>{p.name}<small>{p.postcode}</small></button></th>)}</tr></thead><tbody>{propertyRows.map(([label, getter, kind]) => <tr key={label}><th>{label}</th>{filtered.map((p) => <td className={kind} key={p.id}>{getter(p)}</td>)}</tr>)}</tbody></table></div>
          </section>}

          {section === 'Projections' && <>
            <section className="metrics-grid three"><MetricCard eyebrow="MONTHLY APPRECIATION" value={currency(portfolio.appreciation)} delta={`${currency(portfolio.appreciation * 12)} annually`} icon={TrendingUp} tone="green" /><MetricCard eyebrow="FIXED COSTS" value={currency(portfolio.fixedCosts)} delta={`${currency(portfolio.fixedCosts * 12)} annually`} icon={Landmark} /><MetricCard eyebrow="VARIABLE COSTS" value={currency(portfolio.variableCosts)} delta="Voids, repairs & appliances" icon={Gauge} /></section>
            <section className="panel scenarios-panel"><header><div><span className="kicker">SHEET-MATCHED MODEL</span><h2>Projection scenarios</h2></div></header><ScenarioTable scenarios={portfolio.scenarios} count={portfolio.count} /></section>
            <section className="panel assumptions-panel"><header><div><span className="kicker">MODEL INPUTS</span><h2>Portfolio assumptions</h2></div></header><div className="assumptions-grid">{[['appreciationRate','Annual appreciation','%'],['rateShock','Interest rate shock','%'],['corporationTaxRate','Corporation tax','%'],['managementRate','Management fee','%'],['cashHeld','Cash held','£'],['bufferMonths','Target buffer','months']].map(([key,label,suffix]) => <label key={key}><span>{label}</span><div><input type="number" step="any" value={state.settings[key]} onChange={(e) => updateSetting(key, Number(e.target.value))} /><b>{suffix}</b></div></label>)}</div></section>
          </>}

          {section === 'Compliance' && <section className="panel compliance-panel"><header><div><span className="kicker">RELEVANT DATES</span><h2>Compliance & remortgage diary</h2></div></header><div className="compliance-list">{calculated.flatMap((p) => [['Call broker',p.brokerDate],['Gas certificate',p.gasExpiry],['EICR',p.eicrExpiry],['PAT testing',p.patExpiry],['EPC',p.epcExpiry]].map(([label,date]) => ({ property:p.name,label,date:new Date(date instanceof Date ? date : `${date}T12:00:00`) }))).filter((item) => !Number.isNaN(item.date.getTime())).sort((a,b) => a.date-b.date).map((item, index) => <div key={`${item.property}-${item.label}`}><span className={index < 3 ? 'date-badge urgent' : 'date-badge'}><CalendarClock size={17} /></span><p><b>{item.label}</b><small>{item.property}</small></p><time>{shortDate(item.date)}</time></div>)}</div></section>}
        </div>
      </main>

      {editing && <EditDrawer property={editing} isNew={!state.properties.some((p) => p.id === editing.id)} onSave={saveProperty} onClose={closeEditor} onDelete={removeProperty} />}
    </div>
  )
}

export default App
