import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, X } from 'lucide-react'
import { supabase } from './supabase.js'
import { readTideStatementFile } from './bankStatementImport.js'

const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(value || 0))
const shortDate = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '—'

const ensureStatementAccount = async ({ user, connections, accounts, closingBalance, statementTo }) => {
  const liveTide = accounts.find((account) => account.institutionName?.toLowerCase().includes('tide') && !String(account.externalAccountId || '').startsWith('manual:tide'))
  if (liveTide) return liveTide.id

  const manualConnection = connections.find((connection) => String(connection.requisition_id || '').startsWith('manual:tide:'))
  let connectionId = manualConnection?.id
  if (!connectionId) {
    const { data, error } = await supabase.from('bank_connections').insert({
      user_id: user.id,
      requisition_id: `manual:tide:${crypto.randomUUID()}`,
      institution_id: 'TIDE_STATEMENT',
      institution_name: 'Tide',
      status: 'MANUAL',
    }).select('id').single()
    if (error) throw error
    connectionId = data.id
  }

  const existing = accounts.find((account) => account.connectionId === connectionId)
  if (existing) {
    if (Number.isFinite(Number(closingBalance)) && statementTo && (!existing.balanceUpdatedAt || statementTo >= String(existing.balanceUpdatedAt).slice(0, 10))) {
      const { error } = await supabase.from('bank_accounts').update({
        current_balance: Number(closingBalance),
        balance_updated_at: `${statementTo}T23:59:59Z`,
      }).eq('id', existing.id)
      if (error) throw error
    }
    return existing.id
  }

  const { data, error } = await supabase.from('bank_accounts').insert({
    user_id: user.id,
    connection_id: connectionId,
    external_account_id: `manual:tide:${user.id}`,
    display_name: 'Tide statement history',
    currency: 'GBP',
    current_balance: Number.isFinite(Number(closingBalance)) ? Number(closingBalance) : 0,
    balance_updated_at: statementTo ? `${statementTo}T23:59:59Z` : null,
    include_in_cash: false,
  }).select('id').single()
  if (error) throw error
  return data.id
}

export default function BankStatementImportSheet({ user, connections, accounts, properties = [], onClose, onImported }) {
  const [files, setFiles] = useState([])
  const [parsed, setParsed] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const transactionCount = useMemo(() => parsed.reduce((sum, item) => sum + item.transactions.length, 0), [parsed])

  const chooseFiles = async (event) => {
    const selected = [...(event.target.files || [])]
    setFiles(selected)
    setParsed([])
    setResult(null)
    setError('')
    if (!selected.length) return
    setStatus('reading')
    try {
      const next = []
      for (const file of selected) next.push(await readTideStatementFile(file, properties))
      setParsed(next)
      setStatus('ready')
    } catch (readError) {
      setError(readError.message || 'The statement could not be read.')
      setStatus('error')
    }
  }

  const importStatements = async () => {
    setStatus('importing')
    setError('')
    try {
      let imported = 0
      let skipped = 0
      let statementAccountId = null
      for (const statement of parsed) {
        if (!statement.transactions.length) continue
        const { data: duplicate, error: duplicateError } = await supabase
          .from('bank_statement_imports')
          .select('id')
          .eq('file_hash', statement.fileHash)
          .maybeSingle()
        if (duplicateError) throw duplicateError
        if (duplicate) { skipped += 1; continue }

        const accountId = statementAccountId || await ensureStatementAccount({
          user, connections, accounts,
          closingBalance: statement.closingBalance,
          statementTo: statement.statementTo,
        })
        statementAccountId = accountId
        const { data: importRow, error: importError } = await supabase.from('bank_statement_imports').insert({
          user_id: user.id,
          account_id: accountId,
          file_name: statement.fileName,
          file_hash: statement.fileHash,
          statement_from: statement.statementFrom || null,
          statement_to: statement.statementTo || null,
          transaction_count: statement.transactions.length,
        }).select('id').single()
        if (importError) throw importError

        const rows = statement.transactions.map((transaction) => ({
          user_id: user.id,
          account_id: accountId,
          transaction_key: transaction.transactionKey || `statement:${statement.fileHash}:${transaction.statementIndex}`,
          booked_at: transaction.bookedAt || null,
          value_at: transaction.valueAt || null,
          amount: transaction.amount,
          currency: transaction.currency || 'GBP',
          description: transaction.description || 'Tide transaction',
          counterparty: transaction.counterparty || null,
          status: transaction.status || 'booked',
          balance_after: transaction.balanceAfter,
          category: transaction.category,
          is_transfer: transaction.isTransfer === true || transaction.category === 'transfer',
          category_overridden: false,
          source_type: 'tide_statement',
          import_id: importRow.id,
          property_id: transaction.propertyId || null,
          performance_treatment: 'auto',
          exclude_from_performance: false,
          source_metadata: transaction.sourceMetadata || {},
        }))
        const { error: transactionError } = await supabase.from('bank_transactions').upsert(rows, {
          onConflict: 'user_id,account_id,transaction_key',
        })
        if (transactionError) {
          await supabase.from('bank_statement_imports').delete().eq('id', importRow.id)
          throw transactionError
        }
        imported += statement.transactions.length
      }
      setResult({ imported, skipped })
      setStatus('done')
      await onImported?.()
    } catch (importError) {
      setError(importError.message || 'The Tide statements could not be imported.')
      setStatus('error')
    }
  }

  return <div className="bank-import-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="bank-import-sheet" role="dialog" aria-modal="true" aria-labelledby="bank-import-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="kicker">TIDE STATEMENTS</span><h2 id="bank-import-title">Import bank history</h2><p>Upload one or many Tide CSV exports or PDF statements. Files are parsed locally; only transaction data is saved.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close statement import"><X size={18} /></button></header>
      <label className="bank-import-drop"><FileUp size={22} /><b>Choose Tide statements</b><span>CSV preferred · PDF supported · multiple files allowed</span><input type="file" multiple accept=".csv,text/csv,.pdf,application/pdf" onChange={chooseFiles} /></label>
      {status === 'reading' && <p className="bank-import-status">Reading {files.length} statement{files.length === 1 ? '' : 's'}…</p>}
      {error && <p className="bank-error"><AlertTriangle size={16} />{error}</p>}
      {parsed.length > 0 && <div className="bank-import-preview">
        <div className="bank-import-summary"><span><b>{parsed.length}</b><small>files</small></span><span><b>{transactionCount}</b><small>transactions</small></span><span><b>{parsed.filter((item) => item.warnings.length).length}</b><small>warnings</small></span></div>
        {parsed.map((statement) => <article key={statement.fileHash}><header><b>{statement.fileName}</b><span>{shortDate(statement.statementFrom)} – {shortDate(statement.statementTo)}</span></header>{statement.warnings.map((warning) => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}<div>{statement.transactions.slice(0, 5).map((transaction) => <span key={`${statement.fileHash}:${transaction.statementIndex}`}><time>{shortDate(transaction.bookedAt)}</time><b>{transaction.description}</b><em className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</em></span>)}</div>{statement.transactions.length > 5 && <small>+{statement.transactions.length - 5} more</small>}</article>)}
      </div>}
      {result && <p className="bank-import-success"><CheckCircle2 size={17} />Imported {result.imported} transactions{result.skipped ? ` · ${result.skipped} duplicate file${result.skipped === 1 ? '' : 's'} skipped` : ''}.</p>}
      <footer><button className="secondary-button" type="button" onClick={onClose}>Close</button><button className="primary-button" type="button" disabled={!transactionCount || status === 'importing' || status === 'reading'} onClick={importStatements}>{status === 'importing' ? 'Importing…' : `Import ${transactionCount || ''} transactions`}</button></footer>
    </section>
  </div>
}
