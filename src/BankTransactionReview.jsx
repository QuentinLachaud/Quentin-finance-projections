import BrainDrainNumericInput from './BrainDrainNumericInput.jsx'
import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Sparkles, Undo2 } from 'lucide-react'
import {
  BANK_CATEGORIES, bankTransactionStatePatch, categoryUsesProperty, exclusionUndoEntriesFor, performanceTreatmentForTransaction,
  reviewDraftForTransaction, reviewPatchFromDraft, similarTransactionsNeedingReviewFor,
  sortTransactionsForReview, transactionNeedsReview, transactionWithReviewDraft,
} from './banking.js'

const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(value || 0))
const treatmentLabels = {
  operating: 'Property operating',
  financing: 'Mortgage / financing',
  company: 'Company overhead',
  investor: 'Owner funding / DLA',
  extraction: 'Cash extraction',
  capital: 'Capital / acquisition',
  liability: 'Tenant deposit / liability',
  exclude: 'Ignored from analysis',
  review: 'Needs review',
}
const categoryLabels = new Map([
  ...BANK_CATEGORIES,
  ['tax', 'Tax & property duties'], ['salary', 'Payroll'], ['fees', 'Bank & admin fees'],
  ['dla_injected', 'Owner funding / DLA'], ['dla_repaid', 'Owner funding / DLA'],
])
const transactionId = (transaction) => String(transaction?.id || `${transaction?.accountId || 'bank'}:${transaction?.transactionKey || transaction?.canonicalKey || ''}`)

export function BankAnalysisUndo({ count = 1, onUndo }) {
  return <div className="bank-analysis-undo" role="status"><span>{count === 1 ? 'Transaction excluded from analysis.' : `${count} transactions excluded from analysis.`}</span><button type="button" onClick={onUndo}><Undo2 size={15} /> Undo</button></div>
}

export function BankTransactionLedger({ rows = [], properties = [], onEdit, onToggleExcluded }) {
  const propertyNames = new Map((properties || []).map((property) => [String(property.id), property.name]))
  return <div className="bank-review-ledger" role="list" aria-label="All bank transactions">
    {rows.map((transaction) => {
      const description = transaction.description || transaction.counterparty || 'Transaction'
      const propertyName = propertyNames.get(String(transaction.propertyId || transaction.property_id || ''))
      const categoryLabel = categoryLabels.get(transaction.category) || transaction.category || 'Other'
      return <article className={`bank-review-ledger-row${transaction.excludeFromPerformance ? ' excluded' : ''}`} role="listitem" key={transactionId(transaction)}>
        <div className="bank-review-ledger-main"><b>{description}</b><small>{transaction.bookedAt} · {transaction.accountName || 'Bank account'}</small></div>
        <div className="bank-review-ledger-tags"><span>{categoryLabel}</span>{propertyName && <span>{propertyName}</span>}</div>
        <strong className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</strong>
        <div className="bank-review-ledger-actions">
          <label className="bank-inline-exclude compact" title="Remove this transaction from Banking charts and Performance without deleting the imported record"><BrainDrainNumericInput type="checkbox" checked={transaction.excludeFromPerformance === true} aria-label={`Exclude ${description} from analysis`} onChange={() => onToggleExcluded?.(transaction)} /><i /><span>{transaction.excludeFromPerformance ? 'Excluded' : 'Exclude'}</span></label>
          <button type="button" className="bank-review-row-edit" aria-label={`Edit ${description}`} onClick={() => onEdit?.(transaction)}>Edit</button>
        </div>
      </article>
    })}
  </div>
}

export default function BankTransactionReview({ transactions, properties = [], tenants = [], onUpdate, onUpdateMany }) {
  const [mode, setMode] = useState('review')
  const [sortMode, setSortMode] = useState('amount')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeReviewId, setActiveReviewId] = useState('')
  const [draft, setDraft] = useState(null)
  const [applySimilar, setApplySimilar] = useState(true)
  const [skippedIds, setSkippedIds] = useState([])
  const [exclusionUndo, setExclusionUndo] = useState(null)

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
  const baselineDraft = useMemo(() => active ? reviewDraftForTransaction(active, properties, tenants, transactions) : null, [active, properties, tenants, transactions])
  const currentDraft = draft?.transactionId === activeId ? draft : (baselineDraft ? { transactionId: activeId, ...baselineDraft } : null)
  const preview = active && currentDraft ? transactionWithReviewDraft(active, currentDraft) : active
  const previewTreatment = preview ? performanceTreatmentForTransaction(preview) : 'review'
  const needsMore = preview ? transactionNeedsReview(preview, properties) : false
  const similar = useMemo(() => active ? similarTransactionsNeedingReviewFor(active, transactions, properties) : [], [active, transactions, properties])
  const propertyRelevant = preview && (categoryUsesProperty(currentDraft?.category) || Boolean(preview.propertyId))
  const showTreatment = previewTreatment === 'review' || showAdvanced
  const quickCategories = active?.amount >= 0
    ? [['rent', 'Rent'], ['bank_interest', 'Bank interest'], ['owner_funding', 'Owner funding'], ['tenant_deposit', 'Deposit'], ['other_property_income', 'Other income']]
    : [['mortgage', 'Mortgage'], ['repairs', 'Repair'], ['cash_extraction', 'Cash extraction'], ['legal_professional', 'Legal']]

  useEffect(() => {
    if (!active) { setDraft(null); return }
    setDraft({ transactionId: activeId, ...reviewDraftForTransaction(active, properties, tenants, transactions) })
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
    const targets = applySimilar && similar.length ? [active, ...similar] : [active]
    const undoEntries = previewTreatment === 'exclude' ? exclusionUndoEntriesFor(targets) : []
    const result = applySimilar && similar.length
      ? await onUpdateMany?.(targets, patch)
      : await onUpdate?.(active, patch)
    if (result === false) return
    if (undoEntries.length) setExclusionUndo({ items: undoEntries })
    setActiveReviewId('')
    setDraft(null)
    setSkippedIds((current) => current.filter((id) => id !== activeId))
  }
  const undoLastExclusion = async () => {
    if (!exclusionUndo?.items?.length) return
    for (const item of exclusionUndo.items) {
      const result = await onUpdate?.(item.transaction, item.patch)
      if (result === false) return
    }
    setExclusionUndo(null)
  }
  const toggleLedgerExcluded = async (transaction) => {
    const nextExcluded = transaction.excludeFromPerformance !== true
    const result = await onUpdate?.(transaction, { exclude_from_performance: nextExcluded })
    if (result === false) return
    if (nextExcluded) setExclusionUndo({ items: exclusionUndoEntriesFor([transaction]) })
    else if (exclusionUndo?.items?.some((item) => transactionId(item.transaction) === transactionId(transaction))) setExclusionUndo(null)
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
      <div><span className="kicker">TRANSACTION REVIEW</span><h2>Review transactions</h2><p>Confirm suggestions, fix exceptions, and move on.</p></div>
      <div className="segmented"><button className={mode === 'review' ? 'active' : ''} onClick={() => switchMode('review')}>Review {reviewCount}</button><button className={mode === 'all' ? 'active' : ''} onClick={() => switchMode('all')}>All</button></div>
    </header>
    {exclusionUndo?.items?.length > 0 && <BankAnalysisUndo count={exclusionUndo.items.length} onUndo={undoLastExclusion} />}
    <div className="bank-toolbar"><div className="segmented" aria-label="Transaction review order"><button className={sortMode === 'amount' ? 'active' : ''} onClick={() => setSortMode('amount')}>Largest first</button><button className={sortMode === 'newest' ? 'active' : ''} onClick={() => setSortMode('newest')}>Newest</button></div>{active && <button type="button" className="text-button" onClick={() => setShowAdvanced((current) => !current)}>{showAdvanced ? 'Hide advanced' : 'Advanced'}</button>}</div>

    {mode === 'review' && !active && reviewCount === 0 && <div className="bank-review-empty"><Check size={18} /><span>All caught up. No transactions need review.</span></div>}
    {mode === 'review' && !active && reviewCount > 0 && <div className="bank-review-empty bank-review-skipped"><span>You skipped the {reviewCount} remaining transaction{reviewCount === 1 ? '' : 's'} for this session.</span><button type="button" className="secondary-button small" onClick={() => setSkippedIds([])}>Review skipped</button></div>}

    {active && currentDraft && <>
      <div className="bank-review-progress"><span><b>{reviewCount}</b> need attention</span>{mode === 'review' && <small>{Math.max(0, reviewQueue.length - 1)} after this one{skippedIds.length ? ` · ${skippedIds.length} skipped` : ''}</small>}{mode === 'all' && <button type="button" className="text-button" onClick={cancelEdit}>Back to all</button>}</div>
      <article className="bank-review-focus">
        <div className="bank-review-main"><span><b>{active.description || active.counterparty || 'Transaction'}</b><small>{active.bookedAt} · {active.accountName || 'Bank account'}{active.counterparty ? ` · ${active.counterparty}` : ''}</small></span><strong className={active.amount >= 0 ? 'positive' : 'negative'}>{money(active.amount)}</strong></div>
        {baselineDraft?.suggestionReason && !active.categoryOverridden && <div className="bank-review-smart-suggestion"><Sparkles size={14} /><span><b>Suggested for you</b><small>{baselineDraft.suggestionReason}</small></span></div>}
        <div className="bank-review-quick-categories" aria-label="Quick categories">{quickCategories.map(([value, label]) => <button type="button" key={value} className={currentDraft.category === value ? 'active' : ''} onClick={() => updateDraft({ category: value })}>{label}</button>)}</div>
        <div className="bank-review-fields">
          <label><span>Category</span><select value={currentDraft.category} onChange={(event) => updateDraft({ category: event.target.value })}>{BANK_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {propertyRelevant && <label><span>Property</span><select value={currentDraft.propertyId || ''} onChange={(event) => updateDraft({ propertyId: event.target.value })}><option value="">Choose property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>{baselineDraft?.propertyId && !active.propertyId && currentDraft.propertyId === baselineDraft.propertyId && <small>Suggested · {baselineDraft.suggestionReason || 'Transaction details match'}</small>}</label>}
          {showTreatment && <label><span>Cash-flow treatment</span><select value={currentDraft.performanceTreatment || 'auto'} onChange={(event) => updateDraft({ performanceTreatment: event.target.value })}><option value="auto">Auto · {treatmentLabels[performanceTreatmentForTransaction({ ...active, ...bankTransactionStatePatch(reviewPatchFromDraft({ ...currentDraft, performanceTreatment: 'auto' })) })] || 'Needs review'}</option><option value="operating">Property operating</option><option value="financing">Mortgage / financing</option><option value="company">Company overhead</option><option value="investor">Owner funding / DLA</option><option value="extraction">Cash extraction</option><option value="capital">Capital / acquisition</option><option value="liability">Tenant deposit / liability</option><option value="exclude">Ignore from analysis</option></select></label>}
          <label className="bank-inline-exclude bank-review-exclude" title="Remove this transaction from Banking charts and Performance without deleting the imported record"><BrainDrainNumericInput type="checkbox" checked={currentDraft.excludeFromPerformance === true} aria-label={`Exclude ${active.description || active.counterparty || 'transaction'} from analysis`} onChange={(event) => updateDraft({ excludeFromPerformance: event.target.checked })} /><i /><span>{currentDraft.excludeFromPerformance ? 'Excluded from analysis' : 'Exclude from analysis'}</span></label>
        </div>
        {needsMore && <p className="bank-review-hint">{['operating', 'financing', 'capital', 'liability'].includes(previewTreatment) ? 'Choose the property before saving.' : 'Choose how this transaction affects cash flow before saving.'}</p>}
        {similar.length > 0 && <label className="bank-review-batch"><BrainDrainNumericInput type="checkbox" checked={applySimilar} onChange={(event) => setApplySimilar(event.target.checked)} /><i /><span><b><Sparkles size={14} /> Also apply to {similar.length} matching transaction{similar.length === 1 ? '' : 's'}</b><small>Exact counterparty match · unresolved rows only</small></span></label>}
        <footer className="bank-review-actions"><button type="button" className="secondary-button" onClick={mode === 'review' ? skipCurrent : cancelEdit}>{mode === 'review' ? 'Skip' : 'Cancel'}</button><button type="button" className="primary-button" disabled={needsMore} onClick={saveCurrent}>{mode === 'review' ? <>Save & next <ArrowRight size={15} /></> : 'Save changes'}</button></footer>
      </article>
      {mode === 'review' && reviewQueue.length > 1 && <div className="bank-review-next"><span>Next up</span>{reviewQueue.slice(1, 4).map((transaction) => <div key={transactionId(transaction)}><b>{transaction.description || transaction.counterparty || 'Transaction'}</b><strong className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</strong></div>)}</div>}
    </>}

    {mode === 'all' && !active && <BankTransactionLedger rows={allRows} properties={properties} onEdit={(transaction) => setActiveReviewId(transactionId(transaction))} onToggleExcluded={toggleLedgerExcluded} />}
  </section>
}
