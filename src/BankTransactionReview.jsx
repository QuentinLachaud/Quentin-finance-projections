import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, EyeOff, Sparkles } from 'lucide-react'
import {
  BANK_CATEGORIES, bankTransactionStatePatch, performanceTreatmentForTransaction,
  reviewDraftForTransaction, reviewPatchFromDraft, similarTransactionsNeedingReviewFor,
  sortTransactionsForReview, transactionNeedsReview, transactionWithReviewDraft,
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
const categoryLabels = new Map(BANK_CATEGORIES)
const transactionId = (transaction) => String(transaction?.id || `${transaction?.accountId || 'bank'}:${transaction?.transactionKey || transaction?.canonicalKey || ''}`)

export default function BankTransactionReview({ transactions, properties = [], onUpdate, onUpdateMany }) {
  const [mode, setMode] = useState('review')
  const [sortMode, setSortMode] = useState('amount')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeReviewId, setActiveReviewId] = useState('')
  const [draft, setDraft] = useState(null)
  const [applySimilar, setApplySimilar] = useState(true)
  const [skippedIds, setSkippedIds] = useState([])

  const reviewRows = useMemo(() => transactions.filter((transaction) => transactionNeedsReview(transaction, properties)), [transactions, properties])
  const reviewCount = reviewRows.length
  const skippedSet = useMemo(() => new Set(skippedIds), [skippedIds])
  const reviewQueue = useMemo(() => sortTransactionsForReview(reviewRows.filter((transaction) => !skippedSet.has(transactionId(transaction))), sortMode), [reviewRows, skippedSet, sortMode])
  const allRows = useMemo(() => sortTransactionsForReview(transactions, sortMode).slice(0, 120), [transactions, sortMode])
  const active = useMemo(() => {
    if (activeReviewId) return transactions.find((transaction) => transactionId(transaction) === activeReviewId) || null
    return mode === 'review' ? reviewQueue[0] || null : null
  }, [activeReviewId, mode, reviewQueue, transactions])
  const activeId = active ? transactionId(active) : ''
  const baselineDraft = useMemo(() => active ? reviewDraftForTransaction(active, properties) : null, [active, properties])
  const currentDraft = draft?.transactionId === activeId ? draft : (baselineDraft ? { transactionId: activeId, ...baselineDraft } : null)
  const preview = active && currentDraft ? transactionWithReviewDraft(active, currentDraft) : active
  const previewTreatment = preview ? performanceTreatmentForTransaction(preview) : 'review'
  const needsMore = preview ? transactionNeedsReview(preview, properties) : false
  const similar = useMemo(() => active ? similarTransactionsNeedingReviewFor(active, transactions, properties) : [], [active, transactions, properties])
  const propertyRelevant = preview && (['operating', 'financing'].includes(previewTreatment) || Boolean(preview.propertyId))
  const showTreatment = previewTreatment === 'review' || showAdvanced

  useEffect(() => {
    if (!active) { setDraft(null); return }
    setDraft({ transactionId: activeId, ...reviewDraftForTransaction(active, properties) })
    setApplySimilar(true)
  }, [activeId])

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setActiveReviewId('')
    setDraft(null)
    setSkippedIds([])
  }
  const updateDraft = (patch) => setDraft((current) => ({
    transactionId: activeId,
    ...(current?.transactionId === activeId ? current : baselineDraft),
    ...patch,
  }))
  const saveCurrent = async () => {
    if (!active || !currentDraft || needsMore) return
    const patch = reviewPatchFromDraft(currentDraft)
    const result = applySimilar && similar.length
      ? await onUpdateMany?.([active, ...similar], patch)
      : await onUpdate?.(active, patch)
    if (result === false) return
    setActiveReviewId('')
    setDraft(null)
    setSkippedIds((current) => current.filter((id) => id !== activeId))
  }
  const skipCurrent = () => {
    if (!activeId) return
    setSkippedIds((current) => current.includes(activeId) ? current : [...current, activeId])
    setActiveReviewId('')
    setDraft(null)
  }
  const cancelEdit = () => {
    setActiveReviewId('')
    setDraft(null)
  }

  if (!transactions.length) return null

  return <section className="panel bank-review-panel">
    <header>
      <div><span className="kicker">TRANSACTION REVIEW</span><h2>Review transactions</h2><p>Make actuals trustworthy one decision at a time. Exact duplicate statement rows are hidden before they reach this queue.</p></div>
      <div className="segmented"><button className={mode === 'review' ? 'active' : ''} onClick={() => switchMode('review')}>Review {reviewCount}</button><button className={mode === 'all' ? 'active' : ''} onClick={() => switchMode('all')}>All</button></div>
    </header>
    <div className="bank-toolbar"><div className="segmented" aria-label="Transaction review order"><button className={sortMode === 'amount' ? 'active' : ''} onClick={() => setSortMode('amount')}>Largest first</button><button className={sortMode === 'newest' ? 'active' : ''} onClick={() => setSortMode('newest')}>Newest</button></div><button type="button" className="text-button" onClick={() => setShowAdvanced((current) => !current)}>{showAdvanced ? 'Hide advanced' : 'Advanced'}</button></div>

    {mode === 'review' && !active && reviewCount === 0 && <div className="bank-review-empty"><Check size={18} /><span>All caught up. No transactions need review.</span></div>}
    {mode === 'review' && !active && reviewCount > 0 && <div className="bank-review-empty bank-review-skipped"><span>You skipped the {reviewCount} remaining transaction{reviewCount === 1 ? '' : 's'} for this session.</span><button type="button" className="secondary-button small" onClick={() => setSkippedIds([])}>Review skipped</button></div>}

    {active && currentDraft && <>
      <div className="bank-review-progress"><span><b>{reviewCount}</b> need attention</span>{mode === 'review' && <small>{Math.max(0, reviewQueue.length - 1)} after this one{skippedIds.length ? ` · ${skippedIds.length} skipped` : ''}</small>}{mode === 'all' && <button type="button" className="text-button" onClick={cancelEdit}>Back to all</button>}</div>
      <article className="bank-review-focus">
        <div className="bank-review-main"><span><b>{active.description || active.counterparty || 'Transaction'}</b><small>{active.bookedAt} · {active.accountName || 'Bank account'}{active.counterparty ? ` · ${active.counterparty}` : ''}</small></span><strong className={active.amount >= 0 ? 'positive' : 'negative'}>{money(active.amount)}</strong></div>
        <div className="bank-review-fields">
          <label><span>Category</span><select value={currentDraft.category} onChange={(event) => updateDraft({ category: event.target.value })}>{BANK_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {propertyRelevant && <label><span>Property</span><select value={currentDraft.propertyId || ''} onChange={(event) => updateDraft({ propertyId: event.target.value })}><option value="">Choose property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>{baselineDraft?.propertyId && !active.propertyId && currentDraft.propertyId === baselineDraft.propertyId && <small>Suggested from transaction details</small>}</label>}
          {showTreatment && <label><span>Cash-flow treatment</span><select value={currentDraft.performanceTreatment || 'auto'} onChange={(event) => updateDraft({ performanceTreatment: event.target.value })}><option value="auto">Auto · {treatmentLabels[performanceTreatmentForTransaction({ ...active, ...bankTransactionStatePatch(reviewPatchFromDraft({ ...currentDraft, performanceTreatment: 'auto' })) })] || 'Needs review'}</option><option value="operating">Property cash</option><option value="company">Company only</option><option value="investor">DLA / owner funding</option><option value="exclude">Exclude</option></select></label>}
          {showAdvanced && <button type="button" className={currentDraft.excludeFromPerformance ? 'bank-exclude active' : 'bank-exclude'} onClick={() => updateDraft({ excludeFromPerformance: !currentDraft.excludeFromPerformance })}><EyeOff size={14} />{currentDraft.excludeFromPerformance ? 'Excluded from Performance' : 'Exclude from Performance'}</button>}
        </div>
        {needsMore && <p className="bank-review-hint">{['operating', 'financing'].includes(previewTreatment) ? 'Choose the property before saving.' : 'Choose how this transaction affects cash flow before saving.'}</p>}
        {similar.length > 0 && <label className="bank-review-batch"><input type="checkbox" checked={applySimilar} onChange={(event) => setApplySimilar(event.target.checked)} /><i /><span><b><Sparkles size={14} /> Also apply to {similar.length} matching transaction{similar.length === 1 ? '' : 's'}</b><small>Exact counterparty match · unresolved rows only</small></span></label>}
        <footer className="bank-review-actions"><button type="button" className="secondary-button" onClick={mode === 'review' ? skipCurrent : cancelEdit}>{mode === 'review' ? 'Skip' : 'Cancel'}</button><button type="button" className="primary-button" disabled={needsMore} onClick={saveCurrent}>{mode === 'review' ? <>Save & next <ArrowRight size={15} /></> : 'Save changes'}</button></footer>
      </article>
      {mode === 'review' && reviewQueue.length > 1 && <div className="bank-review-next"><span>Next up</span>{reviewQueue.slice(1, 4).map((transaction) => <div key={transactionId(transaction)}><b>{transaction.description || transaction.counterparty || 'Transaction'}</b><strong className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</strong></div>)}</div>}
    </>}

    {mode === 'all' && !active && <div className="bank-review-all">{allRows.map((transaction) => {
      const treatment = performanceTreatmentForTransaction(transaction)
      const property = properties.find((candidate) => String(candidate.id) === String(transaction.propertyId))
      return <article key={transactionId(transaction)}><div><b>{transaction.description || transaction.counterparty || 'Transaction'}</b><small>{transaction.bookedAt} · {transaction.accountName || 'Bank account'} · {categoryLabels.get(transaction.category) || transaction.category} · {property?.name || treatmentLabels[treatment] || treatment}</small></div><strong className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</strong><button type="button" className="secondary-button small" onClick={() => setActiveReviewId(transactionId(transaction))}>Edit</button></article>
    })}</div>}
  </section>
}
