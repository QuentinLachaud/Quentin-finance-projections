import React, { useEffect, useMemo, useState } from 'react'
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
  const update = (key) => (value) => onChange(updateRemortgageScenario(scenario, key, value))

  return <section className="remortgage-scenario-card">
    <header>
      <div>
        <span>{title}</span>
        <strong>{money.format(cashFlow)}<small> / month</small></strong>
      </div>
      <small>{property ? 'After mortgage and property costs' : 'Mortgage cost only'}</small>
    </header>

    <div className="remortgage-fields">
      <FriendlyNumberField
        label="Property value"
        prefix="£"
        value={scenario.propertyValue}
        onChange={update('propertyValue')}
      />

      <div className="remortgage-field-pair">
        <FriendlyNumberField
          label="Loan amount"
          prefix="£"
          value={scenario.loanAmount}
          onChange={update('loanAmount')}
        />
        <FriendlyNumberField
          label="LTV"
          suffix="%"
          value={roundedLtv(scenario.ltv)}
          integer
          onChange={update('ltv')}
        />
      </div>

      <FriendlyNumberField
        label={rateLabel}
        suffix="%"
        value={scenario.rate}
        decimals={2}
        onChange={update('rate')}
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
            <small>Otherwise paid upfront.</small>
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

    <dl className="remortgage-result-strip">
      <div><dt>Resulting loan</dt><dd>{money.format(result.effectiveLoan)}</dd></div>
      <div><dt>Resulting LTV</dt><dd>{roundedLtv(result.resultingLtv)}%</dd></div>
      <div><dt>Mortgage cost</dt><dd>{money.format(result.monthlyInterest)} / mo</dd></div>
    </dl>
  </section>
}

function DifferenceCard({ comparison, property }) {
  const diff = compareRemortgageScenarios(comparison.left, comparison.right)
  const leftCashFlow = optionCashFlow(property, diff.left)
  const rightCashFlow = optionCashFlow(property, diff.right)
  const cashFlowChange = rightCashFlow - leftCashFlow
  const positive = cashFlowChange >= 0
  const equityReleasePositive = diff.equityRelease >= 0

  return <section className={`remortgage-difference-card ${positive ? 'positive' : 'negative'}`}>
    <span className="kicker">OPTION B VS OPTION A</span>

    <div className="remortgage-impact">
      <small>Monthly cash-flow difference</small>
      <strong>{signedMoney(cashFlowChange)}</strong>
      <span>{signedMoney(cashFlowChange * 12)} / year</span>
    </div>

    <dl>
      <div><dt>Loan balance</dt><dd>{signedMoney(diff.loanChange)}</dd></div>
      <div><dt>LTV</dt><dd>{signedPercent(diff.ltvChange)}</dd></div>
      <div><dt>Interest rate</dt><dd>{signedPercent(diff.rateChange)}</dd></div>
      <div><dt>Product fee</dt><dd>{signedMoney(diff.feeChange)}</dd></div>
      <div><dt>Upfront cash</dt><dd>{signedMoney(diff.upfrontFeeChange)}</dd></div>
      <div className="equity-release-row">
        <dt>Equity release</dt>
        <dd className={equityReleasePositive ? 'good' : 'bad'}>{signedMoney(diff.equityRelease)}</dd>
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

function MobileRemortgageEditor({ comparison, property, onClose, onSave }) {
  const propertyValue = Number(
    property?.latestValuation
    || comparison.left?.propertyValue
    || comparison.right?.propertyValue
    || 0
  )
  const [draft, setDraft] = useState(() => comparisonAtPropertyValue(comparison, propertyValue))

  useEffect(() => {
    setDraft(comparisonAtPropertyValue(comparison, propertyValue))
  }, [comparison.id, propertyValue])

  const updateSide = (side, key, value) => setDraft((current) => {
    const base = scenarioAtPropertyValue(current[side], propertyValue)
    return { ...current, [side]: updateRemortgageScenario(base, key, value) }
  })

  const left = calculateRemortgageScenario(scenarioAtPropertyValue(draft.left, propertyValue))
  const right = calculateRemortgageScenario(scenarioAtPropertyValue(draft.right, propertyValue))
  const feeLabel = right.feeMode === 'amount'
    ? money.format(right.feeValue)
    : `${rate.format(right.feeValue)}%`

  const save = () => onSave(comparisonAtPropertyValue(draft, propertyValue))

  return <div className="mobile-remortgage-layer">
    <section className="mobile-remortgage-modal" role="dialog" aria-modal="true" aria-labelledby={`mobile-remortgage-title-${comparison.id}`}>
      <header>
        <div>
          <small>{property ? `${property.name} · ${property.postcode || 'No postcode'}` : 'Manual comparison'}</small>
          <h3 id={`mobile-remortgage-title-${comparison.id}`}>Edit remortgage</h3>
        </div>
        <button type="button" className="mobile-remortgage-close" onClick={onClose} aria-label="Close without saving"><X size={19} /></button>
      </header>

      <div className="mobile-remortgage-primary-fields">
        <FriendlyNumberField
          label="Current interest rate"
          suffix="%"
          value={draft.left.rate}
          decimals={2}
          onChange={(value) => updateSide('left', 'rate', value)}
        />
        <FriendlyNumberField
          label="Current loan amount"
          prefix="£"
          value={draft.left.loanAmount}
          onChange={(value) => updateSide('left', 'loanAmount', value)}
        />
        <FriendlyNumberField
          label="Remortgage rate"
          suffix="%"
          value={draft.right.rate}
          decimals={2}
          onChange={(value) => updateSide('right', 'rate', value)}
        />
        <FriendlyNumberField
          label="Remortgage loan"
          prefix="£"
          value={draft.right.loanAmount}
          onChange={(value) => updateSide('right', 'loanAmount', value)}
        />
      </div>

      <dl className="mobile-remortgage-derived">
        <div><dt>Property value</dt><dd>{money.format(propertyValue)}</dd></div>
        <div><dt>Current LTV</dt><dd>{roundedLtv(left.ltv)}%</dd></div>
        <div><dt>New LTV</dt><dd>{roundedLtv(right.resultingLtv)}%</dd></div>
      </dl>

      <details className="mobile-remortgage-details">
        <summary>
          <span><b>Product fee & details</b><small>{feeLabel} · {right.addFeeToLoan ? 'added to loan' : 'paid upfront'}</small></span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="mobile-remortgage-details-body">
          <div className="mobile-remortgage-fee-row">
            <div className="remortgage-segmented" aria-label="Product fee type">
              <button
                type="button"
                className={draft.right.feeMode !== 'amount' ? 'active' : ''}
                onClick={() => updateSide('right', 'feeMode', 'percent')}
              >% of loan</button>
              <button
                type="button"
                className={draft.right.feeMode === 'amount' ? 'active' : ''}
                onClick={() => updateSide('right', 'feeMode', 'amount')}
              >£ amount</button>
            </div>
            <FriendlyNumberField
              label={draft.right.feeMode === 'amount' ? 'Fee amount' : 'Fee percentage'}
              prefix={draft.right.feeMode === 'amount' ? '£' : undefined}
              suffix={draft.right.feeMode === 'amount' ? undefined : '%'}
              value={draft.right.feeValue}
              decimals={draft.right.feeMode === 'amount' ? 0 : 2}
              onChange={(value) => updateSide('right', 'feeValue', value)}
            />
          </div>

          <label className="remortgage-switch-row mobile-remortgage-fee-switch">
            <span><b>Add fee to loan</b><small>Off = paid upfront</small></span>
            <input
              type="checkbox"
              checked={Boolean(draft.right.addFeeToLoan)}
              onChange={(event) => updateSide('right', 'addFeeToLoan', event.target.checked)}
            />
            <i />
          </label>

          <dl className="mobile-remortgage-result-row">
            <div><dt>Resulting loan</dt><dd>{money.format(right.effectiveLoan)}</dd></div>
            <div><dt>Resulting LTV</dt><dd>{roundedLtv(right.resultingLtv)}%</dd></div>
            <div><dt>Mortgage / mo</dt><dd>{money.format(right.monthlyInterest)}</dd></div>
          </dl>
        </div>
      </details>

      <footer>
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="button" className="primary-button mobile-remortgage-save" onClick={save}>Save Changes</button>
      </footer>
    </section>
  </div>
}

function CollapsedSummary({ comparison, property, expanded, onToggle }) {
  const diff = compareRemortgageScenarios(comparison.left, comparison.right)
  const leftCashFlow = optionCashFlow(property, diff.left)
  const rightCashFlow = optionCashFlow(property, diff.right)
  const cashFlowChange = rightCashFlow - leftCashFlow

  return <button
    type="button"
    className="remortgage-summary-main"
    aria-expanded={expanded}
    onClick={onToggle}
  >
    <div className="remortgage-summary-mobile">
      <span className="remortgage-summary-mobile-name">{property?.name || comparison.name || 'Manual'}</span>
      <span className="remortgage-summary-mobile-rates">
        <b>{rate.format(diff.left.rate)}%</b><ArrowRight size={16} aria-hidden="true" /><b>{rate.format(diff.right.rate)}%</b>
      </span>
      <span className={`remortgage-summary-mobile-cash ${cashFlowChange >= 0 ? 'positive' : 'negative'}`}>
        <b>{signedMoney(cashFlowChange)}</b><small>/ mo</small>
      </span>
    </div>

    <div className="remortgage-summary-name">
      <small>{property?.name || 'Manual'}</small>
      <strong>{comparison.name || 'Remortgage comparison'}</strong>
    </div>

    <div className="remortgage-summary-option">
      <small>Current rate</small>
      <strong>{rate.format(diff.left.rate)}%</strong>
      <span>Cash flow {money.format(leftCashFlow)} / mo</span>
    </div>

    <ArrowRight className="remortgage-summary-arrow" size={20} aria-hidden="true" />

    <div className="remortgage-summary-option">
      <small>Remortgage rate</small>
      <strong>{rate.format(diff.right.rate)}%</strong>
      <span>Cash flow {money.format(rightCashFlow)} / mo</span>
    </div>

    <div className={`remortgage-summary-difference ${cashFlowChange >= 0 ? 'positive' : 'negative'}`}>
      <small>Cash-flow difference</small>
      <strong>{signedMoney(cashFlowChange)} / mo</strong>
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
        <p>Choose a property, add a comparison, then enter the remortgage rate, loan, LTV and product fee. Collapse each comparison to compare your saved options at a glance.</p>
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
                title="Option A"
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
                title="Option B"
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
