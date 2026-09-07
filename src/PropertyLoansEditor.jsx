import React, { useMemo, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { currency } from './calculations.js'
import { createBlankLoan, effectiveLoanAmount, summarizePropertyLoans } from './loans.js'
import { LoanEditor } from './LoansWorkspace.jsx'
import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'

export default function PropertyLoansEditor({ property, loans = [], availableLoans = [], onChange, onRemove }) {
  const [expandedId, setExpandedId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const summary = useMemo(() => summarizePropertyLoans(property, loans), [property, loans])
  const unlinked = availableLoans.filter((loan) => !loan.propertyId && !loans.some((item) => item.id === loan.id))
  const update = (loan) => onChange(loans.some((item) => item.id === loan.id)
    ? loans.map((item) => item.id === loan.id ? loan : item)
    : [...loans, loan])
  const add = () => {
    const loan = { ...createBlankLoan(), propertyId: property.id }
    update(loan)
    setExpandedId(loan.id)
  }
  return <div className="property-loans-editor" aria-label="BTL loans">
    <div className="property-loans-total">
      <span><strong>{currency(summary.loanAmount)}</strong><small>Total outstanding · {summary.loanCount} loan{summary.loanCount === 1 ? '' : 's'}</small></span>
      <span><strong>{currency(summary.monthlyPayment)}</strong><small>Mortgage / month</small></span>
    </div>
    {loans.length === 0 && <p className="property-loans-empty">No loans associated with this BTL.</p>}
    {loans.map((loan) => {
      const expanded = expandedId === loan.id
      return <section className="property-loan-item" key={loan.id}>
        <button type="button" className="property-loan-heading" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? '' : loan.id)}>
          <span><b>{loan.lender || 'New loan'}</b><small>{currency(effectiveLoanAmount(loan))} · {(Number(loan.rate || 0) * 100).toFixed(2)}% · {loan.interestOnly !== false ? 'Interest only' : 'Repayment'}</small></span>
          <ChevronDown size={17} />
        </button>
        {expanded && <LoanEditor loan={loan} properties={[property]} allowAssociation={false} onSave={update} onDelete={() => setDeleteTarget(loan)} />}
      </section>
    })}
    <div className="property-loans-actions">
      <button type="button" className="secondary-button small" onClick={add}><Plus size={15} /> Add loan</button>
      {unlinked.length > 0 && <select aria-label="Associate existing loan" value="" onChange={(event) => {
        const selected = unlinked.find((loan) => loan.id === event.target.value)
        if (!selected) return
        update({ ...selected, propertyId: property.id })
        setExpandedId(selected.id)
      }}><option value="">Associate existing loan…</option>{unlinked.map((loan) => <option value={loan.id} key={loan.id}>{loan.lender || 'Unlabelled loan'} · {currency(effectiveLoanAmount(loan))}</option>)}</select>}
    </div>
    {deleteTarget && <DeleteConfirmDialog title="Remove this loan?" message={`Remove ${deleteTarget.lender || 'this loan'} from the BTL and Loans records? The property and all other loans will be kept.`} confirmLabel="Remove loan" onCancel={() => setDeleteTarget(null)} onConfirm={() => {
      onRemove(deleteTarget.id)
      if (expandedId === deleteTarget.id) setExpandedId('')
      setDeleteTarget(null)
    }} />}
  </div>
}
