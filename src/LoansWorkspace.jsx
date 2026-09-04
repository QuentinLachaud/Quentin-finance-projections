import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { addMonths, currency, shortDate } from './calculations.js'
import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'
import { createBlankLoan, createLoanFromProperty, inferLtvBand, loanCostSummary } from './loans.js'

const RATE_BANDS = [50, 55, 60, 65, 70, 75, 80, 85, 90]

const rateLabel = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`
const fixedLabel = (loan) => {
  const months = Number(loan.fixedRateMonths || 0)
  const end = loan.fixedStartDate && months ? addMonths(loan.fixedStartDate, months) : null
  if (!months) return { main: 'Not set', detail: loan.fixedStartDate ? `From ${shortDate(loan.fixedStartDate)}` : '' }
  return { main: `${months} months`, detail: end ? `to ${shortDate(end)}` : '' }
}

const actualLtv = (loan, property) => {
  const value = Number(property?.latestValuation || 0)
  return value ? Number(loan.loanAmount || 0) / value * 100 : 0
}

function LoanEditor({ loan, properties, onSave, onDelete }) {
  const costs = loanCostSummary(loan)
  const update = (patch) => onSave({ ...loan, ...patch })
  const linkProperty = (propertyId) => {
    if (!propertyId) {
      update({ propertyId: '' })
      return
    }
    const property = properties.find((candidate) => candidate.id === propertyId)
    if (!property) return
    onSave(createLoanFromProperty(property, loan))
  }

  return <div className="loan-editor">
    <label className="loan-editor-field">
      <span>Associated BTL</span>
      <select value={loan.propertyId || ''} onChange={(event) => linkProperty(event.target.value)}>
        <option value="">Manual / not linked</option>
        {properties.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}
      </select>
    </label>

    <label className="loan-editor-field">
      <span>Lender</span>
      <input value={loan.lender || ''} onChange={(event) => update({ lender: event.target.value })} />
    </label>

    <label className="loan-editor-field">
      <span>Loan amount before fee</span>
      <div className="loan-input-affix"><b>£</b><input type="number" min="0" step="100" value={loan.principalAmount || 0} onChange={(event) => update({ principalAmount: Number(event.target.value) })} /></div>
      <small className="loan-derived-balance">Mortgage balance: {currency(costs.effectiveBalance)}{loan.addFeeToLoan && costs.productFee > 0 ? ` incl. ${currency(costs.productFee)} financed fee` : ''}</small>
    </label>

    <label className="loan-editor-field">
      <span>Interest rate</span>
      <div className="loan-input-affix"><input type="number" min="0" step="0.01" value={(Number(loan.rate || 0) * 100).toFixed(2)} onChange={(event) => update({ rate: Number(event.target.value) / 100 })} /><b>%</b></div>
    </label>

    <label className="loan-editor-field">
      <span>Fixed from</span>
      <input type="date" value={loan.fixedStartDate || ''} onChange={(event) => update({ fixedStartDate: event.target.value })} />
    </label>

    <label className="loan-editor-field">
      <span>Fixed period</span>
      <div className="loan-input-affix"><input type="number" min="0" step="1" value={loan.fixedRateMonths || 0} onChange={(event) => update({ fixedRateMonths: Number(event.target.value) })} /><b>months</b></div>
    </label>

    <div className="loan-editor-field">
      <span>Product fee</span>
      <div className="loan-fee-inputs">
        <select aria-label="Product fee type" value={loan.feeMode || 'percent'} onChange={(event) => update({ feeMode: event.target.value })}>
          <option value="percent">% of loan</option>
          <option value="amount">£ amount</option>
        </select>
        <div className="loan-input-affix">
          {loan.feeMode === 'amount' && <b>£</b>}
          <input type="number" min="0" step={loan.feeMode === 'amount' ? '1' : '0.01'} value={loan.feeValue || 0} onChange={(event) => update({ feeValue: Number(event.target.value) })} />
          {loan.feeMode !== 'amount' && <b>%</b>}
        </div>
      </div>
    </div>

    <label className="loan-editor-field">
      <span>LTV product band</span>
      <select value={loan.ltvBand || ''} onChange={(event) => update({ ltvBand: Number(event.target.value) })}>
        <option value="">Auto from actual LTV</option>
        {RATE_BANDS.map((band) => <option key={band} value={band}>{band}%</option>)}
      </select>
    </label>

    <label className="loan-capitalised-toggle">
      <input type="checkbox" checked={Boolean(loan.addFeeToLoan)} onChange={(event) => update({ addFeeToLoan: event.target.checked })} />
      <span><b>Fee added to loan</b><small>When enabled, the product fee increases the mortgage balance and monthly interest cost.</small></span>
    </label>

    <section className="loan-cost-summary" aria-label="Loan cost summary">
      <header><strong>Cost over fixed period</strong><small>Interest-only · principal excluded</small></header>
      <div className="loan-cost-grid">
        <div className="loan-cost-metric"><small>Monthly cost</small><strong>{currency(costs.monthlyCost)}</strong><span>Effective balance × rate ÷ 12</span></div>
        <div className="loan-cost-metric"><small>Total cost over fixed period</small><strong>{costs.months ? currency(costs.totalCost) : 'Set fixed period'}</strong><span>{costs.months ? `Interest + ${currency(costs.productFee)} product fee` : 'A fixed period is required for a total.'}</span></div>
        <div className="loan-cost-metric"><small>Interest cost excl. principal</small><strong>{costs.months ? currency(costs.totalInterestCost) : 'Set fixed period'}</strong><span>{costs.months ? `${costs.months} months of interest` : 'Principal is never counted as a cost.'}</span></div>
      </div>
    </section>

    <div className="loan-editor-actions">
      <button type="button" className="danger-text-button" onClick={onDelete}><Trash2 size={15} /> Delete loan</button>
    </div>
  </div>
}

export default function LoansWorkspace({ loans = [], properties = [], onSave, onDelete }) {
  const [expandedId, setExpandedId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const propertyMap = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties])

  const addLoan = () => {
    const loan = createBlankLoan()
    onSave(loan)
    setExpandedId(loan.id)
  }

  return <>
    <section className="panel loans-workspace">
      <header className="loans-toolbar">
        <div>
          <span className="kicker">CURRENT FINANCE</span>
          <h2>Mortgages & loans</h2>
          <p>Live borrowing held by the portfolio, with BTL-linked finance kept in sync automatically.</p>
        </div>
        <button type="button" className="primary-button" onClick={addLoan}><Plus size={16} /> Add loan</button>
      </header>

      {loans.length === 0 && <div className="loan-empty-state"><b>No loans recorded</b><span>Add one manually, or edit mortgage details on a BTL to create its linked loan.</span></div>}

      {loans.length > 0 && <div className="loans-list">
        <div className="loan-list-head" aria-hidden="true">
          <span>Loan / BTL</span><span>Loan balance</span><span>Rate</span><span>Fixed period</span><span>Monthly cost</span><span>LTV band</span><span />
        </div>

        {loans.map((loan) => {
          const property = propertyMap.get(loan.propertyId) || null
          const fixed = fixedLabel(loan)
          const actual = actualLtv(loan, property)
          const band = Number(loan.ltvBand || 0) || inferLtvBand(loan.loanAmount, property?.latestValuation)
          const costs = loanCostSummary(loan)
          const expanded = expandedId === loan.id
          return <article className={`loan-row ${expanded ? 'expanded' : ''}`} key={loan.id}>
            <button
              type="button"
              className="loan-summary-row"
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? '' : loan.id)}
            >
              <span className="loan-primary"><strong>{loan.lender || 'Lender not set'}</strong><small>{property ? property.name : 'Manual / unlinked loan'}</small></span>
              <span className="loan-cell"><small>Loan balance</small><strong>{currency(loan.loanAmount)}</strong></span>
              <span className="loan-cell"><small>Rate</small><strong>{rateLabel(loan.rate)}</strong></span>
              <span className="loan-cell"><small>Fixed period</small><strong>{fixed.main}</strong>{fixed.detail && <small>{fixed.detail}</small>}</span>
              <span className="loan-cell"><small>Monthly cost</small><strong>{currency(costs.monthlyCost)}</strong></span>
              <span className="loan-cell"><small>LTV band</small><strong>{band ? `${band}% band` : 'Not set'}</strong>{actual > 0 && <small>{actual.toFixed(1)}% actual</small>}</span>
              <span className="loan-row-chevron">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
            </button>
            {expanded && <LoanEditor loan={loan} properties={properties} onSave={onSave} onDelete={() => setDeleteTarget(loan)} />}
          </article>
        })}
      </div>}
    </section>

    {deleteTarget && <DeleteConfirmDialog
      title="Delete this loan?"
      message={`This removes ${deleteTarget.lender || 'the loan'} from Loans. Any linked BTL and its property data are kept.`}
      confirmLabel="Delete loan"
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => {
        onDelete(deleteTarget.id)
        if (expandedId === deleteTarget.id) setExpandedId('')
        setDeleteTarget(null)
      }}
    />}
  </>
}
