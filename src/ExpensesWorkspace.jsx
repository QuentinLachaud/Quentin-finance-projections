import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Download, ExternalLink, FileImage, FileText, FileUp, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react'
import {
  createExpense, filterExpenses, inferExpenseType, isReceiptUrl,
  mergeExpenseImports, parseExpenseImport, summarizeExpenses,
} from './expenses.js'
import { exportTabularReport } from './reportExports.js'
import DocumentCaptureSheet from './DocumentCaptureSheet.jsx'
import { normalizeDocumentMeta } from './documents.js'
import { openStoredDocument, removeStoredDocument } from './documentStorage.js'

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const blankFilters = { query: '', from: '', to: '', property: '__all__', type: '__all__', category: '__all__', recurrence: '__all__' }
const uniqueValues = (items, key) => [...new Set(items.map((item) => String(item[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))

function TypeBadge({ amount }) {
  const type = inferExpenseType(amount)
  const label = type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : type === 'neutral' ? 'Zero' : '—'
  return <span className={`expense-type ${type}`}>{label}</span>
}

export default function ExpensesWorkspace({ expenses = [], properties = [], contractors = [], contractorTags = [], accountType = 'company', companyName = '', captureRequest = null, onCaptureRequestConsumed, onChange }) {
  const [filters, setFilters] = useState(blankFilters)
  const [importStatus, setImportStatus] = useState('')
  const [draftExpense, setDraftExpense] = useState(null)
  const [mobileTransferOpen, setMobileTransferOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [documentDraft, setDocumentDraft] = useState(null)
  const [captureContext, setCaptureContext] = useState(null)
  const importRef = useRef(null)
  const documentFileRef = useRef(null)
  const imageFileRef = useRef(null)
  const cameraRef = useRef(null)

  const filtered = useMemo(() => filterExpenses(expenses, filters), [expenses, filters])
  const summary = useMemo(() => summarizeExpenses(filtered), [filtered])
  const allPropertyValues = useMemo(() => [...new Set([
    ...uniqueValues(expenses, 'property'),
    ...properties.map((property) => property.name).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [expenses, properties])
  const categories = useMemo(() => uniqueValues(expenses, 'category'), [expenses])
  const recurrences = useMemo(() => uniqueValues(expenses, 'recurrence'), [expenses])
  const contractorNameById = useMemo(() => new Map(contractors.map((contractor) => [String(contractor.id), contractor.name || [contractor.firstName, contractor.lastName].filter(Boolean).join(' ') || contractor.companyName || 'Contractor'])), [contractors])
  const contractorLabelFor = (item) => item.document?.contractorId ? (contractorNameById.get(String(item.document.contractorId)) || 'Former contractor') : '—'
  const incomeLabel = accountType === 'company' ? 'Income & DLA' : 'Income'
  const ledgerSignHelp = accountType === 'company'
    ? 'Positive amounts are income or DLA funding; negative amounts are expenses.'
    : 'Positive amounts are income; negative amounts are expenses.'

  useEffect(() => {
    if (!captureRequest) return
    setCaptureContext(captureRequest)
    setAddMenuOpen(true)
    onCaptureRequestConsumed?.()
  }, [captureRequest, onCaptureRequestConsumed])

  const update = (id, key, value) => onChange(expenses.map((item) => item.id === id ? { ...item, [key]: value } : item))
  const openAddExpense = () => setDraftExpense({
    ...createExpense({ date: new Date().toISOString().slice(0, 10), property: 'All' }),
    entryType: 'expense',
    amount: '',
  })
  const updateDraft = (key, value) => setDraftExpense((current) => current ? { ...current, [key]: value } : current)
  const saveDraftExpense = (event) => {
    event.preventDefault()
    if (!draftExpense?.date || draftExpense.amount === '' || !Number.isFinite(Number(draftExpense.amount)) || Number(draftExpense.amount) <= 0) return
    const { entryType, ...entry } = draftExpense
    entry.amount = entryType === 'income' ? Math.abs(Number(entry.amount)) : -Math.abs(Number(entry.amount))
    onChange([entry, ...expenses])
    setDraftExpense(null)
  }
  const remove = async (id) => {
    const target = expenses.find((item) => item.id === id)
    if (!window.confirm(target?.document ? 'Delete this document and ledger entry?' : 'Delete this ledger entry?')) return
    if (target?.document?.storagePath) {
      try { await removeStoredDocument(target.document.storagePath) }
      catch (error) { window.alert(`Could not delete the stored file: ${error.message}`); return }
    }
    onChange(expenses.filter((item) => item.id !== id))
  }
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const selectDocument = (sourceMode) => (event) => {
    const file = event.target.files?.[0]
    if (file) { setDocumentDraft({ file, sourceMode, initialContext: captureContext }); setAddMenuOpen(false) }
    event.target.value = ''
  }
  const addUploadedDocument = (entry) => { onChange([entry, ...expenses]); setDocumentDraft(null); setCaptureContext(null) }
  const openDocument = async (item) => {
    try { await openStoredDocument(item?.document?.storagePath) }
    catch (error) { window.alert(error.message) }
  }

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseExpenseImport(await file.text())
      const merged = mergeExpenseImports(expenses, parsed)
      onChange(merged.expenses)
      setImportStatus(`${merged.added} imported${merged.duplicates ? ` · ${merged.duplicates} duplicate${merged.duplicates === 1 ? '' : 's'} skipped` : ''}`)
    } catch (error) {
      setImportStatus(`Import failed: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }


  const exportExpenseReport = (format) => {
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'property', label: 'Property' },
      { key: 'type', label: 'Type' },
      { key: 'category', label: 'Category' },
      { key: 'amount', label: 'Amount (£)' },
      { key: 'description', label: 'Description' },
      { key: 'recurrence', label: 'Recurrence' },
      { key: 'notes', label: 'Notes' },
      { key: 'documentType', label: 'Document type' },
      { key: 'documentTitle', label: 'Document title' },
      { key: 'documentAssociation', label: 'Document association' },
      { key: 'receiptLink', label: 'Receipt link' },
    ]
    const rows = filtered.map((item) => ({
      ...item,
      type: inferExpenseType(item.amount) === 'income' ? 'Income' : inferExpenseType(item.amount) === 'expense' ? 'Expense' : 'Unspecified',
      amount: item.amount === '' ? '' : Number(item.amount),
      documentType: item.document?.type || '',
      documentTitle: item.document?.title || '',
      documentAssociation: item.document?.association?.label || (item.document?.association?.kind === 'unassigned' ? 'Unassigned' : ''),
    }))
    const activeFilterParts = [
      filters.from && `from ${filters.from}`,
      filters.to && `to ${filters.to}`,
      filters.property !== '__all__' && `property ${filters.property}`,
      filters.type !== '__all__' && `type ${filters.type}`,
      filters.category !== '__all__' && `category ${filters.category}`,
      filters.recurrence !== '__all__' && `recurrence ${filters.recurrence}`,
      filters.query && `search "${filters.query}"`,
    ].filter(Boolean)
    return exportTabularReport(format, {
      fileBase: 'btl-portfolio-expenses',
      title: 'Expense report',
      subtitle: activeFilterParts.length ? `Current filtered ledger · ${activeFilterParts.join(' · ')}` : 'Complete expense ledger',
      summary: [
        [incomeLabel, money.format(summary.income)],
        ['Expenses', money.format(summary.expense)],
        ['Net movement', money.format(summary.net)],
        ['Entries', String(summary.count)],
      ],
      columns,
      rows,
      recordTitle: (row) => `${row.date || 'No date'} · ${row.description || row.category || 'Ledger entry'} · ${row.amount === '' ? '—' : money.format(row.amount)}`,
    })
  }

  const activeFilterCount = [
    filters.from,
    filters.to,
    filters.property !== '__all__' ? filters.property : '',
    filters.type !== '__all__' ? filters.type : '',
    filters.category !== '__all__' ? filters.category : '',
    filters.recurrence !== '__all__' ? filters.recurrence : '',
  ].filter(Boolean).length

  return <div className="expenses-workspace">
    <section className="panel expenses-command-bar">
      <div className="expenses-command-context"><span>{ledgerSignHelp}</span></div>
      <div className="expenses-actions">
        <div className="report-export-control desktop-expense-transfer" aria-label="Export expense report">
          <span><Download size={14} /> Export</span>
          <button type="button" onClick={() => exportExpenseReport('csv')}>CSV</button>
          <button type="button" onClick={() => exportExpenseReport('xlsx')}>XLSX</button>
          <button type="button" onClick={() => exportExpenseReport('pdf')}>PDF</button>
        </div>
        <input ref={importRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" hidden onChange={importFile} />
        <input ref={documentFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*" hidden onChange={selectDocument('file')} />
        <input ref={imageFileRef} type="file" accept="image/*" hidden onChange={selectDocument('image')} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={selectDocument('photo')} />
        <button className="secondary-button small desktop-expense-transfer" onClick={() => importRef.current?.click()}><Upload size={15} /> Import CSV / TSV</button>
        <button className="secondary-button small mobile-expense-transfer-button" onClick={() => setMobileTransferOpen(true)}><Download size={15} /> Import / Export</button>
        <button className="primary-button small" onClick={() => setAddMenuOpen(true)}><Plus size={15} /> Add</button>
      </div>
      {importStatus && <p className="expenses-import-status">{importStatus}</p>}
    </section>

    <section className="expenses-summary-grid">
      <article className="panel expense-summary income"><span>{incomeLabel}</span><strong>{money.format(summary.income)}</strong><small>positive ledger entries</small></article>
      <article className="panel expense-summary expense"><span>Expenses</span><strong>{money.format(summary.expense)}</strong><small>absolute spend</small></article>
      <article className={`panel expense-summary ${summary.net >= 0 ? 'income' : 'expense'}`}><span>Net movement</span><strong>{money.format(summary.net)}</strong><small>income less expenses</small></article>
      <article className="panel expense-summary"><span>Entries</span><strong>{summary.count}</strong><small>{summary.count === expenses.length ? 'all entries' : `of ${expenses.length}`}</small></article>
    </section>

    <section className={`panel expenses-filter-panel ${mobileFiltersOpen ? 'mobile-filters-open' : ''}`}>
      <div className="expenses-search"><Search size={16} /><input value={filters.query} onChange={(event) => setFilter('query', event.target.value)} placeholder="Search documents & expenses…" /></div>
      <button type="button" className="mobile-expense-filter-toggle" aria-expanded={mobileFiltersOpen} onClick={() => setMobileFiltersOpen((current) => !current)}>
        <SlidersHorizontal size={15} />
        <span>Filters</span>
        {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
      </button>
      <div className="expenses-filter-fields">
        <label><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} /></label>
        <label><span>To</span><input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} /></label>
        <label><span>Property</span><select value={filters.property} onChange={(event) => setFilter('property', event.target.value)}><option value="__all__">All</option>{allPropertyValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Type</span><select value={filters.type} onChange={(event) => setFilter('type', event.target.value)}><option value="__all__">All</option><option value="income">Income</option><option value="expense">Expense</option><option value="neutral">Zero</option><option value="unspecified">Unspecified</option></select></label>
        <label><span>Category</span><select value={filters.category} onChange={(event) => setFilter('category', event.target.value)}><option value="__all__">All</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Recurrence</span><select value={filters.recurrence} onChange={(event) => setFilter('recurrence', event.target.value)}><option value="__all__">All</option>{recurrences.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <button className="text-button expenses-clear" onClick={() => { setFilters(blankFilters); setMobileFiltersOpen(false) }}><RotateCcw size={14} /> Clear filters</button>
      </div>
    </section>

    <section className="panel expenses-table-panel">
      <div className="expenses-table-wrap">
        <table className="expenses-table">
          <thead><tr><th>Date</th><th>Property</th><th>Type</th><th>Category</th><th>Amount (£)</th><th>Description</th><th>Document</th><th>Contractor</th><th>Recurrence</th><th>Notes</th><th>Receipt Link</th><th /></tr></thead>
          <tbody>
            {filtered.map((item) => <tr key={item.id}>
              <td><input type="date" value={item.date || ''} onChange={(event) => update(item.id, 'date', event.target.value)} /></td>
              <td><input list="expense-property-options" value={item.property || ''} onChange={(event) => update(item.id, 'property', event.target.value)} /></td>
              <td><TypeBadge amount={item.amount} /></td>
              <td><input value={item.category || ''} onChange={(event) => update(item.id, 'category', event.target.value)} /></td>
              <td className="expense-amount-cell"><input type="number" step="0.01" value={item.amount ?? ''} onChange={(event) => update(item.id, 'amount', event.target.value === '' ? '' : Number(event.target.value))} /></td>
              <td><input value={item.description || ''} onChange={(event) => update(item.id, 'description', event.target.value)} /></td>
              <td>{item.document ? <div className="expense-document-cell"><button type="button" onClick={() => openDocument(item)} aria-label={`Open ${item.document.title || 'document'}`}><FileText size={15} /></button><div><b>{normalizeDocumentMeta(item.document)?.title || 'Document'}</b><small>{normalizeDocumentMeta(item.document)?.type}</small></div></div> : <span className="expense-document-empty">—</span>}</td>
              <td><span className="expense-contractor-label">{contractorLabelFor(item)}</span></td>
              <td><input value={item.recurrence || ''} onChange={(event) => update(item.id, 'recurrence', event.target.value)} /></td>
              <td><input value={item.notes || ''} onChange={(event) => update(item.id, 'notes', event.target.value)} /></td>
              <td><div className="expense-receipt-field"><input value={item.receiptLink || ''} onChange={(event) => update(item.id, 'receiptLink', event.target.value)} />{isReceiptUrl(item.receiptLink) && <a href={item.receiptLink} target="_blank" rel="noreferrer" aria-label="Open receipt"><ExternalLink size={14} /></a>}</div></td>
              <td><button className="icon-button danger" onClick={() => remove(item.id)} aria-label="Delete expense entry"><Trash2 size={15} /></button></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan="11" className="expenses-empty">No entries match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="expenses-mobile-list">
        {filtered.map((item) => <details className="expense-mobile-card" key={`mobile-${item.id}`}>
          <summary>
            <div className="expense-mobile-summary-main">
              <span>{item.date || 'No date'}</span>
              <b>{item.document?.title || item.description || item.category || 'Expense entry'}</b>
              <small>{[item.property && item.property !== 'All' ? item.property : '', item.category].filter(Boolean).join(' · ') || 'Portfolio'}</small>
            </div>
            <div className="expense-mobile-summary-value">
              <strong className={Number(item.amount) >= 0 ? 'positive' : 'negative'}>{item.amount === '' ? '—' : money.format(Number(item.amount))}</strong>
              <TypeBadge amount={item.amount} />
            </div>
          </summary>
          <div className="expense-mobile-fields">
            <label><span>Date</span><input type="date" value={item.date || ''} onChange={(event) => update(item.id, 'date', event.target.value)} /></label>
            <label><span>Amount (£)</span><input type="number" step="0.01" value={item.amount ?? ''} onChange={(event) => update(item.id, 'amount', event.target.value === '' ? '' : Number(event.target.value))} /></label>
            <label className="expense-mobile-wide"><span>Description</span><input value={item.description || ''} onChange={(event) => update(item.id, 'description', event.target.value)} /></label>
            <label><span>Property</span><input list="expense-property-options" value={item.property || ''} onChange={(event) => update(item.id, 'property', event.target.value)} /></label>
            <label><span>Category</span><input value={item.category || ''} onChange={(event) => update(item.id, 'category', event.target.value)} /></label>
            <label><span>Recurrence</span><input value={item.recurrence || ''} onChange={(event) => update(item.id, 'recurrence', event.target.value)} /></label>
            {item.document && <div className="expense-mobile-wide expense-document-cell"><button type="button" onClick={() => openDocument(item)}><FileText size={15} /></button><div><b>{item.document.title}</b><small>{item.document.type} · {item.document.association?.label || 'Unassigned'}</small></div></div>}
            {item.document?.contractorId && <div className="expense-mobile-wide expense-contractor-mobile"><span>Contractor</span><b>{contractorLabelFor(item)}</b></div>}
            <label className="expense-mobile-wide"><span>Receipt link</span><div className="expense-receipt-field"><input value={item.receiptLink || ''} onChange={(event) => update(item.id, 'receiptLink', event.target.value)} />{isReceiptUrl(item.receiptLink) && <a href={item.receiptLink} target="_blank" rel="noreferrer" aria-label="Open receipt"><ExternalLink size={14} /></a>}</div></label>
            <label className="expense-mobile-wide"><span>Notes</span><input value={item.notes || ''} onChange={(event) => update(item.id, 'notes', event.target.value)} /></label>
            <button className="danger-button expense-mobile-delete" onClick={() => remove(item.id)}><Trash2 size={15} /> Delete entry</button>
          </div>
        </details>)}
        {!filtered.length && <div className="expenses-empty">No entries match these filters.</div>}
      </div>
      <datalist id="expense-property-options">{allPropertyValues.map((value) => <option key={value} value={value} />)}</datalist>
    </section>


    {addMenuOpen && <div className="document-add-menu-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAddMenuOpen(false)}>
      <section className="document-add-menu" role="dialog" aria-modal="true" aria-labelledby="document-add-title">
        <header><div><span className="kicker">ADD RECORD</span><h2 id="document-add-title">What are you adding?</h2><p>Keep manual entry fast, or attach the original document.</p></div><button type="button" className="icon-button" onClick={() => setAddMenuOpen(false)}><X size={19} /></button></header>
        <div className="document-add-options">
          <button type="button" onClick={() => { setAddMenuOpen(false); openAddExpense() }}><Plus size={20} /><b>Manual expense</b><small>Same quick ledger entry</small></button>
          <button type="button" onClick={() => documentFileRef.current?.click()}><FileUp size={20} /><b>Upload file</b><small>PDF, Office, text or image</small></button>
          <button type="button" onClick={() => imageFileRef.current?.click()}><FileImage size={20} /><b>Upload image</b><small>Choose from your library</small></button>
          <button type="button" className="document-camera-option" onClick={() => cameraRef.current?.click()}><Camera size={20} /><b>Take photo</b><small>Use the rear camera</small></button>
        </div>
      </section>
    </div>}

    {documentDraft && <DocumentCaptureSheet file={documentDraft.file} sourceMode={documentDraft.sourceMode} initialContext={documentDraft.initialContext} properties={properties} contractors={contractors} contractorTags={contractorTags} companyName={companyName} onCancel={() => setDocumentDraft(null)} onSave={addUploadedDocument} />}


    {mobileTransferOpen && <div className="expense-transfer-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setMobileTransferOpen(false)
    }}>
      <section className="expense-transfer-sheet" role="dialog" aria-modal="true" aria-labelledby="expense-transfer-title">
        <header>
          <div><span className="kicker">EXPENSE DATA</span><h2 id="expense-transfer-title">Import or export</h2><p>Choose what you want to do with this ledger.</p></div>
          <button type="button" className="icon-button" aria-label="Close import or export" onClick={() => setMobileTransferOpen(false)}><X size={19} /></button>
        </header>
        <button type="button" className="expense-transfer-primary" onClick={() => {
          setMobileTransferOpen(false)
          importRef.current?.click()
        }}><Upload size={18} /><span><b>Import transactions</b><small>CSV or TSV file</small></span></button>
        <div className="expense-transfer-export">
          <span>Export current report</span>
          <div>
            <button type="button" onClick={() => { setMobileTransferOpen(false); exportExpenseReport('csv') }}>CSV</button>
            <button type="button" onClick={() => { setMobileTransferOpen(false); exportExpenseReport('xlsx') }}>XLSX</button>
            <button type="button" onClick={() => { setMobileTransferOpen(false); exportExpenseReport('pdf') }}>PDF</button>
          </div>
          <small>Exports respect the filters currently applied.</small>
        </div>
      </section>
    </div>}

    {draftExpense && <div className="expense-modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setDraftExpense(null)
    }}>
      <form className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" onSubmit={saveDraftExpense}>
        <header>
          <div><span className="kicker">NEW LEDGER ENTRY</span><h2 id="expense-modal-title">Add expense</h2><p>Enter the essentials first. Everything else is optional.</p></div>
          <button type="button" className="icon-button expense-modal-close" aria-label="Close" onClick={() => setDraftExpense(null)}><X size={19} /></button>
        </header>

        <div className="expense-modal-required">
          <label><span>Date <b>Required</b></span><input autoFocus required type="date" value={draftExpense.date || ''} onChange={(event) => updateDraft('date', event.target.value)} /></label>
          <label><span>Amount <b>Required</b></span><div className="expense-modal-money"><i>£</i><input required type="number" min="0.01" step="0.01" inputMode="decimal" value={draftExpense.amount ?? ''} onChange={(event) => updateDraft('amount', event.target.value === '' ? '' : Number(event.target.value))} placeholder="0.00" /></div></label>
        </div>

        <div className="expense-modal-type" role="group" aria-label="Entry type">
          <button type="button" className={draftExpense.entryType === 'expense' ? 'active' : ''} onClick={() => updateDraft('entryType', 'expense')}>Expense</button>
          <button type="button" className={draftExpense.entryType === 'income' ? 'active' : ''} onClick={() => updateDraft('entryType', 'income')}>Income</button>
        </div>

        <div className="expense-modal-fields">
          <label className="expense-modal-description"><span>Description</span><input value={draftExpense.description || ''} onChange={(event) => updateDraft('description', event.target.value)} placeholder="What was this for?" /></label>
          <label><span>Property</span><input list="expense-property-options" value={draftExpense.property || ''} onChange={(event) => updateDraft('property', event.target.value)} placeholder="All" /></label>
          <label><span>Category</span><input value={draftExpense.category || ''} onChange={(event) => updateDraft('category', event.target.value)} placeholder="Repairs, insurance…" /></label>
          <label><span>Recurrence</span><input value={draftExpense.recurrence || ''} onChange={(event) => updateDraft('recurrence', event.target.value)} placeholder="One-off, monthly…" /></label>
          <label className="expense-modal-receipt"><span>Receipt link</span><input type="url" value={draftExpense.receiptLink || ''} onChange={(event) => updateDraft('receiptLink', event.target.value)} placeholder="https://…" /></label>
          <label className="expense-modal-notes"><span>Notes</span><textarea value={draftExpense.notes || ''} onChange={(event) => updateDraft('notes', event.target.value)} rows="3" placeholder="Optional notes" /></label>
        </div>

        <footer>
          <button type="button" className="secondary-button" onClick={() => setDraftExpense(null)}>Cancel</button>
          <button type="submit" className="primary-button">Add {draftExpense.entryType === 'income' ? 'income' : 'expense'}</button>
        </footer>
      </form>
    </div>}
  </div>
}
