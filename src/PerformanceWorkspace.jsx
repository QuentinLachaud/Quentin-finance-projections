import BrainDrainNumericInput from './BrainDrainNumericInput.jsx'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'
import { useBankPerformanceData } from './useBankPerformanceData.js'
import { hasChartValue, overlayActualBankSeries } from './actualPerformanceSeries.js'
import {
  DEFAULT_PERFORMANCE_SERIES,
  PERFORMANCE_SCENARIOS,
  PERFORMANCE_SERIES,
  applyPerformanceUpdate,
  buildActualBankCashflowSeries,
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
  actualBankCashflow: 'actual-cashflow',
  cashAccumulation: 'cash',
  actualBankAccumulation: 'actual-accumulation',
  monthlyRent: 'rent',
}

const MONTHLY_SERIES_KEYS = ['monthlyCashflow', 'actualBankCashflow', 'monthlyRent']
const CAPITAL_SERIES_KEYS = ['assetValue', 'equity', 'debt', 'cashAccumulation', 'actualBankAccumulation']

const chartWidthFor = (pointCount) => Math.max(980, Math.min(2800, 520 + Math.max(0, pointCount - 1) * 10))

function Segmented({ label, value, options, onChange, className = '' }) {
  return <div className={`performance-v2-segmented ${className}`} role="group" aria-label={label}>
    {options.map((option) => <button
      key={option.value}
      type="button"
      className={value === option.value ? 'selected' : ''}
      style={option.colour ? { '--scenario': option.colour } : undefined}
      aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>
}


function MetricBar({ keys, visibleSeries, scope, onToggle }) {
  const items = PERFORMANCE_SERIES.filter((item) => keys.includes(item.key))
  return <div className="performance-v2-metric-bar" aria-label="Chart metrics">
    {items.map((item) => <button
      key={item.key}
      type="button"
      className={`performance-v2-metric series-${SERIES_CLASS[item.key]} ${visibleSeries.includes(item.key) ? 'selected' : ''}`}
      aria-pressed={visibleSeries.includes(item.key)}
      onClick={() => onToggle(item.key)}
    ><i />{scope === 'portfolio' ? item.label : item.propertyLabel}</button>)}
  </div>
}

export function PerformanceChart({ model, visibleSeries, scope, ariaLabel = 'Performance chart', height = 360 }) {
  const points = model.points || []
  const [activeIndex, setActiveIndex] = useState(null)
  const width = chartWidthFor(points.length)
  const pad = { top: 34, right: 94, bottom: 52, left: 94 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const series = PERFORMANCE_SERIES.filter((item) => visibleSeries.includes(item.key))
  const capitalSeries = series.filter((item) => item.axis === 'capital' && points.some((point) => hasChartValue(point[item.key])))
  const flowSeries = series.filter((item) => item.axis === 'flow' && points.some((point) => hasChartValue(point[item.key])))
  const capitalAxis = niceCurrencyAxis(points.flatMap((point) => capitalSeries.map((item) => point[item.key])).filter(hasChartValue), 5)
  const flowAxis = niceCurrencyAxis(points.flatMap((point) => flowSeries.map((item) => point[item.key])).filter(hasChartValue), 5)
  const xTicks = performanceXAxisTicks(points)
  const clampedIndex = activeIndex == null ? null : Math.min(activeIndex, Math.max(0, points.length - 1))
  const active = clampedIndex == null ? null : points[clampedIndex]
  const x = (index) => pad.left + (index / Math.max(1, points.length - 1)) * plotWidth
  const yFor = (value, axis) => {
    const range = Math.max(1e-9, axis.max - axis.min)
    return pad.top + ((axis.max - Number(value || 0)) / range) * plotHeight
  }
  const pathFor = (item, startIndex = 0, endIndex = points.length - 1) => {
    const axis = item.axis === 'flow' ? flowAxis : capitalAxis
    let path = ''
    let drawing = false
    points.forEach((point, index) => {
      if (index < startIndex || index > endIndex) return
      const value = point[item.key]
      if (!hasChartValue(value)) {
        drawing = false
        return
      }
      path += `${drawing ? ' L' : ' M'} ${x(index).toFixed(2)} ${yFor(value, axis).toFixed(2)}`
      drawing = true
    })
    return path.trim()
  }
  const gridAxis = capitalSeries.length ? capitalAxis : flowAxis

  useEffect(() => {
    setActiveIndex(null)
  }, [model.todayIndex, points.length])

  const pointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || points.length < 2) return
    const svgX = (event.clientX - rect.left) * (width / rect.width)
    const relative = Math.max(0, Math.min(1, (svgX - pad.left) / Math.max(1, plotWidth)))
    setActiveIndex(Math.round(relative * (points.length - 1)))
  }

  if (!points.length) return <div className="performance-v2-empty-chart">Add an active BTL to model Performance.</div>

  const readoutRows = active ? series.filter((item) => hasChartValue(active[item.key])) : []
  const todayX = Number.isFinite(Number(model.todayIndex)) ? x(model.todayIndex) : null
  const todayIndex = Number.isFinite(Number(model.todayIndex))
    ? Math.max(0, Math.min(points.length - 1, Math.trunc(Number(model.todayIndex))))
    : Math.max(0, points.length - 1)

  return <div className="performance-v2-chart-shell">
    {active && <div className="performance-v2-chart-readout" aria-live="polite">
      <strong>{monthLabel(active.date, true)}</strong>
      <div>{readoutRows.map((item) => <span key={item.key} className={`series-${SERIES_CLASS[item.key]}`}><i />{scope === 'portfolio' ? item.label : item.propertyLabel}<b>{currency(active[item.key])}</b></span>)}</div>
    </div>}
    <div className="performance-v2-chart-scroll" data-testid="performance-chart-scroll">
      <svg
        className="performance-v2-chart"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={pointerMove}
        onPointerDown={pointerMove}
        onPointerLeave={() => setActiveIndex(null)}
      >
        {todayX != null && <g className="performance-v2-era-bands" aria-hidden="true">
          <rect className="future" x={todayX} y={pad.top} width={Math.max(0, width - pad.right - todayX)} height={plotHeight} />
        </g>}
        <g className="performance-v2-grid">
          {gridAxis.ticks.map((tick) => {
            const axis = capitalSeries.length ? capitalAxis : flowAxis
            const y = yFor(tick, axis)
            return <line key={`grid-${tick}`} x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
          })}
        </g>

        {capitalSeries.length > 0 && <g className="performance-v2-axis capital-axis">
          {capitalAxis.ticks.map((tick) => <text key={`capital-${tick}`} x={pad.left - 14} y={yFor(tick, capitalAxis) + 5} textAnchor="end">{formatCompactCurrency(tick)}</text>)}
        </g>}
        {flowSeries.length > 0 && <g className="performance-v2-axis flow-axis">
          {flowAxis.ticks.map((tick) => <text key={`flow-${tick}`} x={width - pad.right + 14} y={yFor(tick, flowAxis) + 5} textAnchor="start">{formatCompactCurrency(tick)}/m</text>)}
        </g>}

        <g className="performance-v2-x-axis">
          {xTicks.map((tick) => <g key={`${tick.index}-${tick.label}`}>
            <line x1={x(tick.index)} x2={x(tick.index)} y1={height - pad.bottom} y2={height - pad.bottom + 6} />
            <text x={x(tick.index)} y={height - 18} textAnchor="middle">{tick.label}</text>
          </g>)}
        </g>

        {todayX != null && <g className="performance-v2-today-marker" aria-hidden="true">
          <line x1={todayX} x2={todayX} y1={pad.top} y2={height - pad.bottom} />
          <text x={todayX + 7} y={pad.top + 12}>Today</text>
        </g>}

        {series.map((item) => {
          if (item.actual) {
            const d = pathFor(item, 0, todayIndex)
            return d ? <path
              key={item.key}
              className={`performance-v2-line actual-series series-${SERIES_CLASS[item.key]}`}
              d={d}
              vectorEffect="non-scaling-stroke"
            /> : null
          }
          const historyPath = pathFor(item, 0, todayIndex)
          const forecastPath = todayIndex < points.length - 1 ? pathFor(item, todayIndex, points.length - 1) : ''
          return <g key={item.key} className={`performance-v2-series series-${SERIES_CLASS[item.key]}`}>
            {historyPath && <path
              className={`performance-v2-line history-segment series-${SERIES_CLASS[item.key]}`}
              d={historyPath}
              vectorEffect="non-scaling-stroke"
            />}
            {forecastPath && <path
              className={`performance-v2-line forecast-segment series-${SERIES_CLASS[item.key]}`}
              d={forecastPath}
              vectorEffect="non-scaling-stroke"
            />}
          </g>
        })}

        {active && <g className="performance-v2-scrubber" aria-hidden="true">
          <line className="performance-v2-hover-guide" x1={x(clampedIndex)} x2={x(clampedIndex)} y1={pad.top} y2={height - pad.bottom} />
          {series.map((item) => {
            if (!hasChartValue(active[item.key])) return null
            const axis = item.axis === 'flow' ? flowAxis : capitalAxis
            return <circle key={item.key} className={`series-${SERIES_CLASS[item.key]}`} cx={x(clampedIndex)} cy={yFor(active[item.key], axis)} r="4.2" />
          })}
        </g>}
      </svg>
    </div>
  </div>
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
      <label>{draft.kind === 'rent' ? 'Monthly rent' : 'Valuation'}<div className="performance-v2-money-input"><span>£</span><BrainDrainNumericInput type="number" min="0" step={draft.kind === 'rent' ? '1' : '1000'} value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></div></label>
      <div className="performance-v2-modal-dates">
        <label>From<BrainDrainNumericInput type="month" value={draft.startMonth} onChange={(event) => setDraft({ ...draft, startMonth: event.target.value })} /></label>
        <label>To <small>optional</small><BrainDrainNumericInput type="month" value={draft.endMonth || ''} onChange={(event) => setDraft({ ...draft, endMonth: event.target.value })} /></label>
      </div>
      {error && <p className="performance-v2-form-error" role="alert">{error}</p>}
      <div className="performance-v2-modal-actions">
        <button type="button" className="performance-v2-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="performance-v2-primary" onClick={save}>Save update</button>
      </div>
    </div>
  </div>
}

export default function PerformanceWorkspace({
  user = null,
  properties = [],
  loans = null,
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
  const [dragState, setDragState] = useState(null)
  const updateNodes = useRef(new Map())
  const bankData = useBankPerformanceData(user?.id)

  const updates = useMemo(() => normalizePerformanceUpdates(settings.performanceUpdates, properties), [settings.performanceUpdates, properties])
  const model = useMemo(() => buildTheoreticalPerformanceProjection({
    properties, loans, settings, scope, scenarioId, horizonYears, excludeExtractions,
  }), [properties, loans, settings, scope, scenarioId, horizonYears, excludeExtractions])
  const actualBankSeries = useMemo(() => buildActualBankCashflowSeries({
    transactions: bankData.transactions,
    scope,
    fromMonth: model.startMonth,
    toMonth: model.todayMonth,
  }), [bankData.transactions, scope, model.startMonth, model.todayMonth])
  const chartModel = useMemo(() => overlayActualBankSeries(model, actualBankSeries), [model, actualBankSeries])
  const assumptions = resolvePerformanceAssumptions(settings, scope)
  const scopedProperty = activeProperties.find((property) => property.id === scope) || null
  const visibleUpdates = updates.filter((entry) => entry.kind === updateKind && (scope === 'portfolio' || entry.propertyId === scope))
  const deleteUpdate = updates.find((entry) => entry.id === deleteId) || null
  const isCompanyPortfolio = scope === 'portfolio' && settings.accountType !== 'private'
  const monthlyVisibleSeries = visibleSeries.filter((key) => MONTHLY_SERIES_KEYS.includes(key))
  const capitalVisibleSeries = visibleSeries.filter((key) => CAPITAL_SERIES_KEYS.includes(key))

  const writeUpdates = (next) => onAssumptionChange?.('performanceUpdates', normalizePerformanceUpdates(next, properties))
  const toggleSeries = (key) => setVisibleSeries((current) => {
    const group = MONTHLY_SERIES_KEYS.includes(key) ? MONTHLY_SERIES_KEYS : CAPITAL_SERIES_KEYS
    if (!current.includes(key)) return [...current, key]
    if (current.filter((item) => group.includes(item)).length <= 1) return current
    return current.filter((item) => item !== key)
  })
  const newUpdate = () => setDraft({ ...createPerformanceUpdate({
    kind: updateKind,
    propertyId: scope === 'portfolio' ? (activeProperties[0]?.id || '') : scope,
    order: updates.length,
  }), _new: true })
  const saveUpdate = (entry) => {
    const normalized = { ...entry, value: Number(entry.value) }
    writeUpdates(applyPerformanceUpdate(updates, normalized, properties))
    setDraft(null)
  }

  const moveUpdate = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= visibleUpdates.length) return
    const orderedVisible = [...visibleUpdates]
    const [moved] = orderedVisible.splice(fromIndex, 1)
    orderedVisible.splice(toIndex, 0, moved)
    const visibleIds = new Set(orderedVisible.map((entry) => entry.id))
    const reordered = []
    let visibleIndex = 0
    for (const entry of updates) {
      if (visibleIds.has(entry.id)) reordered.push({ ...orderedVisible[visibleIndex++], order: reordered.length })
      else reordered.push({ ...entry, order: reordered.length })
    }
    writeUpdates(reordered)
  }

  const updateDragShift = (index) => {
    if (!dragState || index === dragState.fromIndex) return 0
    const distance = dragState.height + dragState.gap
    if (dragState.fromIndex < dragState.toIndex && index > dragState.fromIndex && index <= dragState.toIndex) return -distance
    if (dragState.fromIndex > dragState.toIndex && index >= dragState.toIndex && index < dragState.fromIndex) return distance
    return 0
  }

  const beginUpdateDrag = (event, entry, index) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const node = updateNodes.current.get(entry.id)
    if (!node) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const rect = node.getBoundingClientRect()
    const stack = node.parentElement
    const gap = Number.parseFloat(stack ? window.getComputedStyle(stack).rowGap : '10') || 10
    setDragState({
      id: entry.id,
      pointerId: event.pointerId,
      fromIndex: index,
      toIndex: index,
      startY: event.clientY,
      currentY: event.clientY,
      height: rect.height,
      gap,
    })
  }

  const updateUpdateDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    event.preventDefault()
    const pointerY = event.clientY
    let targetIndex = dragState.fromIndex
    for (let index = 0; index < visibleUpdates.length; index += 1) {
      if (index === dragState.fromIndex) continue
      const node = updateNodes.current.get(visibleUpdates[index].id)
      if (!node) continue
      const rect = node.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      if (index < dragState.fromIndex && pointerY < midpoint) {
        targetIndex = index
        break
      }
      if (index > dragState.fromIndex && pointerY > midpoint) targetIndex = index
    }
    setDragState((current) => current && current.pointerId === event.pointerId
      ? { ...current, currentY: pointerY, toIndex: targetIndex }
      : current)
  }

  const finishUpdateDrag = (event, cancelled = false) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const { fromIndex, toIndex } = dragState
    setDragState(null)
    if (!cancelled && fromIndex !== toIndex) moveUpdate(fromIndex, toIndex)
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
      <div><span className="performance-v2-eyebrow">History + forecast</span><h1>Performance</h1><p>Recorded property inputs from acquisition onward, then a theoretical forecast from today.</p></div>
      <label className="performance-v2-scope">Scope<select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="portfolio">Whole portfolio</option>
        {activeProperties.map((property) => <option key={property.id} value={property.id}>{propertyName(property)}</option>)}
      </select></label>
    </header>

    <div className="performance-v2-control-row">
      <div><span className="performance-v2-control-label">Scenario</span><Segmented label="Scenario" value={scenarioId} onChange={setScenarioId} options={PERFORMANCE_SCENARIOS.map((scenario) => ({ value: scenario.id, label: scenario.shortLabel, colour: scenario.colour }))} className="scenario" /></div>
      <div><span className="performance-v2-control-label">Horizon</span><Segmented label="Forecast horizon" value={horizonYears} onChange={setHorizonYears} options={[1, 3, 5, 10, 15].map((year) => ({ value: year, label: `${year}Y` }))} className="compact" /></div>
    </div>

    {!bankData.available && <p className="performance-v2-bank-note">Actual Banking series become available when Banking has imported or connected transaction data.</p>}

    <div className="performance-v2-chart-stack">
      <article className="performance-v2-chart-card performance-v2-chart-card-monthly">
        <div className="performance-v2-chart-head">
          <div><span className="performance-v2-control-label">Monthly</span><h2>Monthly performance</h2><p>Past compares model with Banking actuals · future is the {model.scenario.label} estimate</p></div>
          <label className={`performance-v2-switch ${!isCompanyPortfolio ? 'disabled' : ''}`}>
            <BrainDrainNumericInput type="checkbox" checked={excludeExtractions} disabled={!isCompanyPortfolio} onChange={(event) => setExcludeExtractions(event.target.checked)} />
            <span aria-hidden="true" /><b>Exclude extractions</b><small>{isCompanyPortfolio ? 'Shows true company cash flow' : 'Portfolio companies only'}</small>
          </label>
        </div>
        <MetricBar keys={MONTHLY_SERIES_KEYS} visibleSeries={visibleSeries} scope={scope} onToggle={toggleSeries} />
        <PerformanceChart
          model={chartModel}
          visibleSeries={monthlyVisibleSeries}
          scope={scope}
          height={325}
          ariaLabel="Monthly Performance chart from recorded history through the selected forecast horizon"
        />
      </article>

      <article className="performance-v2-chart-card performance-v2-chart-card-capital">
        <div className="performance-v2-chart-head">
          <div><span className="performance-v2-control-label">Value & cumulative</span><h2>Value & accumulated cash</h2><p>{monthLabel(model.startMonth, true)} → {monthLabel(model.forecastEndMonth, true)} · past compares accumulated model vs Banking actuals · future continues the estimate</p></div>
        </div>
        <MetricBar keys={CAPITAL_SERIES_KEYS} visibleSeries={visibleSeries} scope={scope} onToggle={toggleSeries} />
        <p className="performance-v2-chart-note">Cash accumulated runs from the selected scope’s first acquisition month using the theoretical scenario. Actual bank accumulated is the running net of included Banking transactions from the first available Banking month and stops at the latest Banking data.</p>
        <PerformanceChart
          model={chartModel}
          visibleSeries={capitalVisibleSeries}
          scope={scope}
          height={365}
          ariaLabel="Value and accumulated cash Performance chart from recorded history through the selected forecast horizon"
        />
      </article>
    </div>

    <article className="performance-v2-inputs-card">
      <div className="performance-v2-section-head">
        <div><span className="performance-v2-control-label">Model inputs</span><h2>{scope === 'portfolio' ? 'Portfolio assumptions' : `${propertyName(scopedProperty)} assumptions`}</h2></div>
        {scope !== 'portfolio' && <button type="button" className="performance-v2-text-button" onClick={resetScopeInputs}>Use portfolio inputs</button>}
      </div>
      <div className="performance-v2-input-grid">
        <label>Rent growth<div className="performance-v2-percent-input"><BrainDrainNumericInput type="number" step="0.1" value={pctInput(assumptions.rentGrowthRate)} onChange={(event) => writeModelInput('rentGrowthRate', Number(event.target.value || 0) / 100)} /><span>% / yr</span></div></label>
        <label>HPI / appreciation<div className="performance-v2-percent-input"><BrainDrainNumericInput type="number" step="0.1" value={pctInput(assumptions.appreciationRate)} onChange={(event) => writeModelInput('appreciationRate', Number(event.target.value || 0) / 100)} /><span>% / yr</span></div></label>
        <label>Rate shock<div className="performance-v2-percent-input"><BrainDrainNumericInput type="number" step="0.1" value={pctInput(assumptions.rateShock)} onChange={(event) => writeModelInput('rateShock', Number(event.target.value || 0) / 100)} /><span>pp</span></div><small>Additive to current mortgage rate</small></label>
        <label>Shock starts <small>optional</small><BrainDrainNumericInput type="month" value={assumptions.rateShockStartMonth || ''} onChange={(event) => writeShockStart(event.target.value)} /><small>Blank = immediately</small></label>
      </div>
    </article>

    <article className="performance-v2-updates-card">
      <div className="performance-v2-section-head">
        <div><span className="performance-v2-control-label">Recorded inputs</span><h2>Rent & valuation updates</h2></div>
        <button type="button" className="performance-v2-primary small" onClick={newUpdate}><Plus size={16} /> Add update</button>
      </div>
      <Segmented label="Update type" value={updateKind} onChange={setUpdateKind} options={[{ value: 'rent', label: 'Rent' }, { value: 'valuation', label: 'Valuation' }]} className="performance-v2-update-tags" />
      <p className="performance-v2-update-help">New dated values take precedence automatically. If a range overlaps an older one, the older range is trimmed around it.</p>
      <div className={`performance-v2-update-list ${dragState ? 'is-reordering' : ''}`}>
        {visibleUpdates.length === 0 && <div className="performance-v2-update-empty">No {updateKind} updates recorded for this scope. The forecast uses the current property {updateKind === 'rent' ? 'rent' : 'valuation'}.</div>}
        {visibleUpdates.map((entry, index) => {
          const property = properties.find((candidate) => candidate.id === entry.propertyId)
          const isDragging = dragState?.id === entry.id
          const shift = updateDragShift(index)
          const dragOffset = isDragging ? dragState.currentY - dragState.startY : 0
          return <div
            key={entry.id}
            ref={(node) => {
              if (node) updateNodes.current.set(entry.id, node)
              else updateNodes.current.delete(entry.id)
            }}
            className={`performance-v2-update-row ${isDragging ? 'is-dragging' : ''}`}
            style={{
              '--performance-update-y': `${isDragging ? dragOffset : shift}px`,
              '--performance-update-scale': isDragging ? '1.012' : '1',
            }}
          >
            <button
              type="button"
              className="performance-v2-drag"
              aria-label={`Reorder ${entry.kind} update`}
              title="Drag to reorder"
              onPointerDown={(event) => beginUpdateDrag(event, entry, index)}
              onPointerMove={updateUpdateDrag}
              onPointerUp={(event) => finishUpdateDrag(event)}
              onPointerCancel={(event) => finishUpdateDrag(event, true)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  moveUpdate(index, index - 1)
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  moveUpdate(index, index + 1)
                }
              }}
            ><GripVertical size={18} /></button>
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
