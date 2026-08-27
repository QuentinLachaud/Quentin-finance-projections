import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { currency, projectPortfolio } from './calculations.js'
import { acquisitionJurisdictions, normalizeAcquisitionAssumptions } from './acquisition.js'
import { DEFAULT_EQUITY_RELEASE_TARGET_LTV, potentialEquityReleaseForProperty } from './equityRelease.js'
import { normalizeNextBtlPreferences } from './nextBtlPreferences.js'
import {
  DEFAULT_NEXT_BTL_APPRECIATION,
  DEFAULT_NEXT_BTL_MAX_MONTHS,
  NEXT_BTL_SCENARIOS,
  formatDurationMonths,
  formatProjectionMonth,
  projectTimeToNextBtl,
} from './nextBtlProjection.js'

const CHART_WIDTH = 760
const CHART_HEIGHT = 390
const MARGIN = { top: 28, right: 22, bottom: 52, left: 74 }
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const numberValue = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const equityOptionKey = (property, index = 0) => String(property?.id ?? `property-${index}`)
const defaultEquityReleaseOptions = (properties = []) => Object.fromEntries(properties.map((property, index) => [
  equityOptionKey(property, index),
  { enabled: false, targetLtv: DEFAULT_EQUITY_RELEASE_TARGET_LTV * 100 },
]))
const equityTargetPercent = (value) => value === ''
  ? DEFAULT_EQUITY_RELEASE_TARGET_LTV * 100
  : clamp(numberValue(value, DEFAULT_EQUITY_RELEASE_TARGET_LTV * 100), 0, 100)

const jurisdictionFromSettings = (settings = {}) => {
  if (settings.taxJurisdiction === 'scotland') return 'scotland'
  if (settings.taxJurisdiction === 'wales') return 'wales'
  return 'england-ni'
}

const assumptionSummary = (assumptions) => {
  const normalized = normalizeAcquisitionAssumptions(assumptions)
  const jurisdiction = acquisitionJurisdictions.find((item) => item.id === normalized.jurisdiction)?.label.split(' · ')[0] || 'England / Northern Ireland'
  const parts = [`${normalized.ltv.toFixed(normalized.ltv % 1 ? 1 : 0)}% LTV`, jurisdiction]
  if (normalized.jurisdiction === 'scotland') parts.push(`${normalized.adsRate.toFixed(normalized.adsRate % 1 ? 1 : 0)}% ADS`)
  parts.push(`${currency(normalized.legalFees)} legal`)
  if (normalized.mortgageFee > 0) parts.push(normalized.mortgageFeeAddedToLoan ? 'fee financed' : 'fee upfront')
  else parts.push('no product fee')
  return parts.join(' · ')
}

const compactMoney = (value) => {
  const amount = Math.max(0, Number(value || 0))
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}m`
  if (amount >= 1000) return `£${Math.round(amount / 1000)}k`
  return `£${Math.round(amount)}`
}

const stepPath = (points, x, y) => {
  if (!points.length) return ''
  let path = `M ${x(points[0].month)} ${y(points[0].buyingPower)}`
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    path += ` H ${x(point.month)} V ${y(point.buyingPower)}`
  }
  return path
}

const linePath = (points, x, y) => points.length
  ? points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.month)} ${y(point.targetPrice)}`).join(' ')
  : ''

export function PurchaseAssumptionsSheet({ draft, onChange, onCancel, onSave }) {
  const normalized = normalizeAcquisitionAssumptions(draft)
  const setNumber = (key) => (event) => onChange({ ...draft, [key]: event.target.value === '' ? '' : Number(event.target.value) })

  return <div className="next-btl-sheet-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <form className="next-btl-sheet" role="dialog" aria-modal="true" aria-labelledby="next-btl-sheet-title" onSubmit={(event) => { event.preventDefault(); onSave() }}>
      <header>
        <button type="button" onClick={onCancel}>Cancel</button>
        <div><span>PURCHASE FUNDING</span><h3 id="next-btl-sheet-title">Purchase assumptions</h3></div>
        <button type="submit" className="done">Done</button>
      </header>
      <div className="next-btl-sheet-body">
        <label className="next-btl-field"><span>Purchase tax regime</span><select value={normalized.jurisdiction} onChange={(event) => onChange({ ...draft, jurisdiction: event.target.value })}>{acquisitionJurisdictions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label className="next-btl-field"><span>LTV</span><div><input aria-label="Next BTL LTV" type="number" min="0" max="100" step="1" value={draft.ltv} onChange={setNumber('ltv')} /><em>%</em></div></label>
        {normalized.jurisdiction === 'scotland' && <label className="next-btl-field"><span>ADS</span><div><input aria-label="Next BTL ADS" type="number" min="0" step=".1" value={draft.adsRate} onChange={setNumber('adsRate')} /><em>%</em></div></label>}
        <label className="next-btl-field"><span>Solicitor / legal fees</span><div><b>£</b><input aria-label="Next BTL legal fees" type="number" min="0" step="50" value={draft.legalFees} onChange={setNumber('legalFees')} /></div></label>
        <label className="next-btl-field"><span>Mortgage product fee</span><div><b>£</b><input aria-label="Next BTL mortgage fee" type="number" min="0" step="50" value={draft.mortgageFee} onChange={setNumber('mortgageFee')} /></div></label>
        <label className="next-btl-switch-row"><span><b>Add mortgage fee to loan</b><small>Turn off to include it in completion cash.</small></span><input aria-label="Add next BTL mortgage fee to loan" type="checkbox" checked={draft.mortgageFeeAddedToLoan !== false} onChange={(event) => onChange({ ...draft, mortgageFeeAddedToLoan: event.target.checked })} /><i /></label>
      </div>
    </form>
  </div>
}

function TimeToNextBtlChart({ result, intro }) {
  const [hoverPoint, setHoverPoint] = useState(null)
  const crossingMonth = result.crossing?.month
  const fullPoints = result.points || []
  const hasEquityRelease = Number(result.equityReleaseSelectedCount || 0) > 0
  const horizon = result.crossing
    ? Math.min(result.maxMonths, Math.max(24, crossingMonth + 12))
    : result.maxMonths
  const points = fullPoints.filter((point) => point.month <= horizon)
  const yMaximumRaw = Math.max(1, ...points.flatMap((point) => [point.targetPrice, point.buyingPower]))
  const yMaximum = yMaximumRaw * 1.08
  const x = (month) => MARGIN.left + (horizon ? month / horizon : 0) * PLOT_WIDTH
  const y = (value) => MARGIN.top + PLOT_HEIGHT - clamp(Number(value || 0) / yMaximum, 0, 1) * PLOT_HEIGHT
  const buyingPath = stepPath(points, x, y)
  const targetPath = linePath(points, x, y)
  const crossing = result.crossing && result.crossing.month <= horizon ? result.crossing : null
  const xTicks = [...new Set([0, Math.round(horizon * .25), Math.round(horizon * .5), Math.round(horizon * .75), horizon])]
  const yTicks = [0, .25, .5, .75, 1].map((ratio) => yMaximum * ratio)

  const inspect = (event) => {
    if (!points.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const viewX = (event.clientX - rect.left) / Math.max(1, rect.width) * CHART_WIDTH
    const month = clamp(Math.round((viewX - MARGIN.left) / PLOT_WIDTH * horizon), 0, horizon)
    setHoverPoint(points[Math.min(points.length - 1, month)] || null)
  }

  const summary = result.status === 'ready'
    ? `Ready now. Current deployable cash funds the target BTL.`
    : result.status === 'reached'
      ? `Purchase-ready in ${result.crossing.month} months, ${formatDurationMonths(result.crossing.month)}, around ${formatProjectionMonth(result.crossing.date)}.`
      : result.status === 'not-reached'
        ? `The target BTL is not reached within ${Math.round(result.maxMonths / 12)} years under these assumptions.`
        : 'Enter a valid BTL price to calculate purchase timing.'

  return <figure className={`next-btl-chart ${intro ? 'intro' : 'settled'}`}>
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="BTL buying power compared with target BTL price over time" onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={() => setHoverPoint(null)}>
      <g className="next-btl-grid" aria-hidden="true">
        {yTicks.map((tick) => <g key={tick}><line x1={MARGIN.left} x2={CHART_WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} /><text x={MARGIN.left - 12} y={y(tick) + 4} textAnchor="end">{compactMoney(tick)}</text></g>)}
        {xTicks.map((tick) => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={MARGIN.top + PLOT_HEIGHT} /><text x={x(tick)} y={CHART_HEIGHT - 20} textAnchor="middle">{tick === 0 ? 'Now' : `${tick}m`}</text></g>)}
      </g>
      <path className="next-btl-target-path" pathLength="1" d={targetPath} />
      <path className="next-btl-buying-path" pathLength="1" d={buyingPath} />
      {crossing && <>
        <line className="next-btl-cross-guide" pathLength="1" x1={x(crossing.month)} x2={x(crossing.month)} y1={y(crossing.buyingPower)} y2={MARGIN.top + PLOT_HEIGHT} />
        <circle className="next-btl-cross-ripple" cx={x(crossing.month)} cy={y(crossing.buyingPower)} r="7" />
        <circle className="next-btl-cross-dot" cx={x(crossing.month)} cy={y(crossing.buyingPower)} r="5" />
        <text className="next-btl-cross-label" x={x(crossing.month)} y={CHART_HEIGHT - 2} textAnchor="middle">{crossing.month} months</text>
      </>}
      <g className="next-btl-legend" aria-hidden="true">
        <g><line className="buying" x1={MARGIN.left} x2={MARGIN.left + 24} y1="14" y2="14" /><text x={MARGIN.left + 31} y="18">Buying power</text></g>
        <g transform="translate(126 0)"><line className="target" x1={MARGIN.left} x2={MARGIN.left + 24} y1="14" y2="14" /><text x={MARGIN.left + 31} y="18">Target BTL price</text></g>
      </g>
      {hoverPoint && <g className="next-btl-tooltip" transform={`translate(${CHART_WIDTH - 226} 36)`}>
        <rect width="204" height={hasEquityRelease ? 137 : 118} rx="12" />
        <text className="title" x="14" y="21">{hoverPoint.month === 0 ? 'Now' : formatProjectionMonth(hoverPoint.date)}</text>
        <text x="14" y="43">Buying power <tspan x="190" textAnchor="end">{currency(hoverPoint.buyingPower)}</tspan></text>
        <text x="14" y="62">Target price <tspan x="190" textAnchor="end">{currency(hoverPoint.targetPrice)}</tspan></text>
        <text x="14" y="81">Available cash <tspan x="190" textAnchor="end">{currency(hoverPoint.availableCash)}</tspan></text>
        <text x="14" y="100">Cash required <tspan x="190" textAnchor="end">{currency(hoverPoint.cashRequired)}</tspan></text>
        {hasEquityRelease && <text x="14" y="119">Equity release <tspan x="190" textAnchor="end">{currency(hoverPoint.potentialEquityRelease)}</tspan></text>}
      </g>}
    </svg>
    <figcaption>{summary}</figcaption>
  </figure>
}

export default function TimeToNextBtl({
  properties = [],
  settings = {},
  portfolio,
  acquisitions = [],
  projectionPoints: suppliedProjectionPoints = null,
  now: suppliedNow = null,
  initialTargetPrice = null,
  initialAssumptions = null,
  preferences = {},
  onPreferencesChange = null,
  className = '',
}) {
  const savedAcquisitions = useMemo(
    () => acquisitions.filter((item) => Number(item?.purchasePrice || 0) > 0),
    [acquisitions],
  )
  const firstSavedAcquisition = savedAcquisitions[0] || null
  const explicitManualSeed = initialTargetPrice != null || initialAssumptions != null
  const initialPreferences = useRef(normalizeNextBtlPreferences(preferences)).current
  const preferredSavedAcquisition = savedAcquisitions.find((item) => item.id === initialPreferences.selectedAcquisitionId) || firstSavedAcquisition
  const initialTargetSource = explicitManualSeed
    ? 'manual'
    : initialPreferences.targetSource === 'manual'
      ? 'manual'
      : initialPreferences.targetSource === 'saved' && preferredSavedAcquisition
        ? 'saved'
        : firstSavedAcquisition ? 'saved' : 'manual'
  const [targetSource, setTargetSource] = useState(initialTargetSource)
  const [selectedAcquisitionId, setSelectedAcquisitionId] = useState(() => preferredSavedAcquisition?.id || '')
  const [targetPrice, setTargetPrice] = useState(() => Number(initialTargetPrice ?? initialPreferences.targetPrice ?? preferredSavedAcquisition?.purchasePrice ?? 180000))
  const [appreciationPercent, setAppreciationPercent] = useState(() => initialPreferences.appreciationPercent ?? DEFAULT_NEXT_BTL_APPRECIATION * 100)
  const [scenarioIndex, setScenarioIndex] = useState(() => initialPreferences.scenarioIndex ?? 0)
  const [preserveBuffer, setPreserveBuffer] = useState(() => initialPreferences.preserveBuffer ?? true)
  const [includeExtraction, setIncludeExtraction] = useState(() => initialPreferences.includeExtraction ?? false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [equityReleaseOptions, setEquityReleaseOptions] = useState(() => {
    const defaults = defaultEquityReleaseOptions(properties)
    for (const key of Object.keys(defaults)) {
      const saved = initialPreferences.equityReleaseOptions?.[key]
      if (!saved) continue
      defaults[key] = {
        enabled: saved.enabled === true,
        targetLtv: equityTargetPercent(saved.targetLtv),
      }
    }
    return defaults
  })
  const [assumptions, setAssumptions] = useState(() => normalizeAcquisitionAssumptions(initialAssumptions || initialPreferences.assumptions || preferredSavedAcquisition || {
    jurisdiction: jurisdictionFromSettings(settings),
    ltv: 75,
    adsRate: 8,
    legalFees: 1500,
    mortgageFee: 0,
    mortgageFeeAddedToLoan: true,
  }))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [assumptionDraft, setAssumptionDraft] = useState(assumptions)
  const [intro, setIntro] = useState(true)
  const nowRef = useRef(suppliedNow instanceof Date ? suppliedNow : new Date())
  const onPreferencesChangeRef = useRef(onPreferencesChange)
  useEffect(() => { onPreferencesChangeRef.current = onPreferencesChange }, [onPreferencesChange])
  const isCompany = settings.accountType !== 'private'
  const selectedAcquisition = savedAcquisitions.find((item) => item.id === selectedAcquisitionId) || null
  const usingSavedAcquisition = targetSource === 'saved' && Boolean(selectedAcquisition)
  const effectiveTargetPrice = usingSavedAcquisition ? Number(selectedAcquisition.purchasePrice || 0) : numberValue(targetPrice)
  const effectiveAssumptions = useMemo(
    () => usingSavedAcquisition ? normalizeAcquisitionAssumptions(selectedAcquisition) : assumptions,
    [usingSavedAcquisition, selectedAcquisition, assumptions],
  )
  const equityReleaseRows = useMemo(() => properties.map((property, index) => {
    const key = equityOptionKey(property, index)
    const option = equityReleaseOptions[key] || { enabled: false, targetLtv: DEFAULT_EQUITY_RELEASE_TARGET_LTV * 100 }
    const targetLtv = equityTargetPercent(option.targetLtv) / 100
    return {
      key,
      property,
      option,
      detail: potentialEquityReleaseForProperty({
        property,
        targetLtv,
        annualAppreciationRate: numberValue(settings.appreciationRate),
        month: 0,
      }),
    }
  }), [properties, equityReleaseOptions, settings.appreciationRate])
  const selectedEquityReleaseCount = equityReleaseRows.filter((row) => row.option.enabled === true).length
  const equityReleaseSelections = useMemo(() => Object.fromEntries(equityReleaseRows.map((row) => [
    row.key,
    { enabled: row.option.enabled === true, targetLtv: equityTargetPercent(row.option.targetLtv) / 100 },
  ])), [equityReleaseRows])
  const targetContext = usingSavedAcquisition
    ? `${selectedAcquisition.name || 'Saved acquisition'} · ${currency(effectiveTargetPrice)}`
    : `Manual target · ${currency(effectiveTargetPrice)}`

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 3300)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (targetSource !== 'saved') return
    if (selectedAcquisition) return
    if (firstSavedAcquisition) {
      setSelectedAcquisitionId(firstSavedAcquisition.id)
      return
    }
    setTargetSource('manual')
  }, [targetSource, selectedAcquisition, firstSavedAcquisition])

  useEffect(() => {
    setEquityReleaseOptions((current) => {
      const next = {}
      let changed = Object.keys(current).length !== properties.length
      properties.forEach((property, index) => {
        const key = equityOptionKey(property, index)
        if (current[key]) next[key] = current[key]
        else {
          changed = true
          next[key] = { enabled: false, targetLtv: DEFAULT_EQUITY_RELEASE_TARGET_LTV * 100 }
        }
      })
      return changed ? next : current
    })
  }, [properties])

  useEffect(() => {
    if (typeof onPreferencesChangeRef.current !== 'function') return
    onPreferencesChangeRef.current(normalizeNextBtlPreferences({
      targetSource,
      selectedAcquisitionId,
      targetPrice,
      appreciationPercent,
      scenarioIndex,
      preserveBuffer,
      includeExtraction,
      assumptions,
      equityReleaseOptions,
    }))
  }, [
    targetSource,
    selectedAcquisitionId,
    targetPrice,
    appreciationPercent,
    scenarioIndex,
    preserveBuffer,
    includeExtraction,
    assumptions,
    equityReleaseOptions,
  ])

  useEffect(() => {
    if (!sheetOpen) return undefined
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keydown = (event) => event.key === 'Escape' && setSheetOpen(false)
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = oldOverflow
      document.removeEventListener('keydown', keydown)
    }
  }, [sheetOpen])

  const projectionPoints = useMemo(() => Array.isArray(suppliedProjectionPoints)
    ? suppliedProjectionPoints
    : projectPortfolio(properties, settings, DEFAULT_NEXT_BTL_MAX_MONTHS, nowRef.current), [properties, settings, suppliedProjectionPoints])

  const result = useMemo(() => projectTimeToNextBtl({
    properties,
    settings,
    portfolio,
    projectionPoints,
    targetPriceToday: effectiveTargetPrice,
    annualAppreciationRate: numberValue(appreciationPercent, 3.25) / 100,
    acquisitionAssumptions: effectiveAssumptions,
    scenarioIndex,
    preserveBuffer,
    includeExtraction,
    equityReleaseSelections,
    maxMonths: DEFAULT_NEXT_BTL_MAX_MONTHS,
    now: nowRef.current,
  }), [properties, settings, portfolio, projectionPoints, effectiveTargetPrice, appreciationPercent, effectiveAssumptions, scenarioIndex, preserveBuffer, includeExtraction, equityReleaseSelections])

  const openingAssumptions = () => {
    setAssumptionDraft({ ...assumptions })
    setSheetOpen(true)
  }

  const saveAssumptions = () => {
    setAssumptions(normalizeAcquisitionAssumptions(assumptionDraft))
    setSheetOpen(false)
  }

  const updateEquityReleaseOption = (key, patch) => setEquityReleaseOptions((current) => ({
    ...current,
    [key]: { ...(current[key] || { enabled: false, targetLtv: DEFAULT_EQUITY_RELEASE_TARGET_LTV * 100 }), ...patch },
  }))

  const crossing = result.crossing
  const resultPrimary = result.status === 'ready'
    ? 'Ready now'
    : result.status === 'reached'
      ? `${crossing.month} months`
      : result.status === 'not-reached'
        ? 'Not reached within 50 years'
        : 'Enter a BTL price'
  const resultSecondary = result.status === 'reached'
    ? `${formatDurationMonths(crossing.month)} · ${formatProjectionMonth(crossing.date)}`
    : result.status === 'ready'
      ? 'Current deployable cash already covers completion cash.'
      : result.status === 'not-reached'
        ? 'Buying power does not catch the appreciating target inside the model horizon.'
        : 'Use a positive purchase price to begin.'
  const referencePoint = crossing || result.points?.[0]

  return <section className={`panel next-btl-panel ${className}`.trim()}>
    <header className="next-btl-heading">
      <div><span className="kicker">PURCHASE TIMING</span><h2>Time to next BTL</h2><p>See when accumulated deployable cash can fund the next acquisition as its target price moves over time.</p></div>
    </header>

    <div className="next-btl-layout">
      <aside className="next-btl-controls" aria-label="Time to next BTL assumptions">
        <div className="next-btl-target-control">
          <span className="next-btl-control-label">Target BTL</span>
          <div className="next-btl-source-segmented" role="group" aria-label="Target BTL source">
            <button type="button" className={targetSource === 'manual' ? 'active' : ''} aria-pressed={targetSource === 'manual'} onClick={() => setTargetSource('manual')}>Manual price</button>
            <button type="button" className={targetSource === 'saved' ? 'active' : ''} aria-pressed={targetSource === 'saved'} disabled={!savedAcquisitions.length} onClick={() => {
              const next = selectedAcquisition || firstSavedAcquisition
              if (!next) return
              setSelectedAcquisitionId(next.id)
              setTargetSource('saved')
            }}>Saved acquisition</button>
          </div>
          {usingSavedAcquisition
            ? <label className="next-btl-field prominent saved-target"><span>Saved acquisition</span><select aria-label="Saved acquisition target" value={selectedAcquisitionId} onChange={(event) => setSelectedAcquisitionId(event.target.value)}>{savedAcquisitions.map((item) => <option value={item.id} key={item.id}>{item.name || 'Untitled acquisition'} · {currency(item.purchasePrice)}</option>)}</select><small>Price and funding assumptions stay linked to the selected acquisition card.</small></label>
            : <label className="next-btl-field prominent"><span>BTL price today</span><div><b>£</b><input aria-label="BTL price today" inputMode="numeric" type="number" min="0" step="1000" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value === '' ? '' : Number(event.target.value))} /></div>{!savedAcquisitions.length && <small>Add an acquisition below to use a saved card instead.</small>}</label>}
        </div>

        <div className="next-btl-control-group">
          <span className="next-btl-control-label">Scenario</span>
          <div className="next-btl-segmented" role="group" aria-label="Cash-flow scenario">
            {NEXT_BTL_SCENARIOS.map((scenario) => <button key={scenario.id} type="button" className={scenario.id === scenarioIndex ? 'active' : ''} aria-pressed={scenario.id === scenarioIndex} onClick={() => setScenarioIndex(scenario.id)}>{scenario.label}</button>)}
          </div>
        </div>

        <label className="next-btl-switch-row"><span><b>Preserve 6-month buffer</b><small>Only cash above six months of current operating costs can fund the purchase.</small></span><input aria-label="Preserve 6-month buffer" type="checkbox" checked={preserveBuffer} onChange={(event) => setPreserveBuffer(event.target.checked)} /><i /></label>

        <label className={`next-btl-switch-row ${isCompany ? '' : 'disabled'}`}><span><b>Include extraction</b><small>{isCompany ? 'Assumes extracted cash remains or becomes available again for acquisition funding.' : 'Not applicable to a private-landlord portfolio.'}</small></span><input aria-label="Include extraction" type="checkbox" disabled={!isCompany} checked={isCompany && includeExtraction} onChange={(event) => setIncludeExtraction(event.target.checked)} /><i /></label>

        <label className="next-btl-field"><span>BTL appreciation</span><div><input aria-label="BTL appreciation" type="number" min="-20" max="30" step="0.25" value={appreciationPercent} onChange={(event) => setAppreciationPercent(event.target.value === '' ? '' : Number(event.target.value))} /><em>% p.a.</em></div></label>

        <div className="next-btl-surplus-card" aria-label="Starting surplus cash">
          <span>Starting surplus cash</span>
          <strong>{currency(result.startingSurplus)}</strong>
          <small>{preserveBuffer ? 'Available above your 6-month buffer' : 'All current company cash available'}</small>
          {preserveBuffer && <small className="reserve">Reserve protected: {currency(result.reserveCash)}</small>}
        </div>

        {usingSavedAcquisition
          ? <div className="next-btl-assumptions-button linked" aria-label={`Purchase assumptions linked to ${selectedAcquisition.name || 'saved acquisition'}`}>
              <span><b>Purchase assumptions · linked</b><small>{assumptionSummary(effectiveAssumptions)}</small><small className="source-note">Managed by {selectedAcquisition.name || 'the selected acquisition card'}.</small></span>
            </div>
          : <button type="button" className="next-btl-assumptions-button" onClick={openingAssumptions} aria-haspopup="dialog">
              <span><b>Purchase assumptions</b><small>{assumptionSummary(assumptions)}</small></span><ChevronRight size={18} />
            </button>}

        <section className={`next-btl-advanced ${advancedOpen ? 'open' : ''}`}>
          <button type="button" className="next-btl-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
            <span><span className="advanced-kicker">ADVANCED</span><b>Potential equity release</b><small>{selectedEquityReleaseCount ? `${selectedEquityReleaseCount} BTL${selectedEquityReleaseCount === 1 ? '' : 's'} selected` : 'Optional · no BTLs selected'}</small></span>
            <span className="next-btl-advanced-value">{selectedEquityReleaseCount ? currency(result.equityReleaseNow) : 'Off'}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <div className="next-btl-advanced-body" hidden={!advancedOpen}>
            <p className="next-btl-advanced-note">At the modeled purchase month, selected BTLs are hypothetically refinanced back to their chosen target LTV. Existing-property appreciation follows Portfolio assumptions. This is gross potential capacity; lender eligibility, ERCs and refinance costs are not deducted.</p>
            {equityReleaseRows.length
              ? <div className="next-btl-equity-list">{equityReleaseRows.map((row) => {
                  const name = row.property.name || 'BTL'
                  const targetPercent = row.option.targetLtv === '' ? '' : equityTargetPercent(row.option.targetLtv)
                  return <div className={`next-btl-equity-property ${row.option.enabled ? 'included' : ''}`} key={row.key}>
                    <div className="next-btl-equity-property-head">
                      <label className="next-btl-equity-switch" title={`Include ${name} potential equity release`}>
                        <input aria-label={`Include ${name} potential equity release`} type="checkbox" checked={row.option.enabled === true} onChange={(event) => updateEquityReleaseOption(row.key, { enabled: event.target.checked })} /><i />
                      </label>
                      <span className="next-btl-equity-name"><b>{name}</b><small>{currency(row.detail.currentValue)} value · {(row.detail.currentLtv * 100).toFixed(1)}% current LTV</small></span>
                      <span className="next-btl-equity-now"><span>Potential now</span><b>{currency(row.detail.release)}</b></span>
                    </div>
                    <label className="next-btl-equity-ltv"><span>Refinance to</span><div><input aria-label={`${name} target equity release LTV`} type="number" min="0" max="100" step="1" inputMode="decimal" value={targetPercent} onChange={(event) => updateEquityReleaseOption(row.key, { targetLtv: event.target.value === '' ? '' : Number(event.target.value) })} onBlur={() => row.option.targetLtv === '' && updateEquityReleaseOption(row.key, { targetLtv: DEFAULT_EQUITY_RELEASE_TARGET_LTV * 100 })} /><em>% LTV</em></div></label>
                  </div>
                })}</div>
              : <p className="next-btl-advanced-note">No included BTLs are available for hypothetical equity release.</p>}
          </div>
        </section>
      </aside>

      <div className="next-btl-visual">
        <div className={`next-btl-result ${intro ? 'intro' : 'settled'} ${result.status}`} aria-live="polite">
          <small className="next-btl-target-context">{targetContext}</small>
          <span>ESTIMATED PURCHASE WINDOW</span>
          <strong>{resultPrimary}</strong>
          <p>{resultSecondary}</p>
          {referencePoint && result.status !== 'invalid' && <div className="next-btl-result-metrics">
            <div><span>{crossing ? 'Future target BTL' : 'Target BTL today'}</span><b>{currency(referencePoint.targetPrice)}</b></div>
            <div><span>Cash required</span><b>{currency(referencePoint.cashRequired)}</b></div>
            {result.equityReleaseSelectedCount > 0 && <div><span>Potential equity release</span><b>{currency(referencePoint.potentialEquityRelease)}</b></div>}
          </div>}
        </div>
        {result.points.length > 0 && <TimeToNextBtlChart result={result} intro={intro} />}
      </div>
    </div>

    {sheetOpen && <PurchaseAssumptionsSheet draft={assumptionDraft} onChange={setAssumptionDraft} onCancel={() => setSheetOpen(false)} onSave={saveAssumptions} />}
  </section>
}
