import React, { useMemo, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { createExpense } from './expenses.js'
import { DOCUMENT_TYPES, titleFromFilename } from './documents.js'
import { uploadStoredDocument } from './documentStorage.js'

const todayLocal = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default function DocumentCaptureSheet({ file, sourceMode = 'file', properties = [], contractors = [], contractorTags = [], companyName = '', initialContext = null, onCancel, onSave }) {
  const initialAssociation = initialContext?.propertyId ? `property:${initialContext.propertyId}` : 'unassigned'
  const [draft, setDraft] = useState({
    documentType: sourceMode === 'image' || sourceMode === 'photo' ? 'Receipt / invoice' : 'Other document',
    title: titleFromFilename(file?.name),
    date: todayLocal(),
    amount: '',
    entryType: 'expense',
    category: '',
    recurrence: '',
    notes: '',
    association: initialAssociation,
    contractorId: initialContext?.contractorId || '',
    tagIds: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedProperty = useMemo(() => draft.association.startsWith('property:')
    ? properties.find((property) => String(property.id) === draft.association.slice(9))
    : null, [draft.association, properties])
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const toggleTag = (id) => update('tagIds', draft.tagIds.includes(id) ? draft.tagIds.filter((value) => value !== id) : [...draft.tagIds, id])

  const submit = async (event) => {
    event.preventDefault()
    if (!draft.documentType || !draft.title.trim() || !draft.date) return
    if (draft.amount !== '' && (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0)) {
      setError('Amount must be positive, or leave it blank for a document-only record.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const entry = createExpense({ date: draft.date })
      const stored = await uploadStoredDocument(file, entry.id)
      const association = draft.association === 'company'
        ? { kind: 'company', id: 'company', label: companyName || 'Company' }
        : selectedProperty
          ? { kind: 'property', id: String(selectedProperty.id), label: selectedProperty.name || 'BTL' }
          : { kind: 'unassigned', id: '', label: '' }
      const amount = draft.amount === '' ? '' : (draft.entryType === 'income' ? Math.abs(Number(draft.amount)) : -Math.abs(Number(draft.amount)))
      onSave({
        ...entry,
        amount,
        property: selectedProperty?.name || 'All',
        category: draft.category.trim(),
        description: draft.title.trim(),
        recurrence: draft.recurrence.trim(),
        notes: draft.notes.trim(),
        document: {
          title: draft.title.trim(),
          type: draft.documentType,
          tagIds: draft.tagIds,
          contractorId: draft.contractorId,
          association,
          ...stored,
        },
      })
    } catch (caught) {
      setError(caught?.message || 'Could not save this document.')
      setSaving(false)
    }
  }

  return <div className="document-capture-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onCancel()}>
    <form className="document-capture-sheet" role="dialog" aria-modal="true" aria-labelledby="document-capture-title" onSubmit={submit}>
      <header>
        <div><span className="kicker">NEW DOCUMENT</span><h2 id="document-capture-title">Add document</h2><p>Confirm the document first. Financial details are optional.</p></div>
        <button type="button" className="icon-button" disabled={saving} aria-label="Close" onClick={onCancel}><X size={19} /></button>
      </header>

      <div className="document-capture-file"><FileText size={18} /><div><strong>{file?.name}</strong><small>{file?.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'Selected file'}</small></div></div>

      <div className="document-primary-fields">
        <label><span>Document type</span><select autoFocus required value={draft.documentType} onChange={(event) => update('documentType', event.target.value)}>{DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label><span>Title</span><input required value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Gas safety invoice" /></label>
      </div>

      <div className="document-secondary-grid">
        <label><span>Date</span><input required type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} /></label>
        <label><span>Association</span><select value={draft.association} onChange={(event) => update('association', event.target.value)}><option value="unassigned">Unassigned</option><option value="company">{companyName || 'Company'}</option>{properties.map((property) => <option key={property.id} value={`property:${property.id}`}>{property.name || 'BTL'}</option>)}</select></label>
        <label><span>Contractor</span><select value={draft.contractorId} onChange={(event) => update('contractorId', event.target.value)}><option value="">No contractor</option>{contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name || [contractor.firstName, contractor.lastName].filter(Boolean).join(' ') || contractor.companyName || 'Contractor'}</option>)}</select></label>
        <label><span>Category</span><input value={draft.category} onChange={(event) => update('category', event.target.value)} placeholder="Repairs, compliance…" /></label>
      </div>

      <fieldset className="document-tags"><legend>Tags</legend><div>{contractorTags.map((tag) => <button key={tag.id} type="button" className={draft.tagIds.includes(tag.id) ? 'active' : ''} aria-pressed={draft.tagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)}>{tag.label}</button>)}</div></fieldset>

      <section className="document-money-section">
        <div className="document-money-heading"><strong>Financial details</strong><small>Optional. Nothing is read or inferred from the file.</small></div>
        <div className="document-money-row">
          <label><span>Amount</span><div className="expense-modal-money"><i>£</i><input type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.amount} onChange={(event) => update('amount', event.target.value === '' ? '' : Number(event.target.value))} placeholder="Leave blank" /></div></label>
          <div className="expense-modal-type" role="group" aria-label="Entry type"><button type="button" className={draft.entryType === 'expense' ? 'active' : ''} onClick={() => update('entryType', 'expense')}>Expense</button><button type="button" className={draft.entryType === 'income' ? 'active' : ''} onClick={() => update('entryType', 'income')}>Income</button></div>
        </div>
        <div className="document-notes-row"><label><span>Recurrence</span><input value={draft.recurrence} onChange={(event) => update('recurrence', event.target.value)} placeholder="One-off, monthly…" /></label><label><span>Notes</span><textarea rows="2" value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Optional notes" /></label></div>
      </section>

      {error && <p className="document-capture-error" role="alert">{error}</p>}
      <p className="document-capture-privacy">The app stores the original privately. It does not OCR or parse document contents.</p>
      <footer><button type="button" className="secondary-button" disabled={saving} onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Uploading…' : 'Save document'}</button></footer>
    </form>
  </div>
}
