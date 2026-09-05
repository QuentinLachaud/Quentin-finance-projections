import React, { useMemo, useState } from 'react'
import { AlertCircle, Check, EyeOff, Sparkles } from 'lucide-react'
import {
  BANK_CATEGORIES, performanceTreatmentForTransaction, similarTransactionsFor,
  sortTransactionsForReview, transactionNeedsReview,
} from './banking.js'

const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(value || 0))
const treatmentLabels = {
  operating: 'Property cash',
  financing: 'Financing',
  company: 'Company only',
  investor: 'DLA / owner funding',
  exclude: 'Excluded',
  review: 'Needs review',
}

export default function BankTransactionReview({ transactions, properties = [], onUpdate, onUpdateMany }) {
  const [mode, setMode] = useState('review')
  const [sortMode, setSortMode] = useState('amount')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const reviewRows = useMemo(() => transactions.filter((transaction) => transactionNeedsReview(transaction, properties)), [transactions, properties])
  const reviewCount = reviewRows.length
  const visible = useMemo(() => sortTransactionsForReview(mode === 'review' ? reviewRows : transactions, sortMode).slice(0, 120), [transactions, reviewRows, mode, sortMode])
  if (!transactions.length) return null

  return <section className="panel bank-review-panel">
    <header><div><span className="kicker">CASH-FLOW REVIEW</span><h2>Make actuals trustworthy</h2><p>Known DLA, internal transfers and company-only rows are handled automatically. Review only what changes true cash flow.</p></div><div className="segmented"><button className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')}>Review {reviewCount}</button><button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>All</button></div></header>
    <div className="bank-toolbar"><div className="segmented" aria-label="Transaction review order"><button className={sortMode === 'amount' ? 'active' : ''} onClick={() => setSortMode('amount')}>Largest first</button><button className={sortMode === 'newest' ? 'active' : ''} onClick={() => setSortMode('newest')}>Newest</button></div><button type="button" className="text-button" onClick={() => setShowAdvanced((current) => !current)}>{showAdvanced ? 'Hide advanced' : 'Advanced'}</button></div>
    {!visible.length ? <div className="bank-review-empty"><Check size={18} /><span>No transactions need review.</span></div> : <div className="bank-review-list">{visible.map((transaction) => {
      const needsReview = transactionNeedsReview(transaction, properties)
      const treatment = performanceTreatmentForTransaction(transaction)
      const similar = similarTransactionsFor(transaction, transactions)
      const propertyRelevant = ['operating', 'financing', 'review'].includes(treatment) || Boolean(transaction.propertyId)
      const applyToSimilar = () => onUpdateMany?.([transaction, ...similar], {
        category: transaction.category,
        category_overridden: true,
        is_transfer: transaction.category === 'transfer',
        property_id: transaction.propertyId || null,
        performance_treatment: transaction.performanceTreatment || 'auto',
        exclude_from_performance: transaction.excludeFromPerformance === true,
      })
      return <article className={needsReview ? 'needs-review' : ''} key={transaction.id || `${transaction.accountId}:${transaction.transactionKey}`}>
        <div className="bank-review-main"><span>{needsReview && <AlertCircle size={14} />}<b>{transaction.description || transaction.counterparty || 'Transaction'}</b><small>{transaction.bookedAt} · {transaction.accountName || 'Bank account'} · Auto → {treatmentLabels[treatment] || treatment}</small></span><strong className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</strong></div>
        <div className="bank-review-controls">
          <label><span>Category</span><select value={transaction.category} onChange={(event) => onUpdate(transaction, { category: event.target.value, category_overridden: true, is_transfer: event.target.value === 'transfer' })}>{BANK_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {propertyRelevant && <label><span>Property</span><select value={transaction.propertyId || ''} onChange={(event) => onUpdate(transaction, { property_id: event.target.value || null })}><option value="">Portfolio / unassigned</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>}
          {showAdvanced && <label><span>Performance</span><select value={transaction.performanceTreatment || 'auto'} onChange={(event) => onUpdate(transaction, { performance_treatment: event.target.value })}><option value="auto">Auto · {treatmentLabels[treatment] || treatment}</option><option value="operating">Property cash</option><option value="company">Company only</option><option value="investor">DLA / owner funding</option><option value="exclude">Exclude</option></select></label>}
          {similar.length > 0 && <button type="button" className="secondary-button small" onClick={applyToSimilar}><Sparkles size={14} /> Apply to {similar.length} similar</button>}
          {showAdvanced && <button type="button" className={transaction.excludeFromPerformance ? 'bank-exclude active' : 'bank-exclude'} onClick={() => onUpdate(transaction, { exclude_from_performance: !transaction.excludeFromPerformance })}><EyeOff size={14} />{transaction.excludeFromPerformance ? 'Excluded' : 'Exclude'}</button>}
        </div>
      </article>
    })}</div>}
  </section>
}
