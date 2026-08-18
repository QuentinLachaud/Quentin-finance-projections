import React, { useMemo, useRef, useState } from 'react'
import { ExternalLink, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react'
import {
  createExpense, filterExpenses, inferExpenseType, isReceiptUrl,
  mergeExpenseImports, parseExpenseImport, summarizeExpenses,
} from './expenses.js'

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const blankFilters = { query: '', from: '', to: '', property: '__all__', type: '__all__', category: '__all__', recurrence: '__all__' }
const uniqueValues = (items, key) => [...new Set(items.map((item) => String(item[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))

function TypeBadge({ amount }) {
  const type = inferExpenseType(amount)
  const label = type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : type === 'neutral' ? 'Zero' : '—'
  return <span className={`expense-type ${type}`}>{label}</span>
}

export default function ExpensesWorkspace({ expenses = [], properties = [], onChange }) {
  const [filters, setFilters] = useState(blankFilters)
  const [importStatus, setImportStatus] = useState('')
  const importRef = useRef(null)

  const filtered = useMemo(() => filterExpenses(expenses, filters), [expenses, filters])
  const summary = useMemo(() => summarizeExpenses(filtered), [filtered])
  const allPropertyValues = useMemo(() => [...new Set([
    ...uniqueValues(expenses, 'property'),
    ...properties.map((property) => property.name).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [expenses, properties])
  const categories = useMemo(() => uniqueValues(expenses, 'category'), [expenses])
  const recurrences = useMemo(() => uniqueValues(expenses, 'recurrence'), [expenses])

  const update = (id, key, value) => onChange(expenses.map((item) => item.id === id ? { ...item, [key]: value } : item))
  const add = () => onChange([createExpense(), ...expenses])
  const remove = (id) => {
    if (window.confirm('Delete this ledger entry?')) onChange(expenses.filter((item) => item.id !== id))
  }
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

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

  return <div className="expenses-workspace">
    <section className="panel expenses-hero">
      <div>
        <span className="kicker">HISTORICAL LEDGER</span>
        <h2>Expenses</h2>
        <p>Track actual portfolio cash movements. Positive amounts are income and negative amounts are expenses. This ledger stays separate from projections and tax calculations.</p>
      </div>
      <div className="expenses-actions">
        <input ref={importRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" hidden onChange={importFile} />
        <button className="secondary-button small" onClick={() => importRef.current?.click()}><Upload size={15} /> Import CSV / TSV</button>
        <button className="primary-button small" onClick={add}><Plus size={15} /> Add entry</button>
      </div>
      {importStatus && <p className="expenses-import-status">{importStatus}</p>}
    </section>

    <section className="expenses-summary-grid">
      <article className="panel expense-summary income"><span>Income</span><strong>{money.format(summary.income)}</strong><small>matching filters</small></article>
      <article className="panel expense-summary expense"><span>Expenses</span><strong>{money.format(summary.expense)}</strong><small>absolute spend</small></article>
      <article className={`panel expense-summary ${summary.net >= 0 ? 'income' : 'expense'}`}><span>Net movement</span><strong>{money.format(summary.net)}</strong><small>income less expenses</small></article>
      <article className="panel expense-summary"><span>Entries</span><strong>{summary.count}</strong><small>{summary.count === expenses.length ? 'all entries' : `of ${expenses.length}`}</small></article>
    </section>

    <section className="panel expenses-filter-panel">
      <div className="expenses-search"><Search size={16} /><input value={filters.query} onChange={(event) => setFilter('query', event.target.value)} placeholder="Search description, notes, category, link…" /></div>
      <label><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} /></label>
      <label><span>To</span><input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} /></label>
      <label><span>Property</span><select value={filters.property} onChange={(event) => setFilter('property', event.target.value)}><option value="__all__">All</option>{allPropertyValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Type</span><select value={filters.type} onChange={(event) => setFilter('type', event.target.value)}><option value="__all__">All</option><option value="income">Income</option><option value="expense">Expense</option><option value="neutral">Zero</option><option value="unspecified">Unspecified</option></select></label>
      <label><span>Category</span><select value={filters.category} onChange={(event) => setFilter('category', event.target.value)}><option value="__all__">All</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Recurrence</span><select value={filters.recurrence} onChange={(event) => setFilter('recurrence', event.target.value)}><option value="__all__">All</option>{recurrences.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <button className="text-button expenses-clear" onClick={() => setFilters(blankFilters)}><RotateCcw size={14} /> Clear</button>
    </section>

    <section className="panel expenses-table-panel">
      <div className="expenses-table-wrap">
        <table className="expenses-table">
          <thead><tr><th>Date</th><th>Property</th><th>Type</th><th>Category</th><th>Amount (£)</th><th>Description</th><th>Recurrence</th><th>Notes</th><th>Receipt Link</th><th /></tr></thead>
          <tbody>
            {filtered.map((item) => <tr key={item.id}>
              <td><input type="date" value={item.date || ''} onChange={(event) => update(item.id, 'date', event.target.value)} /></td>
              <td><input list="expense-property-options" value={item.property || ''} onChange={(event) => update(item.id, 'property', event.target.value)} /></td>
              <td><TypeBadge amount={item.amount} /></td>
              <td><input value={item.category || ''} onChange={(event) => update(item.id, 'category', event.target.value)} /></td>
              <td className="expense-amount-cell"><input type="number" step="0.01" value={item.amount ?? ''} onChange={(event) => update(item.id, 'amount', event.target.value === '' ? '' : Number(event.target.value))} /></td>
              <td><input value={item.description || ''} onChange={(event) => update(item.id, 'description', event.target.value)} /></td>
              <td><input value={item.recurrence || ''} onChange={(event) => update(item.id, 'recurrence', event.target.value)} /></td>
              <td><input value={item.notes || ''} onChange={(event) => update(item.id, 'notes', event.target.value)} /></td>
              <td><div className="expense-receipt-field"><input value={item.receiptLink || ''} onChange={(event) => update(item.id, 'receiptLink', event.target.value)} />{isReceiptUrl(item.receiptLink) && <a href={item.receiptLink} target="_blank" rel="noreferrer" aria-label="Open receipt"><ExternalLink size={14} /></a>}</div></td>
              <td><button className="icon-button danger" onClick={() => remove(item.id)} aria-label="Delete expense entry"><Trash2 size={15} /></button></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan="10" className="expenses-empty">No entries match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <datalist id="expense-property-options">{allPropertyValues.map((value) => <option key={value} value={value} />)}</datalist>
    </section>
  </div>
}
