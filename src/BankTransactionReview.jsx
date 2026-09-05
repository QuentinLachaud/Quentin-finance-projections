import React, { useMemo, useState } from 'react'
import { AlertCircle, Check, EyeOff } from 'lucide-react'
import { BANK_CATEGORIES, performanceTreatmentForTransaction, transactionNeedsReview } from './banking.js'

const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(value || 0))
const treatmentLabels = {
  operating: 'Property cash',
  financing: 'Financing',
  company: 'Company only',
  investor: 'DLA / investor funding',
  exclude: 'Excluded',
  review: 'Needs review',
}

export default function BankTransactionReview({ transactions, properties = [], onUpdate }) {
  const [mode, setMode] = useState('review')
  const reviewCount = useMemo(() => transactions.filter((transaction) => transactionNeedsReview(transaction, properties)).length, [transactions, properties])
  const visible = useMemo(() => (mode === 'review' ? transactions.filter((transaction) => transactionNeedsReview(transaction, properties)) : transactions).slice().reverse().slice(0, 120), [transactions, properties, mode])
  if (!transactions.length) return null

  return <section className="panel bank-review-panel">
    <header><div><span className="kicker">CASH-FLOW REVIEW</span><h2>Make actuals trustworthy</h2><p>Only uncertain transactions need attention. DLA and internal transfers never become property profit by default.</p></div><div className="segmented"><button className={mode === 'review' ? 'active' : ''} onClick={() => setMode('review')}>Review {reviewCount}</button><button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>All</button></div></header>
    {!visible.length ? <div className="bank-review-empty"><Check size={18} /><span>No transactions need review.</span></div> : <div className="bank-review-list">{visible.map((transaction) => {
      const needsReview = transactionNeedsReview(transaction, properties)
      const treatment = performanceTreatmentForTransaction(transaction)
      return <article className={needsReview ? 'needs-review' : ''} key={transaction.id || `${transaction.accountId}:${transaction.transactionKey}`}>
        <div className="bank-review-main"><span>{needsReview && <AlertCircle size={14} />}<b>{transaction.description || transaction.counterparty || 'Transaction'}</b><small>{transaction.bookedAt} · {transaction.accountName || 'Bank account'}</small></span><strong className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</strong></div>
        <div className="bank-review-controls">
          <label><span>Category</span><select value={transaction.category} onChange={(event) => onUpdate(transaction, { category: event.target.value, category_overridden: true, is_transfer: event.target.value === 'transfer' })}>{BANK_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Property</span><select value={transaction.propertyId || ''} onChange={(event) => onUpdate(transaction, { property_id: event.target.value || null })}><option value="">Portfolio / unassigned</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label><span>Performance</span><select value={transaction.performanceTreatment || 'auto'} onChange={(event) => onUpdate(transaction, { performance_treatment: event.target.value })}><option value="auto">Auto · {treatmentLabels[treatment] || treatment}</option><option value="operating">Property cash</option><option value="company">Company only</option><option value="investor">DLA / investor funding</option><option value="exclude">Exclude</option></select></label>
          <button type="button" className={transaction.excludeFromPerformance ? 'bank-exclude active' : 'bank-exclude'} onClick={() => onUpdate(transaction, { exclude_from_performance: !transaction.excludeFromPerformance })}><EyeOff size={14} />{transaction.excludeFromPerformance ? 'Excluded' : 'Exclude'}</button>
        </div>
      </article>
    })}</div>}
  </section>
}
