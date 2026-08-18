import React, { useState } from 'react'
import { ArrowRight, Copy, LockKeyhole, Plus, Trash2 } from 'lucide-react'
import {
  calculateRemortgageScenario,
  compareRemortgageScenarios,
  createRemortgageComparison,
  duplicateRemortgageComparison,
  updateRemortgageScenario,
} from './remortgage.js'

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
const money2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signedMoney = (value) => `${value >= 0 ? '+' : '−'}${money.format(Math.abs(value))}`
const signedMoney2 = (value) => `${value >= 0 ? '+' : '−'}${money2.format(Math.abs(value))}`
const signedPercent = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)} pp`

function NumberField({ label, prefix, suffix, value, step = 'any', onChange }) {
  return <label className="remortgage-field">
    <span>{label}</span>
    <div>
      {prefix && <b>{prefix}</b>}
      <input type="number" min="0" step={step} value={Number(value || 0)} onChange={(event) => onChange(event.target.value)} />
      {suffix && <b>{suffix}</b>}
    </div>
  </label>
}

function ScenarioCard({ title, scenario, onChange }) {
  const result = calculateRemortgageScenario(scenario)
  const update = (key) => (value) => onChange(updateRemortgageScenario(scenario, key, value))

  return <section className="remortgage-scenario-card">
    <header>
      <div><span>{title}</span><strong>{money2.format(result.monthlyInterest)}<small> / month</small></strong></div>
      <small>Interest-only mortgage cost</small>
    </header>

    <div className="remortgage-fields">
      <NumberField label="Property value" prefix="£" step="1000" value={scenario.propertyValue} onChange={update('propertyValue')} />
      <div className="remortgage-field-pair">
        <NumberField label="Loan amount" prefix="£" step="1000" value={scenario.loanAmount} onChange={update('loanAmount')} />
        <NumberField label="LTV" suffix="%" step="0.1" value={scenario.ltv} onChange={update('ltv')} />
      </div>
      <NumberField label="Interest rate" suffix="%" step="0.01" value={scenario.rate} onChange={update('rate')} />

      <div className="remortgage-fee-block">
        <div className="remortgage-fee-heading">
          <span>Product fee</span>
          <div className="remortgage-segmented">
            <button type="button" className={scenario.feeMode !== 'amount' ? 'active' : ''} onClick={() => onChange(updateRemortgageScenario(scenario, 'feeMode', 'percent'))}>% of loan</button>
            <button type="button" className={scenario.feeMode === 'amount' ? 'active' : ''} onClick={() => onChange(updateRemortgageScenario(scenario, 'feeMode', 'amount'))}>£ amount</button>
          </div>
        </div>
        <NumberField
          label={scenario.feeMode === 'amount' ? 'Fee amount' : 'Fee percentage'}
          prefix={scenario.feeMode === 'amount' ? '£' : undefined}
          suffix={scenario.feeMode === 'amount' ? undefined : '%'}
          step={scenario.feeMode === 'amount' ? '1' : '0.01'}
          value={scenario.feeValue}
          onChange={update('feeValue')}
        />
        <label className="remortgage-switch-row">
          <span><b>Add fee to loan</b><small>Otherwise treated as an upfront cash cost.</small></span>
          <input type="checkbox" checked={Boolean(scenario.addFeeToLoan)} onChange={(event) => update('addFeeToLoan')(event.target.checked)} />
          <i />
        </label>
      </div>
    </div>

    <dl className="remortgage-result-strip">
      <div><dt>Resulting loan</dt><dd>{money.format(result.effectiveLoan)}</dd></div>
      <div><dt>Resulting LTV</dt><dd>{result.resultingLtv.toFixed(1)}%</dd></div>
      <div><dt>Fee</dt><dd>{money.format(result.fee)}</dd></div>
    </dl>
  </section>
}

function DifferenceCard({ comparison }) {
  const diff = compareRemortgageScenarios(comparison.left, comparison.right)
  const positive = diff.monthlyCashFlowChange >= 0

  return <section className={`remortgage-difference-card ${positive ? 'positive' : 'negative'}`}>
    <span className="kicker">OPTION B VS OPTION A</span>
    <div className="remortgage-impact">
      <small>Monthly cash-flow change</small>
      <strong>{signedMoney2(diff.monthlyCashFlowChange)}</strong>
      <span>{signedMoney(diff.annualCashFlowChange)} / year</span>
    </div>
    <dl>
      <div><dt>Loan balance</dt><dd>{signedMoney(diff.loanChange)}</dd></div>
      <div><dt>LTV</dt><dd>{signedPercent(diff.ltvChange)}</dd></div>
      <div><dt>Rate</dt><dd>{signedPercent(diff.rateChange)}</dd></div>
      <div><dt>Product fee</dt><dd>{signedMoney(diff.feeChange)}</dd></div>
      <div><dt>Upfront cash</dt><dd>{signedMoney(diff.upfrontFeeChange)}</dd></div>
      <div><dt>Equity</dt><dd>{signedMoney(diff.equityChange)}</dd></div>
    </dl>
    <p>{positive ? 'Option B improves monthly cash flow.' : 'Option B reduces monthly cash flow.'}</p>
  </section>
}

export default function RemortgageSimulator({ properties = [], comparisons = [], onChange, isPro = false, onUpgrade }) {
  const [sourceId, setSourceId] = useState(properties[0]?.id || 'manual')
  const selectedSource = properties.some((property) => property.id === sourceId) ? sourceId : 'manual'

  if (!isPro) {
    return <section className="panel remortgage-simulator remortgage-locked">
      <div className="remortgage-lock-icon"><LockKeyhole size={22} /></div>
      <div>
        <span className="kicker">PRO · REMORTGAGE SIMULATOR</span>
        <h2>Compare remortgage options side by side</h2>
        <p>Model LTV, loan size, mortgage rate and product fees, then see the monthly cash-flow impact immediately.</p>
      </div>
      <button className="primary-button" onClick={onUpgrade}>Unlock with Pro</button>
    </section>
  }

  const addComparison = () => {
    const property = properties.find((item) => item.id === selectedSource) || null
    onChange([...comparisons, createRemortgageComparison(property)])
  }
  const updateComparison = (id, updater) => onChange(comparisons.map((comparison) => comparison.id === id ? updater(comparison) : comparison))
  const removeComparison = (id) => onChange(comparisons.filter((comparison) => comparison.id !== id))
  const duplicateComparison = (comparison) => onChange([...comparisons, duplicateRemortgageComparison(comparison)])

  return <section className="remortgage-simulator">
    <section className="panel remortgage-toolbar">
      <div>
        <span className="kicker">PRO · FINANCE DECISION TOOL</span>
        <h2>Remortgage Simulator</h2>
        <p>Build independent Option A and Option B cases. Loan and LTV stay linked; fees can be paid upfront or added to the mortgage.</p>
      </div>
      <div className="remortgage-add">
        <label>
          <span>Start from</span>
          <select value={selectedSource} onChange={(event) => setSourceId(event.target.value)}>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.postcode || 'No postcode'}</option>)}
            <option value="manual">Manual values</option>
          </select>
        </label>
        <button className="primary-button small" onClick={addComparison}><Plus size={16} /> Add comparison</button>
      </div>
    </section>

    {comparisons.length === 0 && <section className="panel remortgage-empty">
      <h3>No comparisons yet</h3>
      <p>Select an existing BTL or Manual values, then add a comparison. You can create several comparisons at the same time.</p>
    </section>}

    <div className="remortgage-comparison-stack">
      {comparisons.map((comparison, index) => <article className="panel remortgage-comparison" key={comparison.id}>
        <header className="remortgage-comparison-header">
          <div>
            <span className="kicker">COMPARISON {index + 1}</span>
            <input aria-label={`Comparison ${index + 1} name`} value={comparison.name || ''} onChange={(event) => updateComparison(comparison.id, (current) => ({ ...current, name: event.target.value }))} />
          </div>
          <div>
            <button className="secondary-button small" onClick={() => duplicateComparison(comparison)}><Copy size={15} /> Duplicate</button>
            <button className="icon-button danger" onClick={() => removeComparison(comparison.id)} aria-label={`Delete ${comparison.name || 'comparison'}`}><Trash2 size={17} /></button>
          </div>
        </header>

        <div className="remortgage-comparison-grid">
          <ScenarioCard title="Option A" scenario={comparison.left} onChange={(left) => updateComparison(comparison.id, (current) => ({ ...current, left }))} />
          <div className="remortgage-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
          <ScenarioCard title="Option B" scenario={comparison.right} onChange={(right) => updateComparison(comparison.id, (current) => ({ ...current, right }))} />
          <DifferenceCard comparison={comparison} />
        </div>
      </article>)}
    </div>
  </section>
}
