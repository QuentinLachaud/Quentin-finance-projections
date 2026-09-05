import React, { useMemo, useState } from 'react'
import { ChevronDown, CircleHelp, Pencil, Plus, ReceiptText, Trash2, TrendingUp, X } from 'lucide-react'
import {
  PERFORMANCE_EVENT_TYPES,
  buildPerformanceModel,
  createPerformanceEvent,
  normalizePerformanceEvent,
  signedPerformanceAmount,
} from './performance.js'

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
const gbpPrecise = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', style: 'currency', currency: 'GBP', maximumFractionDigits: 1 })
const clean = (value) => String(value ?? '').trim()
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const currency = (value) => gbp.format(finite(value))
const money = (value) => gbpPrecise.format(finite(value))
const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)}%` : '—'
const ratio = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}×` : '—'
const formatDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(value))) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}
const sourceLabel = (event) => ({
  expense: 'Documents & Expenses', timeline: 'Property timeline', property: 'Property record', 'current-state': 'Current property data',
  'manual-performance': 'Performance adjustment', 'derived-capital-basis': 'Estimated basis',
}[event?.sourceType] || 'Portfolio data')

const seriesMeta = {
  return: [
    { key: 'wealth', label: 'Wealth created', className: 'primary' },
    { key: 'equity', label: 'Equity', className: 'secondary' },
  ],
  value: [
    { key: 'assetValue', label: 'Property value', className: 'primary' },
    { key: 'debt', label: 'Mortgage debt', className: 'secondary' },
  ],
}

const linePath = (points, key, xScale, yScale) => points
  .filter((point) => Number.isFinite(Number(point[key])))
  .map((point, index) => `${index ? 'L' : 'M'} ${xScale(point.date).toFixed(2)} ${yScale(point[key]).toFixed(2)}`)
  .join(' ')

function PerformanceLineChart({ model, mode, onSelectEvent }) {
  const actual = model.actualPoints || []
  const projection = model.projectionPoints || []
  const start = actual[0]?.date || model.today
  const end = projection.at(-1)?.date || model.today
  const startMs = Date.parse(`${start}T12:00:00Z`)
  const endMs = Date.parse(`${end}T12:00:00Z`)
  const width = 900
  const height = 330
  const pad = { left: 78, right: 26, top: 24, bottom: 58 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom
  const meta = seriesMeta[mode] || seriesMeta.return
  const values = [...actual, ...projection].flatMap((point) => meta.map((series) => finite(point[series.key])))
  const minRaw = Math.min(0, ...values)
  const maxRaw = Math.max(1, ...values)
  const span = Math.max(1, maxRaw - minRaw)
  const min = minRaw - span * 0.08
  const max = maxRaw + span * 0.08
  const xScale = (date) => {
    const value = Date.parse(`${date}T12:00:00Z`)
    return pad.left + (endMs === startMs ? 0 : (value - startMs) / (endMs - startMs)) * chartW
  }
  const yScale = (value) => pad.top + (1 - (finite(value) - min) / (max - min)) * chartH
  const yTicks = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4).reverse()
  const todayX = xScale(model.today)
  const markerEvents = model.events.filter((event) => !['current_snapshot', 'initial_capital'].includes(event.type)).slice(0, 48)
  const actualEnd = actual.at(-1)

  return <div className="performance-chart-wrap">
    <svg className="performance-chart" role="img" aria-label={`${meta.map((item) => item.label).join(' and ')} from purchase through the selected projection horizon`} viewBox={`0 0 ${width} ${height}`}>
      {yTicks.map((tick) => <g key={tick} className="performance-grid-line"><line x1={pad.left} x2={width - pad.right} y1={yScale(tick)} y2={yScale(tick)} /><text x={pad.left - 10} y={yScale(tick) + 4} textAnchor="end">{compact.format(tick)}</text></g>)}
      <line className="performance-zero-line" x1={pad.left} x2={width - pad.right} y1={yScale(0)} y2={yScale(0)} />
      <rect className="performance-projection-zone" x={todayX} y={pad.top} width={Math.max(0, width - pad.right - todayX)} height={chartH} />
      <line className="performance-today-line" x1={todayX} x2={todayX} y1={pad.top} y2={pad.top + chartH} />
      <text className="performance-today-label" x={todayX + 7} y={pad.top + 14}>TODAY</text>
      {meta.map((series) => <React.Fragment key={series.key}>
        <path className={`performance-series ${series.className}`} d={linePath(actual, series.key, xScale, yScale)} />
        {projection.length > 0 && actualEnd && <path className={`performance-series ${series.className} projected`} d={linePath([actualEnd, ...projection], series.key, xScale, yScale)} />}
      </React.Fragment>)}
      {markerEvents.map((event, index) => {
        const x = xScale(event.occurredAt)
        if (x < pad.left || x > width - pad.right) return null
        const y = pad.top + chartH - 8 - (index % 2) * 10
        return <g
          key={event.id}
          className={`performance-event-mark ${event.amount > 0 ? 'income' : event.amount < 0 ? 'cost' : 'change'}`}
          role="button"
          tabIndex="0"
          aria-label={`${formatDate(event.occurredAt)} ${event.title}${event.amount ? ` ${money(event.amount)}` : ''}`}
          onClick={() => onSelectEvent(event)}
          onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') onSelectEvent(event) }}
        ><circle cx={x} cy={y} r="4.5" /><title>{event.title}</title></g>
      })}
      <text className="performance-axis-date" x={pad.left} y={height - 15}>{formatDate(start)}</text>
      <text className="performance-axis-date" x={todayX} y={height - 15} textAnchor="middle">Actual</text>
      <text className="performance-axis-date" x={width - pad.right} y={height - 15} textAnchor="end">{formatDate(end)} · Projection</text>
    </svg>
    <div className="performance-chart-legend" aria-hidden="true">
      {meta.map((series) => <span key={series.key} className={series.className}><i />{series.label}</span>)}
      <span className="projected"><i />Projection</span>
    </div>
  </div>
}

function PerformanceCashChart({ model }) {
  const buckets = model.cashBuckets || []
  const width = 900
  const height = 300
  const pad = { left: 78, right: 26, top: 24, bottom: 56 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom
  const maxAbs = Math.max(1, ...buckets.map((bucket) => Math.abs(finite(bucket.amount))))
  const y = (value) => pad.top + chartH / 2 - finite(value) / maxAbs * (chartH / 2 - 8)
  const zero = pad.top + chartH / 2
  const slot = buckets.length ? chartW / buckets.length : chartW
  const barWidth = Math.max(8, Math.min(44, slot * 0.56))
  return <div className="performance-chart-wrap">
    <svg className="performance-chart cash" role="img" aria-label="Actual and projected net cash flow by year" viewBox={`0 0 ${width} ${height}`}>
      <line className="performance-zero-line" x1={pad.left} x2={width - pad.right} y1={zero} y2={zero} />
      <text className="performance-grid-label" x={pad.left - 10} y={pad.top + 4} textAnchor="end">{compact.format(maxAbs)}</text>
      <text className="performance-grid-label" x={pad.left - 10} y={height - pad.bottom + 4} textAnchor="end">{compact.format(-maxAbs)}</text>
      {buckets.map((bucket, index) => {
        const x = pad.left + slot * index + slot / 2 - barWidth / 2
        const top = Math.min(zero, y(bucket.amount))
        const h = Math.max(1, Math.abs(zero - y(bucket.amount)))
        return <g key={`${bucket.label}-${bucket.actual}-${index}`} className={`performance-cash-bar ${bucket.actual ? 'actual' : 'projected'}`}>
          <rect x={x} y={top} width={barWidth} height={h} rx="3" />
          <text x={x + barWidth / 2} y={height - 24} textAnchor="middle">{bucket.label}</text>
          <title>{`${bucket.actual ? 'Actual' : 'Projected'} ${bucket.label}: ${money(bucket.amount)}`}</title>
        </g>
      })}
    </svg>
    <div className="performance-chart-legend"><span className="primary"><i />Actual cash</span><span className="projected"><i />Projected cash</span></div>
  </div>
}

function Metric({ label, value, note, strong = false }) {
  return <div className={`performance-metric ${strong ? 'strong' : ''}`}><span>{label}</span><b>{value}</b>{note && <small>{note}</small>}</div>
}

function PerformanceEventEditor({ draft, properties, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...draft, amount: draft.type === 'other' ? draft.amount : Math.abs(finite(draft.amount)) }))
  const meta = PERFORMANCE_EVENT_TYPES.find((item) => item.value === form.type) || PERFORMANCE_EVENT_TYPES[0]
  const submit = (event) => {
    event.preventDefault()
    const normalized = normalizePerformanceEvent({ ...form, amount: signedPerformanceAmount(form.type, form.amount) })
    if (normalized && normalized.propertyId) onSave(normalized)
  }
  return <div className="performance-editor-layer" onMouseDown={onClose}>
    <form className="performance-editor" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="kicker">RETURN LEDGER</span><h2>{draft._editing ? 'Edit financial event' : 'Add financial event'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
      <div className="performance-editor-body">
        <label><span>Property</span><select required value={form.propertyId} onChange={(event) => setForm((current) => ({ ...current, propertyId: event.target.value }))}><option value="">Choose property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label><span>Date</span><input required type="date" value={form.occurredAt} onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))} /></label>
        <label className="performance-editor-wide"><span>Type</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value, amount: Math.abs(finite(current.amount)) }))}>{PERFORMANCE_EVENT_TYPES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><small>{meta.note}</small></label>
        <label><span>Amount</span><div className="performance-money-input"><i>£</i><input required type="number" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div></label>
        <label><span>Label <small>optional</small></span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={meta.label} /></label>
        <label className="performance-editor-wide"><span>Notes <small>optional</small></span><textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      </div>
      <footer><span /><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Save event</button></footer>
    </form>
  </div>
}

export default function PerformanceWorkspace({
  properties = [],
  loans = [],
  expenses = [],
  timelineEvents = [],
  performanceEvents = [],
  settings = {},
  onEventsChange,
  onAssumptionChange,
  onOpenExpenses,
}) {
  const [scope, setScope] = useState('portfolio')
  const [horizonYears, setHorizonYears] = useState(10)
  const [mode, setMode] = useState('return')
  const [eventFilter, setEventFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editorDraft, setEditorDraft] = useState(null)
  const model = useMemo(() => buildPerformanceModel({ properties, loans, expenses, timelineEvents, performanceEvents, settings, scope, horizonYears }), [properties, loans, expenses, timelineEvents, performanceEvents, settings, scope, horizonYears])
  const selectedProperty = properties.find((property) => property.id === scope) || null
  const visibleEvents = model.events.filter((event) => eventFilter === 'all'
    || (eventFilter === 'income' && event.amount > 0)
    || (eventFilter === 'cost' && event.amount < 0)
    || (eventFilter === 'finance' && ['finance', 'capital'].includes(event.category))
    || (eventFilter === 'value' && event.category === 'value'))
  const maxBreakdown = Math.max(1, ...model.breakdown.map((item) => Math.abs(item.amount)))
  const startNewEvent = () => {
    const propertyId = selectedProperty?.id || properties[0]?.id || ''
    setEditorDraft(createPerformanceEvent(propertyId))
  }
  const editEvent = (event) => setEditorDraft({ ...event, _editing: true })
  const saveEvent = (event) => {
    const existing = performanceEvents || []
    const withoutReplacedBasis = event.type === 'initial_capital'
      ? existing.filter((item) => item.id === event.id || !(item.propertyId === event.propertyId && item.type === 'initial_capital'))
      : existing
    const next = withoutReplacedBasis.some((item) => item.id === event.id)
      ? withoutReplacedBasis.map((item) => item.id === event.id ? event : item)
      : [...withoutReplacedBasis, event]
    onEventsChange?.(next)
    setEditorDraft(null)
  }
  const removeEvent = (event) => {
    if (!window.confirm(`Delete “${event.title || 'financial event'}”? This removes the manual return adjustment only.`)) return
    onEventsChange?.((performanceEvents || []).filter((item) => item.id !== event.id))
    if (selectedEvent?.id === event.id) setSelectedEvent(null)
  }
  const setPercentAssumption = (key, value) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) onAssumptionChange?.(key, parsed / 100)
  }

  return <div className="performance-workspace">
    <section className="panel performance-summary">
      <header className="performance-summary-toolbar">
        <label><span>Scope</span><select value={scope} onChange={(event) => { setScope(event.target.value); setSelectedEvent(null) }}><option value="portfolio">Portfolio</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <div className="performance-data-actions"><button type="button" className="secondary-button small" onClick={onOpenExpenses}><ReceiptText size={15} /> Actual income / costs</button><button type="button" className="primary-button small" disabled={!properties.length} onClick={startNewEvent}><Plus size={15} /> Financial event</button></div>
      </header>
      {properties.length ? <>
        <div className="performance-headline">
          <div>
            <span>ANNUALISED INVESTOR RETURN</span>
            <strong>{pct(model.metrics.annualisedReturn, 1)}</strong>
            <small>{model.metrics.since ? `Since ${formatDate(model.metrics.since)}` : 'Purchase date needed'} · XIRR of dated cash flows + current equity</small>
          </div>
          <span className={`performance-basis-badge ${model.metrics.capitalBasis}`}>{model.metrics.capitalBasis === 'recorded' ? 'Recorded cash basis' : 'Estimated cash basis'}</span>
        </div>
        <div className="performance-metric-grid">
          <Metric strong label="Wealth created" value={currency(model.metrics.wealthCreated)} note="Equity + all dated investment cash flows" />
          <Metric label="Current equity" value={currency(model.metrics.currentEquity)} note={`${currency(model.metrics.currentValue)} value − ${currency(model.metrics.currentDebt)} debt`} />
          <Metric label="Cash returned" value={currency(model.metrics.cashReturned)} note={`${model.metrics.actualCashEntries} dated ledger ${model.metrics.actualCashEntries === 1 ? 'entry' : 'entries'}`} />
          <Metric label="MOIC" value={ratio(model.metrics.moic)} note={`ROI ${pct(model.metrics.roi, 1)}`} />
        </div>
        {(model.metrics.valuationCagr != null || model.metrics.rentalCagr != null) && <div className="performance-secondary-metrics">
          {model.metrics.valuationCagr != null && <span><small>Property value CAGR</small><b>{pct(model.metrics.valuationCagr, 1)}</b></span>}
          {model.metrics.rentalCagr != null && <span><small>Recorded rent CAGR</small><b>{pct(model.metrics.rentalCagr, 1)}</b></span>}
        </div>}
        <details className="performance-method"><summary><CircleHelp size={14} /> How this return is calculated <ChevronDown size={15} /></summary><div><p><b>Annualised return</b> is XIRR across dated investment cash flows, with current net property equity treated as today’s terminal value. Historical rent and costs are included only when they exist as dated entries; model assumptions are never backfilled as fake history.</p><p><b>Wealth created</b> is current equity plus the signed cash ledger, including the initial cash basis. Refinancing cash must be recorded when cash was actually released.</p></div></details>
      </> : <div className="performance-empty"><TrendingUp size={25} /><b>Add a property to measure performance</b><span>Performance starts from purchase, financing and dated cash-flow data already held in the portfolio.</span></div>}
    </section>

    {properties.length > 0 && <>
      {model.warnings.length > 0 && <section className="performance-data-quality" aria-label="Performance data quality"><b>Return data</b><div>{model.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></section>}

      <section className="panel performance-journey">
        <header className="performance-journey-header"><div><span className="kicker">INVESTMENT JOURNEY</span><h2>Actual return and forward path</h2></div><div className="performance-chart-controls"><div className="performance-mode-switch" role="group" aria-label="Performance chart"><button className={mode === 'return' ? 'active' : ''} aria-pressed={mode === 'return'} onClick={() => setMode('return')}>Return</button><button className={mode === 'cash' ? 'active' : ''} aria-pressed={mode === 'cash'} onClick={() => setMode('cash')}>Cash flow</button><button className={mode === 'value' ? 'active' : ''} aria-pressed={mode === 'value'} onClick={() => setMode('value')}>Value & debt</button></div><div className="performance-horizon-switch" role="group" aria-label="Projection horizon">{[5, 10, 15].map((years) => <button key={years} className={horizonYears === years ? 'active' : ''} aria-pressed={horizonYears === years} onClick={() => setHorizonYears(years)}>{years}Y</button>)}</div></div></header>
        {mode === 'cash' ? <PerformanceCashChart model={model} /> : <PerformanceLineChart model={model} mode={mode} onSelectEvent={setSelectedEvent} />}
        {selectedEvent && <div className="performance-selected-event"><div><span>{formatDate(selectedEvent.occurredAt)} · {sourceLabel(selectedEvent)}</span><b>{selectedEvent.title}</b>{selectedEvent.details && <p>{selectedEvent.details}</p>}</div>{selectedEvent.amount !== 0 && <strong className={selectedEvent.amount >= 0 ? 'positive' : 'negative'}>{money(selectedEvent.amount)}</strong>}<button type="button" className="icon-button" onClick={() => setSelectedEvent(null)} aria-label="Clear selected event"><X size={15} /></button></div>}
      </section>

      <div className="performance-analysis-grid">
        <section className="panel performance-breakdown"><header><div><span className="kicker">RETURN BREAKDOWN</span><h2>Where the return came from</h2></div></header><div className="performance-breakdown-list">{model.breakdown.map((item) => <div key={item.key}><span>{item.label}</span><i><em style={{ width: `${Math.max(2, Math.abs(item.amount) / maxBreakdown * 100)}%` }} className={item.amount >= 0 ? 'positive' : 'negative'} /></i><b className={item.amount >= 0 ? 'positive' : 'negative'}>{item.amount >= 0 ? '+' : ''}{currency(item.amount)}</b></div>)}</div><footer><span>Wealth created</span><b>{currency(model.metrics.wealthCreated)}</b></footer></section>

        <section className="panel performance-forecast-summary"><header><div><span className="kicker">{horizonYears}-YEAR BASE PROJECTION</span><h2>Where this path leads</h2></div></header><dl><div><dt>Property value</dt><dd>{currency(model.projection.propertyValue)}</dd></div><div><dt>Mortgage debt</dt><dd>{currency(model.projection.debt)}</dd></div><div><dt>Equity</dt><dd>{currency(model.projection.equity)}</dd></div><div><dt>Annual rent</dt><dd>{currency(model.projection.annualRent)}</dd></div><div><dt>Annual net cash flow</dt><dd>{currency(model.projection.annualNetCashflow)}</dd></div><div className="highlight"><dt>Projected annualised return</dt><dd>{pct(model.projection.annualisedReturn, 1)}</dd></div></dl><footer><span>Projected wealth created</span><b>{currency(model.projection.wealthCreated)}</b></footer></section>
      </div>

      <details className="panel performance-assumptions"><summary><span><b>Projection assumptions</b><small>Same portfolio model inputs; historical return is unaffected</small></span><ChevronDown size={17} /></summary><div className="performance-assumption-grid"><label><span>Property appreciation</span><div><input type="number" step="0.1" value={(finite(settings.appreciationRate) * 100).toFixed(1)} onChange={(event) => setPercentAssumption('appreciationRate', event.target.value)} /><i>%</i></div></label><label><span>Rent growth</span><div><input type="number" step="0.1" value={(finite(settings.rentGrowthRate) * 100).toFixed(1)} onChange={(event) => setPercentAssumption('rentGrowthRate', event.target.value)} /><i>%</i></div></label><label><span>Interest-rate shock</span><div><input type="number" step="0.1" value={(finite(settings.rateShock) * 100).toFixed(1)} onChange={(event) => setPercentAssumption('rateShock', event.target.value)} /><i>%</i></div></label><div className="performance-fixed-assumption"><span>Other operating costs</span><b>Current model values</b><small>Held at the current entered amounts rather than inventing a new inflation assumption.</small></div></div></details>

      <section className="panel performance-history"><header><div><span className="kicker">FINANCIAL HISTORY</span><h2>Every return-relevant event</h2></div><div className="performance-history-filters" role="group" aria-label="Financial history filter">{[['all', 'All'], ['income', 'Income'], ['cost', 'Costs'], ['finance', 'Financing'], ['value', 'Value']].map(([key, label]) => <button key={key} className={eventFilter === key ? 'active' : ''} aria-pressed={eventFilter === key} onClick={() => setEventFilter(key)}>{label}</button>)}</div></header><div className="performance-table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Property</th><th>Cash</th><th>Running cash</th><th>Source</th><th aria-label="Actions" /></tr></thead><tbody>{visibleEvents.map((event) => {
        const propertyName = properties.find((property) => property.id === event.propertyId)?.name || (event.propertyId ? 'Property' : 'Portfolio')
        const manual = event.sourceType === 'manual-performance'
        return <tr key={event.id} onClick={() => setSelectedEvent(event)}><td><time>{formatDate(event.occurredAt)}</time></td><td><b>{event.title}</b>{event.details && <small>{event.details}</small>}{event.estimated && <em>Estimated</em>}</td><td>{propertyName}</td><td className={event.amount > 0 ? 'positive' : event.amount < 0 ? 'negative' : ''}>{event.amount ? money(event.amount) : '—'}</td><td>{money(event.runningCash)}</td><td>{sourceLabel(event)}</td><td>{manual && <span className="performance-row-actions"><button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); editEvent(event) }} aria-label={`Edit ${event.title}`}><Pencil size={14} /></button><button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); removeEvent(event) }} aria-label={`Delete ${event.title}`}><Trash2 size={14} /></button></span>}</td></tr>
      })}{visibleEvents.length === 0 && <tr><td colSpan="7" className="performance-table-empty">No matching financial events.</td></tr>}</tbody></table></div></section>
    </>}

    {editorDraft && <PerformanceEventEditor draft={editorDraft} properties={properties} onSave={saveEvent} onClose={() => setEditorDraft(null)} />}
  </div>
}
