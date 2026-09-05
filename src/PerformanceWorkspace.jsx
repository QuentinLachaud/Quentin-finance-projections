import React, { useMemo, useState } from 'react'
import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'
import { useBankPerformanceData } from './useBankPerformanceData.js'
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
  'manual-performance': 'Performance adjustment', 'derived-capital-basis': 'Estimated basis', bank: 'Banking',
}[event?.sourceType] || 'Portfolio data')

const chartViews = {
  position: {
    label: 'Value & debt',
    description: 'Recorded property value, equity and mortgage debt.',
    series: [
      { key: 'equity', label: 'Equity', className: 'primary' },
      { key: 'assetValue', label: 'Property value', className: 'secondary' },
      { key: 'debt', label: 'Mortgage debt', className: 'tertiary' },
    ],
  },
  rent: {
    label: 'Rent',
    description: 'Recorded total monthly rent, then the shared rent-growth forecast.',
    series: [{ key: 'monthlyRent', label: 'Monthly rent', className: 'primary' }],
  },
  cash: {
    label: 'Cash',
    description: 'Cumulative recorded net income and costs, extended using the current operating model.',
    series: [
      { key: 'cumulativeNetIncome', label: 'Net income', className: 'primary' },
      { key: 'cumulativeCosts', label: 'Costs', className: 'negative-series' },
    ],
  },
  return: {
    label: 'Return',
    description: 'Cumulative wealth created and gain from property appreciation.',
    series: [
      { key: 'wealth', label: 'Wealth created', className: 'primary' },
      { key: 'cumulativeAppreciation', label: 'Appreciation gain', className: 'secondary' },
    ],
  },
}

const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const utcMs = (date) => Date.parse(`${date}T12:00:00Z`)
const monthLabel = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(value))) return ''
  return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}
const shortYear = (value) => clean(value).slice(2, 4)
const addMonths = (value, months) => {
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, end))
  return date.toISOString().slice(0, 10)
}
const monthDistance = (start, end) => {
  const a = new Date(`${start}T12:00:00Z`)
  const b = new Date(`${end}T12:00:00Z`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth())
}
const xAxisTicks = (start, end) => {
  const months = monthDistance(start, end)
  const step = months <= 24 ? 2 : months <= 60 ? 6 : months <= 180 ? 12 : 24
  const ticks = []
  for (let month = 0; month <= months; month += step) ticks.push(addMonths(start, month))
  if (ticks.at(-1) !== end && monthDistance(ticks.at(-1) || start, end) > Math.max(1, step / 2)) ticks.push(end)
  return [...new Set(ticks)]
}
const niceStep = (span, target = 4) => {
  const rough = Math.max(1e-9, Math.abs(span) / target)
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return niceFraction * power
}
const niceCurrencyTicks = (values) => {
  const finiteValues = values.filter(hasNumber).map(Number)
  if (!finiteValues.length) return { min: 0, max: 1, ticks: [0, 1] }
  const rawMin = Math.min(...finiteValues)
  const rawMax = Math.max(...finiteValues)
  const includeZero = rawMin >= 0 || rawMax <= 0
  const minSeed = includeZero && rawMin >= 0 ? 0 : rawMin
  const maxSeed = includeZero && rawMax <= 0 ? 0 : rawMax
  const step = niceStep(Math.max(1, maxSeed - minSeed), 4)
  const min = Math.floor(minSeed / step) * step
  const max = Math.max(min + step, Math.ceil(maxSeed / step) * step)
  const ticks = []
  for (let value = min; value <= max + step * 0.25; value += step) ticks.push(Math.abs(value) < step / 1000 ? 0 : value)
  return { min, max, ticks: ticks.reverse() }
}
const axisMoney = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  const sign = amount < 0 ? '−' : ''
  const absolute = Math.abs(amount)
  if (absolute >= 1_000_000) {
    const scaled = absolute / 1_000_000
    return `${sign}£${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}m`
  }
  if (absolute >= 1_000) {
    const scaled = absolute / 1_000
    return `${sign}£${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}k`
  }
  return `${sign}£${Math.round(absolute).toLocaleString('en-GB')}`
}
const linePath = (points, key, xScale, yScale, step = false) => {
  const valid = points.filter((point) => hasNumber(point[key]))
  if (!valid.length) return ''
  return valid.map((point, index) => {
    const x = xScale(point.date).toFixed(2)
    const y = yScale(point[key]).toFixed(2)
    if (!index) return `M ${x} ${y}`
    if (!step) return `L ${x} ${y}`
    const previous = valid[index - 1]
    return `L ${x} ${yScale(previous[key]).toFixed(2)} L ${x} ${y}`
  }).join(' ')
}
const eventKind = (event) => event.type === 'rent_change' ? 'Rent change'
  : event.category === 'value' ? 'Valuation'
    : event.category === 'finance' ? 'Financing'
      : event.amount > 0 ? 'Income'
        : event.amount < 0 ? 'Cost'
          : 'Change'

function groupChartEvents(events, xScale, left, right) {
  const byMonth = new Map()
  for (const event of events.filter((item) => !['current_snapshot', 'initial_capital'].includes(item.type))) {
    const month = clean(event.occurredAt).slice(0, 7)
    if (!month) continue
    const group = byMonth.get(month) || { id: month, events: [], date: event.occurredAt }
    group.events.push(event)
    if (event.occurredAt < group.date) group.date = event.occurredAt
    byMonth.set(month, group)
  }
  const monthly = [...byMonth.values()]
    .map((group) => ({ ...group, x: xScale(group.date) }))
    .filter((group) => group.x >= left && group.x <= right)
    .sort((a, b) => a.x - b.x)
  const clusters = []
  for (const group of monthly) {
    const previous = clusters.at(-1)
    if (previous && group.x - previous.x < 16) {
      previous.events.push(...group.events)
      previous.x = (previous.x + group.x) / 2
      previous.id = `${previous.id}:${group.id}`
    } else clusters.push({ ...group, events: [...group.events] })
  }
  return clusters
}

function EventPopover({ group, width, onClose }) {
  if (!group) return null
  const edgeClass = group.x < 220 ? 'edge-left' : group.x > width - 220 ? 'edge-right' : ''
  return <div className={`performance-event-popover ${edgeClass}`} style={{ '--event-x': `${(group.x / width) * 100}%` }}>
    <header><div><b>{group.events.length === 1 ? eventKind(group.events[0]) : `${group.events.length} events`}</b><span>{group.events.length === 1 ? formatDate(group.events[0].occurredAt) : `${monthLabel(group.events[0].occurredAt)} ${group.events[0].occurredAt.slice(0, 4)}`}</span></div>{onClose && <button type="button" onClick={onClose} aria-label="Close event details"><X size={14} /></button>}</header>
    <div>{group.events.slice(0, 5).map((event) => <div className="performance-event-popover-row" key={event.id}><span><b>{event.title}</b><small>{eventKind(event)} · {formatDate(event.occurredAt)} · {sourceLabel(event)}</small></span><strong className={event.amount > 0 ? 'positive' : event.amount < 0 ? 'negative' : ''}>{event.amount ? money(event.amount) : event.details || 'Change'}</strong></div>)}</div>
    {group.events.length > 5 && <footer>+{group.events.length - 5} more events in this cluster</footer>}
  </div>
}

function PerformanceChart({ model, view, visibleSeries, showForecast, showEvents }) {
  const [hoveredGroup, setHoveredGroup] = useState(null)
  const [pinnedGroup, setPinnedGroup] = useState(null)
  const actual = model.actualPoints || []
  const projection = showForecast ? (model.projectionPoints || []) : []
  const definition = chartViews[view] || chartViews.position
  const meta = definition.series.filter((series) => visibleSeries.includes(series.key))
  const start = actual[0]?.date || model.today
  const end = projection.at(-1)?.date || model.today
  const startMs = utcMs(start)
  const endMs = utcMs(end)
  const width = 920
  const height = 350
  const pad = { left: 76, right: 24, top: 26, bottom: 60 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom
  const xScale = (date) => pad.left + (endMs === startMs ? 0 : (utcMs(date) - startMs) / (endMs - startMs)) * chartW
  const values = [...actual, ...projection].flatMap((point) => meta.map((series) => point[series.key])).filter(hasNumber)
  const axis = niceCurrencyTicks(values)
  const yScale = (value) => pad.top + (1 - (Number(value) - axis.min) / Math.max(1, axis.max - axis.min)) * chartH
  const todayX = xScale(model.today)
  const xTicks = xAxisTicks(start, end)
  const actualEnd = actual.at(-1)
  const eventGroups = showEvents ? groupChartEvents(model.events || [], xScale, pad.left, width - pad.right) : []
  const activePopover = pinnedGroup || hoveredGroup

  return <div className="performance-chart-shell">
    <div className="performance-chart-wrap">
      <svg className="performance-chart" role="img" aria-label={`${meta.map((item) => item.label).join(' and ')} over time with actual history and ${showForecast ? 'forecast' : 'forecast hidden'}`} viewBox={`0 0 ${width} ${height}`}>
        {axis.ticks.map((tick) => <g key={tick} className="performance-grid-line"><line x1={pad.left} x2={width - pad.right} y1={yScale(tick)} y2={yScale(tick)} /><text x={pad.left - 12} y={yScale(tick) + 4} textAnchor="end">{axisMoney(tick)}</text></g>)}
        {axis.min < 0 && axis.max > 0 && <line className="performance-zero-line" x1={pad.left} x2={width - pad.right} y1={yScale(0)} y2={yScale(0)} />}
        {showForecast && <rect className="performance-projection-zone" x={todayX} y={pad.top} width={Math.max(0, width - pad.right - todayX)} height={chartH} />}
        <line className="performance-today-line" x1={todayX} x2={todayX} y1={pad.top} y2={pad.top + chartH} />
        <text className="performance-today-label" x={todayX + 7} y={pad.top + 14}>TODAY</text>
        {meta.map((series) => <React.Fragment key={series.key}>
          <path className={`performance-series ${series.className}`} d={linePath(actual, series.key, xScale, yScale, true)} />
          {showForecast && projection.length > 0 && actualEnd && hasNumber(actualEnd[series.key]) && <path className={`performance-series ${series.className} projected`} d={linePath([actualEnd, ...projection], series.key, xScale, yScale)} />}
        </React.Fragment>)}
        {eventGroups.map((group) => <g key={group.id} className="performance-event-mark" role="button" tabIndex="0" aria-label={`${group.events.length} performance ${group.events.length === 1 ? 'event' : 'events'} in ${monthLabel(group.date)} ${group.date.slice(0, 4)}`} onMouseEnter={() => setHoveredGroup(group)} onMouseLeave={() => setHoveredGroup(null)} onFocus={() => setHoveredGroup(group)} onBlur={() => setHoveredGroup(null)} onClick={() => setPinnedGroup((current) => current?.id === group.id ? null : group)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPinnedGroup((current) => current?.id === group.id ? null : group) } }}>
          <line x1={group.x} x2={group.x} y1={pad.top + chartH - 13} y2={pad.top + chartH} />
          <circle cx={group.x} cy={pad.top + chartH - 14} r="4" />
          {group.events.length > 1 && <text x={group.x} y={pad.top + chartH - 24} textAnchor="middle">{group.events.length}</text>}
        </g>)}
        {xTicks.map((tick, index) => <g className="performance-x-tick" key={`${tick}-${index}`}><line x1={xScale(tick)} x2={xScale(tick)} y1={pad.top + chartH} y2={pad.top + chartH + 5} /><text x={xScale(tick)} y={height - 28} textAnchor="middle">{monthLabel(tick)}</text><text x={xScale(tick)} y={height - 14} textAnchor="middle">'{shortYear(tick)}</text></g>)}
      </svg>
      <EventPopover group={activePopover} width={width} onClose={pinnedGroup ? () => setPinnedGroup(null) : null} />
    </div>
    <div className="performance-chart-foot"><span><i className="actual-line" />Recorded history</span>{showForecast && <span><i className="forecast-line" />Forecast</span>}{showEvents && <span><i className="event-line" />Events · hover or tap</span>}</div>
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
  user,
  properties = [],
  loans = [],
  expenses = [],
  timelineEvents = [],
  performanceEvents = [],
  settings = {},
  onEventsChange,
  onTimelineEventDelete,
  onAssumptionChange,
  onOpenExpenses,
}) {
  const [scope, setScope] = useState('portfolio')
  const [horizonYears, setHorizonYears] = useState(10)
  const [view, setView] = useState('position')
  const [seriesByView, setSeriesByView] = useState({ position: ['equity'], rent: ['monthlyRent'], cash: ['cumulativeNetIncome', 'cumulativeCosts'], return: ['wealth', 'cumulativeAppreciation'] })
  const [showForecast, setShowForecast] = useState(true)
  const [showEvents, setShowEvents] = useState(true)
  const [eventFilter, setEventFilter] = useState('all')
  const [editorDraft, setEditorDraft] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const bankData = useBankPerformanceData(user?.id)
  const model = useMemo(() => buildPerformanceModel({ properties, loans, expenses, timelineEvents, performanceEvents, bankTransactions: bankData.transactions, bankAccounts: bankData.accounts, settings, scope, horizonYears }), [properties, loans, expenses, timelineEvents, performanceEvents, bankData.transactions, bankData.accounts, settings, scope, horizonYears])
  const selectedProperty = properties.find((property) => property.id === scope) || null
  const visibleEvents = model.events.filter((event) => eventFilter === 'all'
    || (eventFilter === 'income' && event.amount > 0)
    || (eventFilter === 'cost' && event.amount < 0)
    || (eventFilter === 'finance' && ['finance', 'capital'].includes(event.category))
    || (eventFilter === 'value' && event.category === 'value'))
  const maxBreakdown = Math.max(1, ...model.breakdown.map((item) => Math.abs(item.amount)))
  const visibleSeries = seriesByView[view] || [chartViews[view]?.series?.[0]?.key].filter(Boolean)
  const viewDefinition = chartViews[view] || chartViews.position
  const primarySeries = viewDefinition.series.find((series) => visibleSeries.includes(series.key)) || viewDefinition.series[0]
  const todayPoint = model.actualPoints?.at(-1) || null
  const forecastPoint = model.projectionPoints?.at(-1) || null
  const toggleSeries = (key) => setSeriesByView((current) => {
    const active = current[view] || []
    if (active.includes(key) && active.length === 1) return current
    return { ...current, [view]: active.includes(key) ? active.filter((item) => item !== key) : [...active, key] }
  })
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
  const requestDeleteEvent = (event) => setDeleteTarget(event)
  const confirmDeleteEvent = () => {
    const event = deleteTarget
    setDeleteTarget(null)
    if (!event) return
    if (event.sourceType === 'manual-performance') onEventsChange?.((performanceEvents || []).filter((item) => item.id !== event.id))
    else if (event.sourceType === 'timeline') onTimelineEventDelete?.(event.sourceId)
  }
  const setPercentAssumption = (key, value) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) onAssumptionChange?.(key, parsed / 100)
  }

  return <div className="performance-workspace">
    <section className="panel performance-summary">
      <header className="performance-summary-toolbar">
        <label><span>Scope</span><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="portfolio">Portfolio</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <div className="performance-data-actions"><button type="button" className="secondary-button small" onClick={onOpenExpenses}><ReceiptText size={15} /> Actual income / costs</button><button type="button" className="primary-button small" disabled={!properties.length} onClick={startNewEvent}><Plus size={15} /> Financial event</button></div>
      </header>
      {properties.length ? <>
        <div className="performance-summary-title"><div><span className="kicker">PERFORMANCE</span><h2>Investment snapshot</h2><p>Actual return from recorded cash flows and today’s equity.</p></div><span className={`performance-basis-badge ${model.metrics.capitalBasis}`}>{model.metrics.capitalBasis === 'recorded' ? 'Recorded cash basis' : 'Estimated cash basis'}</span></div>
        <div className="performance-metric-grid">
          <Metric strong label="Annualised return" value={pct(model.metrics.annualisedReturn, 1)} note={model.metrics.since ? `XIRR since ${formatDate(model.metrics.since)}` : 'Purchase date needed'} />
          <Metric label="Wealth created" value={currency(model.metrics.wealthCreated)} note="Equity + investment cash flows" />
          <Metric label="Current equity" value={currency(model.metrics.currentEquity)} note={`${currency(model.metrics.currentValue)} value − ${currency(model.metrics.currentDebt)} debt`} />
          <Metric label="Recorded net income" value={currency(model.metrics.operatingNetIncome)} note={`${model.metrics.actualCashEntries} dated income / cost ${model.metrics.actualCashEntries === 1 ? 'entry' : 'entries'}`} />
        </div>
        <div className="performance-position-strip">
          <span><small>Property value</small><b>{currency(model.metrics.currentValue)}</b></span>
          <span><small>Mortgage debt</small><b>{currency(model.metrics.currentDebt)}</b></span>
          <span><small>Monthly rent</small><b>{currency(model.metrics.currentMonthlyRent)}</b></span>
          <span><small>Appreciation gain</small><b>{currency(model.metrics.appreciationGain)}</b></span>
          <span><small>MOIC</small><b>{ratio(model.metrics.moic)}</b></span>
          <span><small>ROI</small><b>{pct(model.metrics.roi, 1)}</b></span>
        </div>
        {(model.metrics.bankAccountCount > 0 || model.metrics.dlaInjected || model.metrics.dlaRepaid) && <div className="performance-bank-strip" aria-label="Company cash and DLA">
          <span><small>Company cash</small><b>{currency(model.metrics.companyCash)}</b></span>
          <span><small>DLA injected</small><b>{currency(model.metrics.dlaInjected)}</b></span>
          <span><small>DLA repaid</small><b>{currency(model.metrics.dlaRepaid)}</b></span>
          <span><small>Net DLA funding</small><b>{currency(model.metrics.netDlaFunding)}</b></span>
        </div>}
        <details className="performance-method"><summary><CircleHelp size={14} /> What these numbers include <ChevronDown size={15} /></summary><div><p><b>Annualised return</b> is XIRR across dated investment cash flows, with current net property equity treated as today’s terminal value. <b>Net income</b> uses dated Documents & Expenses entries only.</p><p>Historical rent, costs and valuations are shown only where a dated record exists. The app does not backfill current assumptions into the past. Forecasts start at Today and use the shared portfolio assumptions.</p></div></details>
      </> : <div className="performance-empty"><TrendingUp size={25} /><b>Add a property to measure performance</b><span>Performance starts from purchase, financing and dated cash-flow data already held in the portfolio.</span></div>}
    </section>

    {properties.length > 0 && <>
      {model.warnings.length > 0 && <details className="performance-data-quality" aria-label="Performance data quality"><summary><b>Data coverage</b><span>{model.warnings.length} {model.warnings.length === 1 ? 'note' : 'notes'}</span><ChevronDown size={15} /></summary><div>{model.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></details>}

      <section className="panel performance-journey">
        <header className="performance-journey-header"><div><span className="kicker">PERFORMANCE OVER TIME</span><h2>{viewDefinition.label}</h2><p>{viewDefinition.description}</p></div><div className="performance-view-switch" role="group" aria-label="Performance view">{Object.entries(chartViews).map(([key, definition]) => <button key={key} className={view === key ? 'active' : ''} aria-pressed={view === key} onClick={() => setView(key)}>{definition.label}</button>)}</div></header>
        <div className="performance-series-toolbar">
          <div className="performance-series-toggles" role="group" aria-label="Displayed metrics">{viewDefinition.series.map((series) => <button type="button" key={series.key} className={`${series.className} ${visibleSeries.includes(series.key) ? 'active' : ''}`} aria-pressed={visibleSeries.includes(series.key)} onClick={() => toggleSeries(series.key)}><i />{series.label}</button>)}</div>
          <div className="performance-chart-options">
            <label className="performance-switch"><input type="checkbox" checked={showForecast} onChange={(event) => setShowForecast(event.target.checked)} /><span aria-hidden="true"><i /></span><b>Forecast</b></label>
            {showForecast && <div className="performance-horizon-switch" role="group" aria-label="Projection horizon">{[5, 10, 15].map((years) => <button key={years} className={horizonYears === years ? 'active' : ''} aria-pressed={horizonYears === years} onClick={() => setHorizonYears(years)}>{years}Y</button>)}</div>}
            <label className="performance-switch"><input type="checkbox" checked={showEvents} onChange={(event) => setShowEvents(event.target.checked)} /><span aria-hidden="true"><i /></span><b>Events</b></label>
          </div>
        </div>
        <div className="performance-chart-readout"><span><small>Today · {primarySeries.label}</small><b>{hasNumber(todayPoint?.[primarySeries.key]) ? currency(todayPoint[primarySeries.key]) : 'No recorded history'}</b></span>{showForecast && <span><small>{horizonYears}Y forecast</small><b>{hasNumber(forecastPoint?.[primarySeries.key]) ? currency(forecastPoint[primarySeries.key]) : '—'}</b></span>}</div>
        <PerformanceChart model={model} view={view} visibleSeries={visibleSeries} showForecast={showForecast} showEvents={showEvents} />
        <p className="performance-chart-note">Solid lines are recorded history. Dashed lines start at Today and are forecasts. Event marks are grouped when dates are close; hover, focus or tap a mark for the value, type, date and source.</p>
      </section>

      <div className="performance-analysis-grid">
        <section className="panel performance-breakdown"><header><div><span className="kicker">RETURN BREAKDOWN</span><h2>Where the return came from</h2></div></header><div className="performance-breakdown-list">{model.breakdown.map((item) => <div key={item.key}><span>{item.label}</span><i><em style={{ width: `${Math.max(2, Math.abs(item.amount) / maxBreakdown * 100)}%` }} className={item.amount >= 0 ? 'positive' : 'negative'} /></i><b className={item.amount >= 0 ? 'positive' : 'negative'}>{item.amount >= 0 ? '+' : ''}{currency(item.amount)}</b></div>)}</div><footer><span>Wealth created</span><b>{currency(model.metrics.wealthCreated)}</b></footer></section>

        <section className="panel performance-forecast-summary"><header><div><span className="kicker">{horizonYears}-YEAR BASE PROJECTION</span><h2>Forecast endpoints</h2></div></header><dl><div><dt>Property value</dt><dd>{currency(model.projection.propertyValue)}</dd></div><div><dt>Mortgage debt</dt><dd>{currency(model.projection.debt)}</dd></div><div><dt>Equity</dt><dd>{currency(model.projection.equity)}</dd></div><div><dt>Monthly rent</dt><dd>{currency(model.projection.monthlyRent)}</dd></div><div><dt>Cumulative costs</dt><dd>{currency(model.projection.cumulativeCosts)}</dd></div><div><dt>Cumulative net income</dt><dd>{currency(model.projection.cumulativeNetIncome)}</dd></div><div><dt>Appreciation gain</dt><dd>{currency(model.projection.cumulativeAppreciation)}</dd></div><div className="highlight"><dt>Projected annualised return</dt><dd>{pct(model.projection.annualisedReturn, 1)}</dd></div></dl><footer><span>Projected wealth created</span><b>{currency(model.projection.wealthCreated)}</b></footer></section>
      </div>

      <details className="panel performance-assumptions"><summary><span><b>Projection assumptions</b><small>Same portfolio model inputs; historical return is unaffected</small></span><ChevronDown size={17} /></summary><div className="performance-assumption-grid"><label><span>Property appreciation</span><div><input type="number" step="0.1" value={(finite(settings.appreciationRate) * 100).toFixed(1)} onChange={(event) => setPercentAssumption('appreciationRate', event.target.value)} /><i>%</i></div></label><label><span>Rent growth</span><div><input type="number" step="0.1" value={(finite(settings.rentGrowthRate) * 100).toFixed(1)} onChange={(event) => setPercentAssumption('rentGrowthRate', event.target.value)} /><i>%</i></div></label><label><span>Interest-rate shock</span><div><input type="number" step="0.1" value={(finite(settings.rateShock) * 100).toFixed(1)} onChange={(event) => setPercentAssumption('rateShock', event.target.value)} /><i>%</i></div></label><div className="performance-fixed-assumption"><span>Other operating costs</span><b>Current model values</b><small>Held at the current entered amounts rather than inventing a new inflation assumption.</small></div></div></details>

      <section className="panel performance-history"><header><div><span className="kicker">FINANCIAL HISTORY</span><h2>Every return-relevant event</h2></div><div className="performance-history-filters" role="group" aria-label="Financial history filter">{[['all', 'All'], ['income', 'Income'], ['cost', 'Costs'], ['finance', 'Financing'], ['value', 'Value']].map(([key, label]) => <button key={key} className={eventFilter === key ? 'active' : ''} aria-pressed={eventFilter === key} onClick={() => setEventFilter(key)}>{label}</button>)}</div></header><div className="performance-table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Property</th><th>Cash</th><th>Running cash</th><th>Source</th><th aria-label="Actions" /></tr></thead><tbody>{visibleEvents.map((event) => {
        const propertyName = properties.find((property) => property.id === event.propertyId)?.name || (event.propertyId ? 'Property' : 'Portfolio')
        const manual = event.sourceType === 'manual-performance'
        const deletable = manual || event.sourceType === 'timeline'
        return <tr key={event.id}><td><time>{formatDate(event.occurredAt)}</time></td><td><b>{event.title}</b>{event.details && <small>{event.details}</small>}{event.estimated && <em>Estimated</em>}</td><td>{propertyName}</td><td className={event.amount > 0 ? 'positive' : event.amount < 0 ? 'negative' : ''}>{event.amount ? money(event.amount) : '—'}</td><td>{money(event.runningCash)}</td><td>{sourceLabel(event)}</td><td>{deletable && <span className="performance-row-actions">{manual && <button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); editEvent(event) }} aria-label={`Edit ${event.title}`}><Pencil size={14} /></button>}<button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); requestDeleteEvent(event) }} aria-label={`Delete ${event.title}`}><Trash2 size={14} /></button></span>}</td></tr>
      })}{visibleEvents.length === 0 && <tr><td colSpan="7" className="performance-table-empty">No matching financial events.</td></tr>}</tbody></table></div></section>
    </>}

    {editorDraft && <PerformanceEventEditor draft={editorDraft} properties={properties} onSave={saveEvent} onClose={() => setEditorDraft(null)} />}
    {deleteTarget && <DeleteConfirmDialog title="Delete financial event?" message={deleteTarget.sourceType === 'timeline' ? 'This removes the historical timeline record only. The current property value, rent or loan field is unchanged.' : 'This removes this manual Performance adjustment.'} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteEvent} />}
  </div>
}
