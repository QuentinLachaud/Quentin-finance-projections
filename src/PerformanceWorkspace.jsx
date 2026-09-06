import React, { useMemo, useState } from 'react'
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'
import {
  DEFAULT_PERFORMANCE_SERIES,
  PERFORMANCE_SCENARIOS,
  PERFORMANCE_SERIES,
  buildTheoreticalPerformanceProjection,
  createPerformanceUpdate,
  formatCompactCurrency,
  monthLabel,
  niceCurrencyAxis,
  normalizePerformanceUpdates,
  performanceXAxisTicks,
  resolvePerformanceAssumptions,
  validatePerformanceUpdate,
} from './performanceForecast.js'

const currency = (value) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: Math.abs(Number(value || 0)) < 10000 ? 0 : 0,
}).format(Number(value || 0))
const pctInput = (value) => Number.isFinite(Number(value)) ? (Number(value) * 100).toFixed(2) : '0.00'
const propertyName = (property) => property?.name || property?.address || property?.postcode || 'BTL'

const SERIES_CLASS = {
  assetValue: 'value',
  equity: 'equity',
  debt: 'debt',
  monthlyCashflow: 'cashflow',
  cashAccumulation: 'cash',
  monthlyRent: 'rent',
}

const chartWidthFor = (horizonYears) => ({ 1: 900, 3: 1080, 5: 1260, 10: 1680, 15: 2040 }[horizonYears] || 1260)

function Segmented({ label, value, options, onChange, className = '' }) {
  return <div className={`performance-v2-segmented ${className}`} role="group" aria-label={label}>
    {options.map((option) => <button
      key={option.value}
      type="button"
      className={value === option.value ? 'selected' : ''}
      aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>
}

function PerformanceChart({ model, visibleSeries, horizonYears, scope }) {
  const points = model.points || []
  const [activeIndex, setActiveIndex] = useState(0)
  const width = chartWidthFor(horizonYears)
  const height = 390
  const pad = { top: 28, right: 84, bottom: 46, left: 84 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const series = PERFORMANCE_SERIES.filter((item) => visibleSeries.includes(item.key))
  const capitalSeries = series.filter((item) => item.axis === 'capital')
  const flowSeries = series.filter((item) => item.axis === 'flow')
  const capitalAxis = niceCurrencyAxis(points.flatMap((point) => capitalSeries.map((item) => point[item.key])), 5)
  const flowAxis = niceCurrencyAxis(points.flatMap((point) => flowSeries.map((item) => point[item.key])), 5)
  const xTicks = performanceXAxisTicks(points, horizonYears)
  const active = points[Math.min(activeIndex, Math.max(0, points.length - 1))] || points[0]
  const x = (index) => pad.left + (index / Math.max(1, points.length - 1)) * plotWidth
  const yFor = (value, axis) => {
    const range = Math.max(1e-9, axis.max - axis.min)
    return pad.top + ((axis.max - Number(value || 0)) / range) * plotHeight
  }
  const pathFor = (item) => points.map((point, index) => {
    const axis = item.axis === 'flow' ? flowAxis : capitalAxis
    return `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${yFor(point[item.key], axis).toFixed(2)}`
  }).join(' ')
  const gridAxis = capitalSeries.length ? capitalAxis : flowAxis
  const pointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || points.length < 2) return
    const relative = Math.max(0, Math.min(1, (event.clientX - rect.left - pad.left) / Math.max(1, rect.width - pad.left - pad.right)))
    setActiveIndex(Math.round(relative * (points.length - 1)))
  }

  if (!points.length) return <div className="performance-v2-empty-chart">Add an active BTL to model Performance.</div>

  return <>
    <div className="performance-v2-inspector" aria-live="polite">
      <strong>{monthLabel(active?.date, true)}</strong>
      {series.map((item) => <span key={item.key} className={`series-${SERIES_CLASS[item.key]}`}>
        <i />{scope === 'portfolio' ? item.label : item.propertyLabel}: <b>{currency(active?.[item.key])}</b>
      </span>)}
    </div>
    <div className="performance-v2-chart-scroll" data-testid="performance-chart-scroll">
      <svg
        className="performance-v2-chart"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label="Forward performance chart"
        onPointerMove={pointerMove}
        onPointerDown={pointerMove}
      >
        <g className="performance-v2-grid">
          {gridAxis.ticks.map((tick) => {
            const axis = capitalSeries.length ? capitalAxis : flowAxis
            const y = yFor(tick, axis)
            return <line key={`grid-${tick}`} x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
          })}
        </g>
        {capitalSeries.length > 0 && <g className="performance-v2-axis capital-axis">
          {capitalAxis.ticks.map((tick) => <text key={`capital-${tick}`} x={pad.left - 12} y={yFor(tick, capitalAxis) + 4} textAnchor="end">{formatCompactCurrency(tick)}</text>)}
        </g>}
        {flowSeries.length > 0 && <g className="performance-v2-axis flow-axis">
          {flowAxis.ticks.map((tick) => <text key={`flow-${tick}`} x={width - pad.right + 12} y={yFor(tick, flowAxis) + 4} textAnchor="start">{formatCompactCurrency(tick)}/m</text>)}
        </g>}
        <g className="performance-v2-x-axis">
          {xTicks.map((tick) => <g key={`${tick.index}-${tick.label}`}>
            <line x1={x(tick.index)} x2={x(tick.index)} y1={height - pad.bottom} y2={height - pad.bottom + 6} />
            <text x={x(tick.index)} y={height - 16} textAnchor="middle">{tick.label}</text>
          </g>)}
        </g>
        {series.map((item) => <path
          key={item.key}
          className={`performance-v2-line series-${SERIES_CLASS[item.key]}`}
          d={pathFor(item)}
          vectorEffect="non-scaling-stroke"
        />)}
        {active && <g className="performance-v2-scrubber" aria-hidden="true">
          <line x1={x(activeIndex)} x2={x(activeIndex)} y1={pad.top} y2={height - pad.bottom} />
          {series.map((item) => {
            const axis = item.axis === 'flow' ? flowAxis : capitalAxis
            return <circle key={item.key} className={`series-${SERIES_CLASS[item.key]}`} cx={x(activeIndex)} cy={yFor(active[item.key], axis)} r="4.5" />
          })}
        </g>}
      </svg>
    </div>
  </>
}

function UpdateModal({ draft, setDraft, properties, updates, onSave, onClose }) {
  const [error, setError] = useState('')
  const save = () => {
    const validation = validatePerformanceUpdate(draft, updates, properties, draft.id)
    if (validation) return setError(validation)
    onSave(draft)
  }
  return <div className="performance-v2-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="performance-v2-modal" role="dialog" aria-modal="true" aria-labelledby="performance-update-title">
      <div className="performance-v2-modal-head">
        <div><small>{draft._new ? 'Add update' : 'Edit update'}</small><h3 id="performance-update-title">{draft.kind === 'rent' ? 'Rent' : 'Valuation'} input</h3></div>
        <button type="button" className="performance-v2-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <label>BTL<select value={draft.propertyId} onChange={(event) => setDraft({ ...draft, propertyId: event.target.value })}>
        <option value="">Choose BTL</option>
        {properties.map((property) => <option key={property.id} value={property.id}>{propertyName(property)}</option>)}
      </select></label>
      <label>{draft.kind === 'rent' ? 'Monthly rent' : 'Valuation'}<div className="performance-v2-money-input"><span>£</span><input type="number" min="0" step={draft.kind === 'rent' ? '1' : '1000'} value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></div></label>
      <div className="performance-v2-modal-dates">
        <label>From<input type="month" value={draft.startMonth} onChange={(event) => setDraft({ ...draft, startMonth: event.target.value })} /></label>
        <label>To <small>optional</small><input type="month" value={draft.endMonth || ''} onChange={(event) => setDraft({ ...draft, endMonth: event.target.value })} /></label>
      </div>
      {error && <p className="performance-v2-form-error" role="alert">{error}</p>}
      <div className="performance-v2-modal-actions">
        <button type="button" className="performance-v2-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="performance-v2-primary" onClick={save}>Save update</button>
      </div>
    </div>
  </div>
}

function DeleteModal({ update, property, onCancel, onDelete }) {
  if (!update) return null
  return <div className="performance-v2-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <div className="performance-v2-modal performance-v2-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="performance-delete-title">
      <div className="performance-v2-danger-icon"><Trash2 size={18} /></div>
      <h3 id="performance-delete-title">Delete this {update.kind} update?</h3>
      <p>{propertyName(property)} · {currency(update.value)} · {monthLabel(update.startMonth, true)}{update.endMonth ? ` to ${monthLabel(update.endMonth, true)}` : ' onward'}</p>
      <div className="performance-v2-modal-actions">
        <button type="button" className="performance-v2-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="performance-v2-delete" onClick={onDelete}>Delete</button>
      </div>
    </div>
  </div>
}

export default function PerformanceWorkspace({
  properties = [],
  settings = {},
  onAssumptionChange,
}) {
  const activeProperties = properties.filter((property) => property?.active !== false)
  const [scope, setScope] = useState('portfolio')
  const [scenarioId, setScenarioId] = useState(0)
  const [horizonYears, setHorizonYears] = useState(10)
  const [visibleSeries, setVisibleSeries] = useState(DEFAULT_PERFORMANCE_SERIES)
  const [excludeExtractions, setExcludeExtractions] = useState(true)
  const [updateKind, setUpdateKind] = useState('rent')
  const [draft, setDraft] = useState(null)
  const [deleteId, setDeleteId] = useState('')
  const [dragId, setDragId] = useState('')

  const updates = useMemo(() => normalizePerformanceUpdates(settings.performanceUpdates, properties), [settings.performanceUpdates, properties])
  const model = useMemo(() => buildTheoreticalPerformanceProjection({
    properties, settings, scope, scenarioId, horizonYears, excludeExtractions,
  }), [properties, settings, scope, scenarioId, horizonYears, excludeExtractions])
  const assumptions = resolvePerformanceAssumptions(settings, scope)
  const scopedProperty = activeProperties.find((property) => property.id === scope) || null
  const visibleUpdates = updates.filter((entry) => entry.kind === updateKind && (scope === 'portfolio' || entry.propertyId === scope))
  const deleteUpdate = updates.find((entry) => entry.id === deleteId) || null
  const isCompanyPortfolio = scope === 'portfolio' && settings.accountType !== 'private'

  const writeUpdates = (next) => onAssumptionChange?.('performanceUpdates', normalizePerformanceUpdates(next, properties))
  const toggleSeries = (key) => setVisibleSeries((current) => current.includes(key)
    ? (current.length === 1 ? current : current.filter((item) => item !== key))
    : [...current, key])
  const newUpdate = () => setDraft({ ...createPerformanceUpdate({
    kind: updateKind,
    propertyId: scope === 'portfolio' ? (activeProperties[0]?.id || '') : scope,
    order: updates.length,
  }), _new: true })
  const saveUpdate = (entry) => {
    const normalized = { ...entry, value: Number(entry.value) }
    writeUpdates(updates.some((candidate) => candidate.id === entry.id)
      ? updates.map((candidate) => candidate.id === entry.id ? normalized : candidate)
      : [...updates, normalized])
    setDraft(null)
  }
  const reorder = (targetId) => {
    if (!dragId || dragId === targetId) return setDragId('')
    const orderedVisible = [...visibleUpdates]
    const from = orderedVisible.findIndex((entry) => entry.id === dragId)
    const to = orderedVisible.findIndex((entry) => entry.id === targetId)
    if (from < 0 || to < 0) return setDragId('')
    const [moved] = orderedVisible.splice(from, 1)
    orderedVisible.splice(to, 0, moved)
    const rank = new Map(orderedVisible.map((entry, index) => [entry.id, index]))
    const otherCount = updates.length - orderedVisible.length
    writeUpdates(updates.map((entry) => rank.has(entry.id) ? { ...entry, order: otherCount + rank.get(entry.id) } : entry))
    setDragId('')
  }
  const writeModelInput = (key, value) => {
    if (scope === 'portfolio') return onAssumptionChange?.(key, value)
    const current = settings.performanceModelOverrides && typeof settings.performanceModelOverrides === 'object'
      ? settings.performanceModelOverrides : {}
    const existing = current[scope] && typeof current[scope] === 'object' ? current[scope] : {}
    onAssumptionChange?.('performanceModelOverrides', { ...current, [scope]: { ...existing, [key]: value } })
  }
  const writeShockStart = (value) => {
    if (scope === 'portfolio') return onAssumptionChange?.('performanceRateShockStartMonth', value)
    const current = settings.performanceModelOverrides && typeof settings.performanceModelOverrides === 'object'
      ? settings.performanceModelOverrides : {}
    const existing = current[scope] && typeof current[scope] === 'object' ? current[scope] : {}
    onAssumptionChange?.('performanceModelOverrides', { ...current, [scope]: { ...existing, rateShockStartMonth: value } })
  }
  const resetScopeInputs = () => {
    if (scope === 'portfolio') return
    const current = { ...(settings.performanceModelOverrides || {}) }
    delete current[scope]
    onAssumptionChange?.('performanceModelOverrides', current)
  }

  return <section className="performance-v2" aria-label="Performance forecast">
    <header className="performance-v2-header">
      <div><span className="performance-v2-eyebrow">Forward model</span><h1>Performance</h1><p>Theoretical progression from today, using your current BTL values and recorded input updates.</p></div>
      <label className="performance-v2-scope">Scope<select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="portfolio">Whole portfolio</option>
        {activeProperties.map((property) => <option key={property.id} value={property.id}>{propertyName(property)}</option>)}
      </select></label>
    </header>

    <div className="performance-v2-control-row">
      <div><span className="performance-v2-control-label">Scenario</span><Segmented label="Scenario" value={scenarioId} onChange={setScenarioId} options={PERFORMANCE_SCENARIOS.map((scenario) => ({ value: scenario.id, label: scenario.shortLabel }))} /></div>
      <div><span className="performance-v2-control-label">Horizon</span><Segmented label="Forecast horizon" value={horizonYears} onChange={setHorizonYears} options={[1, 3, 5, 10, 15].map((year) => ({ value: year, label: `${year}Y` }))} className="compact" /></div>
    </div>

    <div className="performance-v2-metric-bar" aria-label="Chart metrics">
      {PERFORMANCE_SERIES.map((item) => <button
        key={item.key}
        type="button"
        className={`performance-v2-metric series-${SERIES_CLASS[item.key]} ${visibleSeries.includes(item.key) ? 'selected' : ''}`}
        aria-pressed={visibleSeries.includes(item.key)}
        onClick={() => toggleSeries(item.key)}
      ><i />{scope === 'portfolio' ? item.label : item.propertyLabel}</button>)}
    </div>

    <article className="performance-v2-chart-card">
      <div className="performance-v2-chart-head">
        <div><h2>{scope === 'portfolio' ? 'Portfolio projection' : `${propertyName(scopedProperty)} projection`}</h2><p>{model.scenario.label} · {horizonYears} year{horizonYears === 1 ? '' : 's'} · cash accumulated starts at £0 today</p></div>
        <label className={`performance-v2-switch ${!isCompanyPortfolio ? 'disabled' : ''}`}>
          <input type="checkbox" checked={excludeExtractions} disabled={!isCompanyPortfolio} onChange={(event) => setExcludeExtractions(event.target.checked)} />
          <span aria-hidden="true" /><b>Exclude extractions</b><small>{isCompanyPortfolio ? 'Shows true company cash flow' : 'Portfolio companies only'}</small>
        </label>
      </div>
      <PerformanceChart model={model} visibleSeries={visibleSeries} horizonYears={horizonYears} scope={scope} />
    </article>

    <article className="performance-v2-inputs-card">
      <div className="performance-v2-section-head">
        <div><span className="performance-v2-control-label">Model inputs</span><h2>{scope === 'portfolio' ? 'Portfolio assumptions' : `${propertyName(scopedProperty)} assumptions`}</h2></div>
        {scope !== 'portfolio' && <button type="button" className="performance-v2-text-button" onClick={resetScopeInputs}>Use portfolio inputs</button>}
      </div>
      <div className="performance-v2-input-grid">
        <label>Rent growth<div className="performance-v2-percent-input"><input type="number" step="0.1" value={pctInput(assumptions.rentGrowthRate)} onChange={(event) => writeModelInput('rentGrowthRate', Number(event.target.value || 0) / 100)} /><span>% / yr</span></div></label>
        <label>HPI / appreciation<div className="performance-v2-percent-input"><input type="number" step="0.1" value={pctInput(assumptions.appreciationRate)} onChange={(event) => writeModelInput('appreciationRate', Number(event.target.value || 0) / 100)} /><span>% / yr</span></div></label>
        <label>Rate shock<div className="performance-v2-percent-input"><input type="number" step="0.1" value={pctInput(assumptions.rateShock)} onChange={(event) => writeModelInput('rateShock', Number(event.target.value || 0) / 100)} /><span>pp</span></div><small>Additive to current mortgage rate</small></label>
        <label>Shock starts <small>optional</small><input type="month" value={assumptions.rateShockStartMonth || ''} onChange={(event) => writeShockStart(event.target.value)} /><small>Blank = immediately</small></label>
      </div>
    </article>

    <article className="performance-v2-updates-card">
      <div className="performance-v2-section-head">
        <div><span className="performance-v2-control-label">Recorded inputs</span><h2>Rent & valuation updates</h2></div>
        <button type="button" className="performance-v2-primary small" onClick={newUpdate}><Plus size={16} /> Add update</button>
      </div>
      <Segmented label="Update type" value={updateKind} onChange={setUpdateKind} options={[{ value: 'rent', label: 'Rent' }, { value: 'valuation', label: 'Valuation' }]} className="performance-v2-update-tags" />
      <div className="performance-v2-update-list">
        {visibleUpdates.length === 0 && <div className="performance-v2-update-empty">No {updateKind} updates recorded for this scope. The forecast uses the current property {updateKind === 'rent' ? 'rent' : 'valuation'}.</div>}
        {visibleUpdates.map((entry) => {
          const property = properties.find((candidate) => candidate.id === entry.propertyId)
          return <div
            key={entry.id}
            className={`performance-v2-update-row ${dragId === entry.id ? 'dragging' : ''}`}
            draggable
            onDragStart={() => setDragId(entry.id)}
            onDragEnd={() => setDragId('')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => reorder(entry.id)}
          >
            <span className="performance-v2-drag" aria-label="Drag to reorder"><GripVertical size={18} /></span>
            <div className="performance-v2-update-main">
              <span>{scope === 'portfolio' ? propertyName(property) : (entry.kind === 'rent' ? 'Monthly rent' : 'Valuation')}</span>
              <strong>{currency(entry.value)}{entry.kind === 'rent' ? ' / month' : ''}</strong>
            </div>
            <div className="performance-v2-update-range"><small>Effective</small><b>{monthLabel(entry.startMonth, true)} <span>→</span> {entry.endMonth ? monthLabel(entry.endMonth, true) : 'Current'}</b></div>
            <div className="performance-v2-update-actions">
              <button type="button" className="performance-v2-icon-button" aria-label={`Edit ${entry.kind} update`} onClick={() => setDraft({ ...entry, value: String(entry.value) })}><Pencil size={16} /></button>
              <button type="button" className="performance-v2-icon-button danger" aria-label={`Delete ${entry.kind} update`} onClick={() => setDeleteId(entry.id)}><Trash2 size={16} /></button>
            </div>
          </div>
        })}
      </div>
    </article>

    {draft && <UpdateModal draft={draft} setDraft={setDraft} properties={activeProperties} updates={updates} onSave={saveUpdate} onClose={() => setDraft(null)} />}
    {deleteUpdate && <DeleteConfirmDialog
      title={`Delete this ${deleteUpdate.kind} update?`}
      message={`${propertyName(properties.find((property) => property.id === deleteUpdate.propertyId))} · ${currency(deleteUpdate.value)} · ${monthLabel(deleteUpdate.startMonth, true)}${deleteUpdate.endMonth ? ` to ${monthLabel(deleteUpdate.endMonth, true)}` : ' onward'}`}
      confirmLabel="Delete update"
      onCancel={() => setDeleteId('')}
      onConfirm={() => { writeUpdates(updates.filter((entry) => entry.id !== deleteId)); setDeleteId('') }}
    />}
  </section>
}
