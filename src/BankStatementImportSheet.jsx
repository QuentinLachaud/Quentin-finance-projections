import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, X } from 'lucide-react'
import { supabase } from './supabase.js'
import { inferTideStatementAccountRole, inferTideStatementAccountRoleFromHistory, readTideStatementFile, tideStatementAccountRoleForAccount } from './bankStatementImport.js'

const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(value || 0))
const shortDate = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '—'

const isTideAccount = (account) => account?.institutionName?.toLowerCase().includes('tide')
  || String(account?.externalAccountId || '').startsWith('manual:tide')

const updateManualStatementBalance = async (account, closingBalance, statementTo) => {
  if (!account || !String(account.externalAccountId || '').startsWith('manual:tide')) return
  if (!Number.isFinite(Number(closingBalance)) || !statementTo) return
  if (account.balanceUpdatedAt && statementTo < String(account.balanceUpdatedAt).slice(0, 10)) return
  const { error } = await supabase.from('bank_accounts').update({
    current_balance: Number(closingBalance),
    balance_updated_at: `${statementTo}T23:59:59Z`,
  }).eq('id', account.id)
  if (error) throw error
}

const ensureStatementAccount = async ({ user, connections, accounts, role, closingBalance, statementTo, manualConnectionId }) => {
  if (!['current', 'savings'].includes(role)) throw new Error('Choose whether this statement belongs to the Current or Savings account.')
  const matching = accounts.find((account) => isTideAccount(account) && tideStatementAccountRoleForAccount(account) === role)
  if (matching) {
    await updateManualStatementBalance(matching, closingBalance, statementTo)
    return { accountId: matching.id, manualConnectionId: manualConnectionId || '' }
  }

  const manualConnection = connections.find((connection) => String(connection.requisition_id || '').startsWith('manual:tide:'))
  let connectionId = manualConnectionId || manualConnection?.id
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

  const legacyCurrent = role === 'current' ? accounts.find((account) => (
    account.connectionId === connectionId
    && String(account.externalAccountId || '').startsWith('manual:tide')
    && !tideStatementAccountRoleForAccount(account)
  )) : null
  if (legacyCurrent) {
    const patch = { account_type: 'current' }
    if (legacyCurrent.displayName === 'Tide statement history') patch.display_name = 'Tide Current account'
    if (Number.isFinite(Number(closingBalance)) && statementTo && (!legacyCurrent.balanceUpdatedAt || statementTo >= String(legacyCurrent.balanceUpdatedAt).slice(0, 10))) {
      patch.current_balance = Number(closingBalance)
      patch.balance_updated_at = `${statementTo}T23:59:59Z`
    }
    const { error } = await supabase.from('bank_accounts').update(patch).eq('id', legacyCurrent.id)
    if (error) throw error
    return { accountId: legacyCurrent.id, manualConnectionId: connectionId }
  }

  const { data, error } = await supabase.from('bank_accounts').insert({
    user_id: user.id,
    connection_id: connectionId,
    external_account_id: `manual:tide:${role}:${user.id}`,
    display_name: role === 'savings' ? 'Tide Savings account' : 'Tide Current account',
    account_type: role,
    currency: 'GBP',
    current_balance: Number.isFinite(Number(closingBalance)) ? Number(closingBalance) : null,
    balance_updated_at: Number.isFinite(Number(closingBalance)) && statementTo ? `${statementTo}T23:59:59Z` : null,
    include_in_cash: false,
  }).select('id').single()
  if (error) throw error
  return { accountId: data.id, manualConnectionId: connectionId }
}

const storedAccountRoleForStatement = async (statement, accounts) => {
  const allKeys = [...new Set((statement?.transactions || []).map((transaction) => transaction?.transactionKey).filter(Boolean))]
  const keys = [...new Set([...allKeys.slice(0, 20), ...allKeys.slice(-20)])]
  if (!keys.length) return ''
  const { data, error } = await supabase.from('bank_transactions').select('account_id,transaction_key').in('transaction_key', keys)
  if (error) throw error
  return inferTideStatementAccountRoleFromHistory(statement, data || [], accounts)
}

export default function BankStatementImportSheet({ user, connections, accounts, properties = [], onClose, onImported }) {
  const [files, setFiles] = useState([])
  const [parsed, setParsed] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [accountRoles, setAccountRoles] = useState({})
  const [inferredRoles, setInferredRoles] = useState({})
  const transactionCount = useMemo(() => parsed.reduce((sum, item) => sum + item.transactions.length, 0), [parsed])
  const missingAccountCount = useMemo(() => parsed.filter((item) => !accountRoles[item.fileHash]).length, [parsed, accountRoles])

  const chooseFiles = async (event) => {
    const selected = [...(event.target.files || [])]
    setFiles(selected)
    setParsed([])
    setAccountRoles({})
    setInferredRoles({})
    setResult(null)
    setError('')
    if (!selected.length) return
    setStatus('reading')
    try {
      const next = []
      for (const file of selected) next.push(await readTideStatementFile(file, properties))
      const historyRoles = {}
      for (const statement of next) historyRoles[statement.fileHash] = await storedAccountRoleForStatement(statement, accounts)
      const inferred = Object.fromEntries(next.map((statement) => [statement.fileHash, historyRoles[statement.fileHash] || inferTideStatementAccountRole(statement, next)]))
      setParsed(next)
      setInferredRoles(inferred)
      setAccountRoles(inferred)
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
      if (missingAccountCount) throw new Error('Choose Current account or Savings account for each statement before importing.')
      let imported = 0
      let skipped = 0
      const accountIdsByRole = new Map()
      let manualConnectionId = connections.find((connection) => String(connection.requisition_id || '').startsWith('manual:tide:'))?.id || ''
      const latestByRole = new Map()
      parsed.forEach((statement) => {
        const role = accountRoles[statement.fileHash]
        const current = latestByRole.get(role)
        if (!current || String(statement.statementTo || '') > String(current.statementTo || '')) latestByRole.set(role, statement)
      })
      for (const statement of parsed) {
        if (!statement.transactions.length) continue
        const { data: duplicate, error: duplicateError } = await supabase
          .from('bank_statement_imports')
          .select('id')
          .eq('file_hash', statement.fileHash)
          .maybeSingle()
        if (duplicateError) throw duplicateError
        if (duplicate) { skipped += 1; continue }

        const role = accountRoles[statement.fileHash]
        const latest = latestByRole.get(role) || statement
        let accountId = accountIdsByRole.get(role)
        if (!accountId) {
          const ensured = await ensureStatementAccount({
            user, connections, accounts, role,
            closingBalance: latest.closingBalance,
            statementTo: latest.statementTo,
            manualConnectionId,
          })
          accountId = ensured.accountId
          manualConnectionId = ensured.manualConnectionId || manualConnectionId
          accountIdsByRole.set(role, accountId)
        }
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
      const reconciliation = await onImported?.()
      setResult({ imported, skipped, reconciled: Number(reconciliation?.reconciled || 0) })
      setStatus('done')
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
        {parsed.map((statement) => <article key={statement.fileHash}><header><b>{statement.fileName}</b><span>{shortDate(statement.statementFrom)} – {shortDate(statement.statementTo)}</span></header><label className="bank-import-account-choice"><span>Account</span><select aria-label={`Account for ${statement.fileName}`} value={accountRoles[statement.fileHash] || ''} onChange={(event) => setAccountRoles((current) => ({ ...current, [statement.fileHash]: event.target.value }))}><option value="">Choose account</option><option value="current">Current account</option><option value="savings">Savings account</option></select>{inferredRoles[statement.fileHash] && inferredRoles[statement.fileHash] === accountRoles[statement.fileHash] && <small>Detected from statement</small>}</label>{statement.warnings.map((warning) => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}<div>{statement.transactions.slice(0, 5).map((transaction) => <span key={`${statement.fileHash}:${transaction.statementIndex}`}><time>{shortDate(transaction.bookedAt)}</time><b>{transaction.description}</b><em className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount)}</em></span>)}</div>{statement.transactions.length > 5 && <small>+{statement.transactions.length - 5} more</small>}</article>)}
      </div>}
      {result && <p className="bank-import-success"><CheckCircle2 size={17} />Imported {result.imported} transactions{result.skipped ? ` · ${result.skipped} duplicate file${result.skipped === 1 ? '' : 's'} skipped` : ''}{result.reconciled ? ` · ${result.reconciled} transfer entr${result.reconciled === 1 ? 'y' : 'ies'} matched automatically` : ''}.</p>}
      <footer><button className="secondary-button" type="button" onClick={onClose}>Close</button><button className="primary-button" type="button" disabled={!transactionCount || missingAccountCount > 0 || status === 'importing' || status === 'reading'} onClick={importStatements}>{status === 'importing' ? 'Importing…' : missingAccountCount ? 'Choose account for each file' : `Import ${transactionCount || ''} transactions`}</button></footer>
    </section>
  </div>
}
