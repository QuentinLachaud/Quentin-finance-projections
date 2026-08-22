import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, Copy, LockKeyhole, Plus, Trash2, X } from 'lucide-react'
import {
  calculateRemortgageScenario,
  compareRemortgageScenarios,
  createRemortgageComparison,
  duplicateRemortgageComparison,
  roundedLtv,
  updateRemortgageScenario,
} from './remortgage.js'

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})
const rate = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const signedMoney = (value) => `${value >= 0 ? '+' : '−'}${money.format(Math.abs(value))}`
const signedPercent = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)} pp`

const RESULT_ANIMATION_MS = 1250

const easeOutCubic = (progress) => 1 - ((1 - progress) ** 3)

function useAnimatedNumber(targetValue, duration = RESULT_ANIMATION_MS) {
  const target = Number(targetValue || 0)
  const [displayValue, setDisplayValue] = useState(target)
  const currentValueRef = useRef(target)

  useEffect(() => {
    if (!Number.isFinite(target)) return undefined

    const prefersReducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || typeof requestAnimationFrame !== 'function') {
      currentValueRef.current = target
      setDisplayValue(target)
      return undefined
    }

    const startValue = currentValueRef.current
    const delta = target - startValue
    if (Math.abs(delta) < 0.005) {
      currentValueRef.current = target
      setDisplayValue(target)
      return undefined
    }

    let animationFrame = 0
    const startTime = performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration)
      const nextValue = startValue + (delta * easeOutCubic(progress))
      currentValueRef.current = nextValue
      setDisplayValue(nextValue)
      if (progress < 1) animationFrame = requestAnimationFrame(tick)
      else currentValueRef.current = target
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [target, duration])

  return displayValue
}

const parseFriendlyNumber = (value) => {
  const cleaned = String(value ?? '').replace(/[£,%\s]/g, '').replace(/,/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '-') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const formatFriendlyNumber = (value, decimals = 0) => new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(Number(value || 0))

function FriendlyNumberField({
  label,
  prefix,
  suffix,
  value,
  decimals = 0,
  integer = false,
  onChange,
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(formatFriendlyNumber(value, decimals))

  useEffect(() => {
    if (!focused) setDraft(formatFriendlyNumber(value, decimals))
  }, [value, decimals, focused])

  const commitDraft = (nextDraft) => {
    setDraft(nextDraft)
    const parsed = parseFriendlyNumber(nextDraft)
    if (parsed == null) return
    onChange(integer ? Math.round(parsed) : parsed)
  }

  return <label className="remortgage-field">
    <span>{label}</span>
    <div>
      {prefix && <b>{prefix}</b>}
      <input
        type="text"
        inputMode="decimal"
        value={focused ? draft : formatFriendlyNumber(value, decimals)}
        onFocus={(event) => {
          setFocused(true)
          setDraft(String(integer ? Math.round(Number(value || 0)) : Number(value || 0)))
          requestAnimationFrame(() => event.target.select())
        }}
        onChange={(event) => commitDraft(event.target.value)}
        onBlur={() => setFocused(false)}
      />
      {suffix && <b>{suffix}</b>}
    </div>
  </label>
}

const propertyCashFlowBeforeMortgage = (property) => {
  if (!property) return 0
  const nonMortgageFixedCosts = Number(property.fixedCosts || 0) - Number(property.monthlyPayment || 0)
  return Number(property.rent || 0) - nonMortgageFixedCosts - Number(property.variableCosts || 0)
}

const optionCashFlow = (property, scenarioResult) =>
  propertyCashFlowBeforeMortgage(property) - Number(scenarioResult.monthlyInterest || 0)

function ScenarioCard({ title, rateLabel, scenario, property, onChange }) {
  const result = calculateRemortgageScenario(scenario)
  const cashFlow = optionCashFlow(property, result)
  const animatedMortgageCost = useAnimatedNumber(result.monthlyInterest)
  const animatedCashFlow = useAnimatedNumber(cashFlow)
  const update = (key) => (value) => onChange(updateRemortgageScenario(scenario, key, value))

  return <section className="remortgage-scenario-card">
    <header>
      <span className="remortgage-scenario-title">{title}</span>
      <div className="remortgage-scenario-rate-metric">
        <small>{rateLabel}</small>
        <strong>{rate.format(scenario.rate)}%</strong>
      </div>
      <div className="remortgage-scenario-cost-metric">
        <small>Monthly mortgage cost</small>
        <strong>{money.format(animatedMortgageCost)}<small> / month</small></strong>
      </div>
      {property && <div className="remortgage-scenario-cashflow-metric">
        <small>True cash flow</small>
        <b>{money.format(animatedCashFlow)} / month</b>
        <span>Rent minus property costs and mortgage</span>
      </div>}
      {!property && <small className="remortgage-scenario-manual-note">Mortgage-only comparison · property cash flow unavailable</small>}
    </header>

    <div className="remortgage-fields remortgage-cashflow-fields">
      <FriendlyNumberField
        label={rateLabel}
        suffix="%"
        value={scenario.rate}
        decimals={2}
        onChange={update('rate')}
      />

      <FriendlyNumberField
        label="Loan amount"
        prefix="£"
        value={scenario.loanAmount}
        onChange={update('loanAmount')}
      />

      <div className="remortgage-fee-block">
        <div className="remortgage-fee-heading">
          <span>Product fee</span>
          <div className="remortgage-segmented">
            <button
              type="button"
              className={scenario.feeMode !== 'amount' ? 'active' : ''}
              onClick={() => onChange(updateRemortgageScenario(scenario, 'feeMode', 'percent'))}
            >
              % of loan
            </button>
            <button
              type="button"
              className={scenario.feeMode === 'amount' ? 'active' : ''}
              onClick={() => onChange(updateRemortgageScenario(scenario, 'feeMode', 'amount'))}
            >
              £ amount
            </button>
          </div>
        </div>

        <FriendlyNumberField
          label={scenario.feeMode === 'amount' ? 'Fee amount' : 'Fee percentage'}
          prefix={scenario.feeMode === 'amount' ? '£' : undefined}
          suffix={scenario.feeMode === 'amount' ? undefined : '%'}
          value={scenario.feeValue}
          decimals={scenario.feeMode === 'amount' ? 0 : 2}
          onChange={update('feeValue')}
        />

        <label className="remortgage-switch-row">
          <span>
            <b>Add fee to loan</b>
            <small>Only financed fees affect monthly cash flow.</small>
          </span>
          <input
            type="checkbox"
            checked={Boolean(scenario.addFeeToLoan)}
            onChange={(event) => update('addFeeToLoan')(event.target.checked)}
          />
          <i />
        </label>
      </div>
    </div>
  </section>
}

function DifferenceCard({ comparison, property }) {
  const diff = compareRemortgageScenarios(comparison.left, comparison.right)
  const leftCashFlow = optionCashFlow(property, diff.left)
  const rightCashFlow = optionCashFlow(property, diff.right)
  const cashFlowChange = rightCashFlow - leftCashFlow
  const animatedCashFlowChange = useAnimatedNumber(cashFlowChange)
  const animatedLoanChange = useAnimatedNumber(diff.loanChange)
  const animatedLtvChange = useAnimatedNumber(diff.ltvChange)
  const animatedRateChange = useAnimatedNumber(diff.rateChange)
  const animatedFeeChange = useAnimatedNumber(diff.feeChange)
  const animatedUpfrontFeeChange = useAnimatedNumber(diff.upfrontFeeChange)
  const animatedEquityRelease = useAnimatedNumber(diff.equityRelease)
  const positive = animatedCashFlowChange >= 0
  const equityReleasePositive = animatedEquityRelease >= 0

  return <section className={`remortgage-difference-card ${positive ? 'positive' : 'negative'}`}>
    <span className="kicker">NEW MORTGAGE VS CURRENT</span>

    <div className="remortgage-impact">
      <small>{property ? 'True cash-flow difference' : 'Monthly mortgage saving'}</small>
      <strong>{signedMoney(animatedCashFlowChange)}</strong>
      <span>{signedMoney(animatedCashFlowChange * 12)} / year</span>
    </div>

    <dl>
      <div><dt>Loan balance</dt><dd>{signedMoney(animatedLoanChange)}</dd></div>
      <div><dt>LTV</dt><dd>{signedPercent(animatedLtvChange)}</dd></div>
      <div><dt>Interest rate</dt><dd>{signedPercent(animatedRateChange)}</dd></div>
      <div><dt>Product fee</dt><dd>{signedMoney(animatedFeeChange)}</dd></div>
      <div><dt>Upfront cash</dt><dd>{signedMoney(animatedUpfrontFeeChange)}</dd></div>
      <div className="equity-release-row">
        <dt>Equity release</dt>
        <dd className={equityReleasePositive ? 'good' : 'bad'}>{signedMoney(animatedEquityRelease)}</dd>
      </div>
    </dl>
  </section>
}

const isMobileRemortgageViewport = () => {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') return window.matchMedia('(max-width: 680px)').matches
  return Number(window.innerWidth || 1024) <= 680
}

const scenarioAtPropertyValue = (scenario, propertyValue) => updateRemortgageScenario(
  { ...scenario, loanBasis: 'loan' },
  'propertyValue',
  propertyValue,
)

const comparisonAtPropertyValue = (comparison, propertyValue) => ({
  ...comparison,
  left: scenarioAtPropertyValue(comparison.left, propertyValue),
  right: scenarioAtPropertyValue(comparison.right, propertyValue),
})

function MobileSingleValueEditor({
  title,
  value,
  prefix,
  suffix,
  decimals = 0,
  onCancel,
  onCommit,
}) {
  const [draftValue, setDraftValue] = useState(String(Number(value || 0)))
  const parsed = parseFriendlyNumber(draftValue)

  return <div className="mobile-remortgage-field-layer">
    <section className="mobile-remortgage-field-modal" role="dialog" aria-modal="true" aria-label={`Edit ${title}`}>
      <header>
        <small>EDIT ONE VALUE</small>
        <h3>{title}</h3>
      </header>
      <div className="mobile-remortgage-focused-input">
        {prefix && <b>{prefix}</b>}
        <input
          autoFocus
          aria-label={title}
          type="text"
          inputMode="decimal"
          value={draftValue}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && parsed != null) onCommit(parsed)
            if (event.key === 'Escape') onCancel()
          }}
        />
        {suffix && <b>{suffix}</b>}
      </div>
      <footer>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-button" disabled={parsed == null} onClick={() => onCommit(parsed)}>
          Done
        </button>
      </footer>
    </section>
  </div>
}

function MobileFeeEditor({ scenario, onCancel, onCommit }) {
  const [draftScenario, setDraftScenario] = useState(() => ({ ...scenario }))
  const [draftValue, setDraftValue] = useState(String(Number(scenario.feeValue || 0)))
  const parsed = parseFriendlyNumber(draftValue)
  const update = (key, value) => setDraftScenario((current) => updateRemortgageScenario(current, key, value))

  const save = () => {
    if (parsed == null) return
    onCommit(updateRemortgageScenario(draftScenario, 'feeValue', parsed))
  }

  return <div className="mobile-remortgage-field-layer">
    <section className="mobile-remortgage-field-modal mobile-remortgage-fee-modal" role="dialog" aria-modal="true" aria-label="Edit product fee">
      <header>
        <small>REMORTGAGE FEE</small>
        <h3>Product fee</h3>
      </header>

      <div className="remortgage-segmented mobile-remortgage-fee-mode" aria-label="Product fee type">
        <button
          type="button"
          className={draftScenario.feeMode !== 'amount' ? 'active' : ''}
          onClick={() => update('feeMode', 'percent')}
        >% of loan</button>
        <button
          type="button"
          className={draftScenario.feeMode === 'amount' ? 'active' : ''}
          onClick={() => update('feeMode', 'amount')}
        >£ amount</button>
      </div>

      <div className="mobile-remortgage-focused-input">
        {draftScenario.feeMode === 'amount' && <b>£</b>}
        <input
          autoFocus
          aria-label={draftScenario.feeMode === 'amount' ? 'Fee amount' : 'Fee percentage'}
          type="text"
          inputMode="decimal"
          value={draftValue}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && parsed != null) save()
            if (event.key === 'Escape') onCancel()
          }}
        />
        {draftScenario.feeMode !== 'amount' && <b>%</b>}
      </div>

      <label className="remortgage-switch-row mobile-remortgage-fee-switch mobile-remortgage-fee-switch-focused">
        <span><b>Add fee to loan</b><small>Off = paid upfront</small></span>
        <input
          type="checkbox"
          checked={Boolean(draftScenario.addFeeToLoan)}
          onChange={(event) => update('addFeeToLoan', event.target.checked)}
        />
        <i />
      </label>

      <footer>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-button" disabled={parsed == null} onClick={save}>Done</button>
      </footer>
    </section>
  </div>
}

function MobileRemortgageEditor({ comparison, property, onClose, onSave }) {
  const sourcePropertyValue = property ? Number(property.latestValuation || 0) : null
  const comparisonPropertyValue = Number(
    comparison.left?.propertyValue
    || comparison.right?.propertyValue
    || 0
  )
  const initialPropertyValue = sourcePropertyValue ?? comparisonPropertyValue
  const [draft, setDraft] = useState(() => comparisonAtPropertyValue(comparison, initialPropertyValue))
  const [fieldEditor, setFieldEditor] = useState(null)
  const propertyValue = sourcePropertyValue ?? Number(
    draft.left?.propertyValue
    || draft.right?.propertyValue
    || 0
  )

  useEffect(() => {
    const resetPropertyValue = sourcePropertyValue ?? Number(
      comparison.left?.propertyValue
      || comparison.right?.propertyValue
      || 0
    )
    setDraft(comparisonAtPropertyValue(comparison, resetPropertyValue))
    setFieldEditor(null)
  }, [comparison.id, sourcePropertyValue])

  const editorScenario = (scenario) => (
    property ? scenarioAtPropertyValue(scenario, propertyValue) : scenario
  )

  const updateSide = (side, key, value) => setDraft((current) => {
    const base = property ? scenarioAtPropertyValue(current[side], propertyValue) : current[side]
    return { ...current, [side]: updateRemortgageScenario(base, key, value) }
  })

  const replaceSide = (side, scenario) => setDraft((current) => ({
    ...current,
    [side]: property ? scenarioAtPropertyValue(scenario, propertyValue) : scenario,
  }))

  const left = calculateRemortgageScenario(editorScenario(draft.left))
  const right = calculateRemortgageScenario(editorScenario(draft.right))
  const leftCashFlow = optionCashFlow(property, left)
  const rightCashFlow = optionCashFlow(property, right)
  const animatedLeftMortgageCost = useAnimatedNumber(left.monthlyInterest)
  const animatedRightMortgageCost = useAnimatedNumber(right.monthlyInterest)
  const animatedLeftCashFlow = useAnimatedNumber(leftCashFlow)
  const animatedRightCashFlow = useAnimatedNumber(rightCashFlow)
  const feeLabel = right.feeValue === 0
    ? 'No fee'
    : right.feeMode === 'amount'
      ? money.format(right.feeValue)
      : `${rate.format(right.feeValue)}%`
  const feeTreatment = right.feeValue === 0
    ? 'No product fee entered'
    : right.addFeeToLoan ? 'Added to loan' : 'Paid upfront'

  const primaryRows = [
    ...(!property ? [{
      key: 'property-value',
      step: '1',
      label: 'Property value',
      value: money.format(propertyValue),
      note: 'Required for LTV and remortgage loan',
    }] : []),
    {
      key: 'remortgage-rate',
      step: property ? '1' : '2',
      label: 'Remortgage rate',
      value: `${rate.format(right.rate)}%`,
      note: 'Tap to edit',
    },
    {
      key: 'remortgage-ltv',
      step: property ? '2' : '3',
      label: 'Remortgage LTV',
      value: `${roundedLtv(right.ltv)}%`,
      note: 'Sets the remortgage loan automatically',
    },
    {
      key: 'product-fee',
      step: property ? '3' : '4',
      label: 'Product fee',
      value: feeLabel,
      note: feeTreatment,
    },
  ]

  const save = () => onSave(
    property ? comparisonAtPropertyValue(draft, propertyValue) : draft
  )

  const openNumericEditor = (key, title, value, options = {}) => {
    setFieldEditor({ key, title, value, ...options })
  }

  const commitNumericEditor = (value) => {
    if (!fieldEditor) return
    if (fieldEditor.key === 'remortgage-rate') updateSide('right', 'rate', value)
    if (fieldEditor.key === 'remortgage-ltv') updateSide('right', 'ltv', value)
    if (fieldEditor.key === 'remortgage-loan' && !property) updateSide('right', 'loanAmount', value)
    if (fieldEditor.key === 'current-rate') updateSide('left', 'rate', value)
    if (fieldEditor.key === 'current-loan') updateSide('left', 'loanAmount', value)
    if (fieldEditor.key === 'property-value' && !property) {
      setDraft((current) => ({
        ...current,
        left: updateRemortgageScenario(current.left, 'propertyValue', value),
        right: updateRemortgageScenario(current.right, 'propertyValue', value),
      }))
    }
    setFieldEditor(null)
  }

  const openPrimary = (key) => {
    if (key === 'property-value' && !property) {
      openNumericEditor(key, 'Property value', propertyValue, { prefix: '£' })
      return
    }
    if (key === 'remortgage-rate') {
      openNumericEditor(key, 'Remortgage rate', draft.right.rate, { suffix: '%', decimals: 2 })
      return
    }
    if (key === 'remortgage-ltv') {
      openNumericEditor(key, 'Remortgage LTV', draft.right.ltv, { suffix: '%', decimals: 1 })
      return
    }
    if (key === 'product-fee') setFieldEditor({ key: 'product-fee' })
  }

  return <div className="mobile-remortgage-layer">
    <section className="mobile-remortgage-modal mobile-remortgage-decision-modal" role="dialog" aria-modal="true" aria-labelledby={`mobile-remortgage-title-${comparison.id}`}>
      <header>
        <div className="mobile-remortgage-heading">
          <small className="mobile-remortgage-action-label">Edit remortgage</small>
          <h3 className="mobile-remortgage-property-title" id={`mobile-remortgage-title-${comparison.id}`}>
            {property ? `${property.name} · ${property.postcode || 'No postcode'}` : 'Manual comparison'}
          </h3>
        </div>
        <button type="button" className="mobile-remortgage-close" onClick={onClose} aria-label="Close without saving"><X size={19} /></button>
      </header>

      <button
        type="button"
        className="mobile-remortgage-rate-hero"
        onClick={() => openPrimary('remortgage-rate')}
        aria-label={`Edit remortgage rate, currently ${rate.format(right.rate)}%`}
      >
        <small>Remortgage rate</small>
        <strong>{rate.format(right.rate)}%</strong>
        <span>Tap to edit</span>
      </button>

      <div className="mobile-remortgage-decision-list">
        {primaryRows.map((row) => <button
          key={row.key}
          type="button"
          className="mobile-remortgage-decision-row"
          onClick={() => openPrimary(row.key)}
        >
          <span className="mobile-remortgage-step">{row.step}</span>
          <span className="mobile-remortgage-decision-copy">
            <b>{row.label}</b>
            <small>{row.note}</small>
          </span>
          <strong>{row.value}</strong>
          <ArrowRight size={17} aria-hidden="true" />
        </button>)}
      </div>

      <div className="mobile-remortgage-cost-strip" aria-label="Current and new monthly mortgage costs">
        <div>
          <small>Current mortgage cost</small>
          <strong>{money.format(animatedLeftMortgageCost)} / mo</strong>
          {property && <span>True cash flow {money.format(animatedLeftCashFlow)} / mo</span>}
        </div>
        <ArrowRight size={18} aria-hidden="true" />
        <div>
          <small>New mortgage cost</small>
          <strong>{money.format(animatedRightMortgageCost)} / mo</strong>
          {property && <span>True cash flow {money.format(animatedRightCashFlow)} / mo</span>}
        </div>
      </div>

      <details className="mobile-remortgage-details mobile-remortgage-supporting-details">
        <summary>
          <span><b>Details</b><small>Current, property and derived values</small></span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="mobile-remortgage-details-body">
          <div className="mobile-remortgage-detail-list">
            <button
              type="button"
              className="mobile-remortgage-detail-row editable"
              onClick={() => openNumericEditor('current-rate', 'Current interest rate', draft.left.rate, { suffix: '%', decimals: 2 })}
            >
              <span>Current interest rate</span><b>{rate.format(left.rate)}%</b><small>Edit</small>
            </button>
            <button
              type="button"
              className="mobile-remortgage-detail-row editable"
              onClick={() => openNumericEditor('current-loan', 'Current loan amount', draft.left.loanAmount, { prefix: '£' })}
            >
              <span>Current loan amount</span><b>{money.format(left.loanAmount)}</b><small>Edit</small>
            </button>
            {property
              ? <div className="mobile-remortgage-detail-row"><span>Property value</span><b>{money.format(propertyValue)}</b></div>
              : <button
                  type="button"
                  className="mobile-remortgage-detail-row editable"
                  onClick={() => openNumericEditor('property-value', 'Property value', propertyValue, { prefix: '£' })}
                >
                  <span>Property value</span><b>{money.format(propertyValue)}</b><small>Edit</small>
                </button>}
            <div className="mobile-remortgage-detail-row"><span>Current LTV</span><b>{roundedLtv(left.ltv)}%</b></div>
            {property
              ? <div className="mobile-remortgage-detail-row"><span>Remortgage loan</span><b>{money.format(right.loanAmount)}</b></div>
              : <button
                  type="button"
                  className="mobile-remortgage-detail-row editable"
                  onClick={() => openNumericEditor('remortgage-loan', 'Remortgage loan amount', draft.right.loanAmount, { prefix: '£' })}
                >
                  <span>Remortgage loan</span><b>{money.format(right.loanAmount)}</b><small>Edit</small>
                </button>}
            <div className="mobile-remortgage-detail-row"><span>New LTV</span><b>{roundedLtv(right.resultingLtv)}%</b></div>
            <div className="mobile-remortgage-detail-row"><span>Current mortgage cost</span><b>{money.format(animatedLeftMortgageCost)} / mo</b></div>
            <div className="mobile-remortgage-detail-row"><span>New mortgage cost</span><b>{money.format(animatedRightMortgageCost)} / mo</b></div>
            {property && <div className="mobile-remortgage-detail-row"><span>Current true cash flow</span><b>{money.format(animatedLeftCashFlow)} / mo</b></div>}
            {property && <div className="mobile-remortgage-detail-row"><span>New true cash flow</span><b>{money.format(animatedRightCashFlow)} / mo</b></div>}
          </div>
        </div>
      </details>

      <footer>
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="button" className="primary-button mobile-remortgage-save" onClick={save}>Save Changes</button>
      </footer>
    </section>

    {fieldEditor?.key === 'product-fee' && <MobileFeeEditor
      scenario={draft.right}
      onCancel={() => setFieldEditor(null)}
      onCommit={(scenario) => {
        replaceSide('right', scenario)
        setFieldEditor(null)
      }}
    />}

    {fieldEditor && fieldEditor.key !== 'product-fee' && <MobileSingleValueEditor
      title={fieldEditor.title}
      value={fieldEditor.value}
      prefix={fieldEditor.prefix}
      suffix={fieldEditor.suffix}
      decimals={fieldEditor.decimals}
      onCancel={() => setFieldEditor(null)}
      onCommit={commitNumericEditor}
    />}
  </div>
}

function CollapsedSummary({ comparison, property, expanded, onToggle }) {
  const diff = compareRemortgageScenarios(comparison.left, comparison.right)
  const leftCashFlow = optionCashFlow(property, diff.left)
  const rightCashFlow = optionCashFlow(property, diff.right)
  const cashFlowChange = rightCashFlow - leftCashFlow
  const animatedLeftMortgageCost = useAnimatedNumber(diff.left.monthlyInterest)
  const animatedRightMortgageCost = useAnimatedNumber(diff.right.monthlyInterest)
  const animatedLeftCashFlow = useAnimatedNumber(leftCashFlow)
  const animatedRightCashFlow = useAnimatedNumber(rightCashFlow)
  const animatedCashFlowChange = useAnimatedNumber(cashFlowChange)

  return <button
    type="button"
    className="remortgage-summary-main"
    aria-expanded={expanded}
    onClick={onToggle}
  >
    <div className="remortgage-summary-mobile">
      <span className="remortgage-summary-mobile-name">{property?.name || comparison.name || 'Manual'}</span>
      <span className="remortgage-summary-mobile-rates" aria-label="Current and new interest rates with monthly mortgage costs">
        <span>
          <small>Current</small>
          <b>{rate.format(diff.left.rate)}%</b>
          <em>{money.format(animatedLeftMortgageCost)} / mo</em>
        </span>
        <ArrowRight size={15} aria-hidden="true" />
        <span>
          <small>New</small>
          <b>{rate.format(diff.right.rate)}%</b>
          <em>{money.format(animatedRightMortgageCost)} / mo</em>
        </span>
      </span>
      <span className={`remortgage-summary-mobile-cash ${animatedCashFlowChange >= 0 ? 'positive' : 'negative'}`}>
        <small>{property ? 'True CF Δ' : 'Saving'}</small><b>{signedMoney(animatedCashFlowChange)}</b><small>/ mo</small>
      </span>
    </div>

    <div className="remortgage-summary-name">
      <small>{property?.name || 'Manual'}</small>
      <strong>{comparison.name || 'Remortgage comparison'}</strong>
    </div>

    <div className="remortgage-summary-option">
      <small>Current rate</small>
      <strong className="remortgage-summary-rate">{rate.format(diff.left.rate)}%</strong>
      <span className="remortgage-summary-mortgage-cost">Mortgage cost {money.format(animatedLeftMortgageCost)} / mo</span>
      {property && <em>True cash flow {money.format(animatedLeftCashFlow)} / mo</em>}
    </div>

    <ArrowRight className="remortgage-summary-arrow" size={20} aria-hidden="true" />

    <div className="remortgage-summary-option">
      <small>New rate</small>
      <strong className="remortgage-summary-rate">{rate.format(diff.right.rate)}%</strong>
      <span className="remortgage-summary-mortgage-cost">Mortgage cost {money.format(animatedRightMortgageCost)} / mo</span>
      {property && <em>True cash flow {money.format(animatedRightCashFlow)} / mo</em>}
    </div>

    <div className={`remortgage-summary-difference ${animatedCashFlowChange >= 0 ? 'positive' : 'negative'}`}>
      <small>{property ? 'True cash-flow difference' : 'Monthly mortgage saving'}</small>
      <strong>{signedMoney(animatedCashFlowChange)} / mo</strong>
    </div>

    <span className="remortgage-summary-chevron" aria-hidden="true">
      {expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
    </span>
  </button>
}

export default function RemortgageSimulator({
  properties = [],
  comparisons = [],
  onChange,
  isPro = false,
  onUpgrade,
}) {
  const [sourceId, setSourceId] = useState(properties[0]?.id || 'manual')
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [mobileEditorId, setMobileEditorId] = useState(null)
  const selectedSource = properties.some((property) => property.id === sourceId) ? sourceId : 'manual'

  const propertiesById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  )

  if (!isPro) {
    return <section className="panel remortgage-simulator remortgage-locked">
      <div className="remortgage-lock-icon"><LockKeyhole size={22} /></div>
      <div>
        <span className="kicker">PRO · REMORTGAGE SIMULATOR</span>
        <h2>Compare remortgage options side by side</h2>
        <p>Model loan size, LTV, rates and product fees, then compare monthly cash flow immediately.</p>
      </div>
      <button className="primary-button" onClick={onUpgrade}>Unlock with Pro</button>
    </section>
  }

  const setExpanded = (id, expanded) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (expanded) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const addComparison = () => {
    const property = properties.find((item) => item.id === selectedSource) || null
    const nextComparison = createRemortgageComparison(property)
    onChange([...comparisons, nextComparison])
    if (isMobileRemortgageViewport()) setMobileEditorId(nextComparison.id)
    else setExpanded(nextComparison.id, true)
  }

  const updateComparison = (id, updater) => {
    onChange(comparisons.map((comparison) => comparison.id === id ? updater(comparison) : comparison))
  }

  const removeComparison = (id) => {
    const comparison = comparisons.find((item) => item.id === id)
    if (!window.confirm(`Delete ${comparison?.name || 'this remortgage comparison'}? This cannot be undone.`)) return
    onChange(comparisons.filter((item) => item.id !== id))
    setExpanded(id, false)
    if (mobileEditorId === id) setMobileEditorId(null)
  }

  const duplicateComparison = (comparison) => {
    const copy = duplicateRemortgageComparison(comparison)
    onChange([...comparisons, copy])
    if (isMobileRemortgageViewport()) setMobileEditorId(copy.id)
    else setExpanded(copy.id, true)
  }

  return <section className="remortgage-simulator">
    <section className="panel remortgage-toolbar">
      <div>
        <span className="kicker">PRO · FINANCE DECISION TOOL</span>
        <h2>Remortgage Simulator</h2>
        <p>Choose a property, add a comparison, then set the remortgage rate, LTV and product fee. <span className="remortgage-desktop-copy">Saved comparisons stay compact so you can compare them at a glance.</span></p>
      </div>

      <div className="remortgage-add">
        <label>
          <span>Start from</span>
          <select value={selectedSource} onChange={(event) => setSourceId(event.target.value)}>
            {properties.map((property) => <option key={property.id} value={property.id}>
              {property.name} · {property.postcode || 'No postcode'}
            </option>)}
            <option value="manual">Manual values</option>
          </select>
        </label>
        <button className="primary-button small" onClick={addComparison}>
          <Plus size={16} /> Add comparison
        </button>
      </div>
    </section>

    {comparisons.length === 0 && <section className="panel remortgage-empty">
      <h3>No comparisons yet</h3>
      <p>Choose a BTL or Manual values above, then select Add comparison.</p>
    </section>}

    <div className="remortgage-comparison-stack">
      {comparisons.map((comparison) => {
        const expanded = expandedIds.has(comparison.id)
        const property = propertiesById.get(comparison.sourcePropertyId) || null

        return <article className={`panel remortgage-comparison ${expanded ? 'expanded' : 'collapsed'}`} key={comparison.id}>
          <div className="remortgage-summary-row">
            <CollapsedSummary
              comparison={comparison}
              property={property}
              expanded={expanded}
              onToggle={() => {
                if (isMobileRemortgageViewport()) setMobileEditorId(comparison.id)
                else setExpanded(comparison.id, !expanded)
              }}
            />
            <div className="remortgage-summary-actions">
              <button
                className="icon-button"
                onClick={() => duplicateComparison(comparison)}
                aria-label={`Duplicate ${comparison.name || 'comparison'}`}
                title="Duplicate comparison"
              >
                <Copy size={16} />
              </button>
              <button
                className="icon-button danger"
                onClick={() => removeComparison(comparison.id)}
                aria-label={`Delete ${comparison.name || 'comparison'}`}
                title="Delete comparison"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {expanded && <div className="remortgage-desktop-details">
            <div className="remortgage-comparison-name">
              <span>Comparison name</span>
              <input
                aria-label="Comparison name"
                value={comparison.name || ''}
                onChange={(event) => updateComparison(
                  comparison.id,
                  (current) => ({ ...current, name: event.target.value }),
                )}
              />
            </div>

            <div className="remortgage-comparison-grid">
              <ScenarioCard
                title="Current mortgage"
                rateLabel="Current interest rate"
                scenario={comparison.left}
                property={property}
                onChange={(left) => updateComparison(
                  comparison.id,
                  (current) => ({ ...current, left }),
                )}
              />

              <div className="remortgage-arrow" aria-hidden="true">
                <ArrowRight size={22} />
              </div>

              <ScenarioCard
                title="New mortgage"
                rateLabel="Remortgage interest rate"
                scenario={comparison.right}
                property={property}
                onChange={(right) => updateComparison(
                  comparison.id,
                  (current) => ({ ...current, right }),
                )}
              />

              <DifferenceCard comparison={comparison} property={property} />
            </div>
          </div>}
        </article>
      })}
    </div>

    {mobileEditorId && (() => {
      const comparison = comparisons.find((item) => item.id === mobileEditorId)
      if (!comparison) return null
      const property = propertiesById.get(comparison.sourcePropertyId) || null
      return <MobileRemortgageEditor
        comparison={comparison}
        property={property}
        onClose={() => setMobileEditorId(null)}
        onSave={(nextComparison) => {
          updateComparison(comparison.id, () => nextComparison)
          setExpanded(comparison.id, false)
          setMobileEditorId(null)
        }}
      />
    })()}
  </section>
}
