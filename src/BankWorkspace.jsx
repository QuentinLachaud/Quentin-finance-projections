import BrainDrainNumericInput from './BrainDrainNumericInput.jsx'
import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, Download, ExternalLink,
  FileText, Landmark, Link2, RefreshCw, Search, ShieldCheck, Trash2, WalletCards,
} from 'lucide-react'
import { supabase } from './supabase.js'
import {
  aggregateCashFlow, authoritativeAccountBalance, calculateBankMetrics, latestAccountBalance, latestCashHeldFromAccounts,
  bankTransactionStatePatch, deduplicateTransactions, detectInternalTransfers, mapStoredBankTransaction, reconstructBalanceSeries, reportingAccountIds,
  summarizeCashFlowPipeline, transactionsToCsv, trueCashFlowTransactions,
} from './banking.js'
import { currency, shortDate } from './calculations.js'
import BankStatementImportSheet from './BankStatementImportSheet.jsx'
import BankTransactionReview from './BankTransactionReview.jsx'
import { BalanceChart, BankSummary, CashFlowReconciliation } from './BankingVisuals.jsx'
import { formatCashPeriod } from './bankingChart.js'
import { bankingCashFlowSeries, bankingTimelineRange, alignBankingBalanceSeries } from './bankingTimeline.js'

const money = (value, currencyCode = 'GBP') => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: currencyCode || 'GBP', maximumFractionDigits: 2,
}).format(Number(value || 0))

const apiRequest = async (action, body) => {
  const { data } = await supabase.auth.getSession()
  const response = await fetch(`/api/banking${action ? `?action=${encodeURIComponent(action)}` : ''}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${data.session?.access_token || ''}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Bank data is temporarily unavailable.')
    error.code = payload.code
    throw error
  }
  return payload
}

const readAllRows = async (table, select = '*', order) => {
  const rows = []
  let offset = 0
  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + 999)
    if (order) query = query.order(order, { ascending: true })
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) return rows
    offset += 1000
  }
}

const mapAccount = (row) => ({
  id: row.id,
  connectionId: row.connection_id,
  externalAccountId: row.external_account_id,
  displayName: row.display_name,
  ownerName: row.owner_name,
  ibanLast4: row.iban_last4,
  currency: row.currency,
  accountType: row.account_type,
  currentBalance: row.current_balance == null ? null : Number(row.current_balance),
  availableBalance: row.available_balance == null ? null : Number(row.available_balance),
  balanceUpdatedAt: row.balance_updated_at,
  includeInCash: row.include_in_cash,
  institutionName: row.bank_connections?.institution_name || 'Connected bank',
  institutionLogo: row.bank_connections?.institution_logo,
})

const mapTransaction = (row, accountNames) => mapStoredBankTransaction(row, accountNames)

const downloadFile = (name, contents, type) => {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function CashFlowChart({ rows }) {
  const [hoveredPeriod, setHoveredPeriod] = useState('')
  if (!rows.length) return <div className="bank-empty-chart"><WalletCards /><span>No cash flow in this range.</span></div>
  const width = Math.max(760, rows.length * 76)
  const height = 300
  const mid = 145
  const pad = 35
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.inflow, row.outflow, Math.abs(row.net)]))
  const scale = 105 / maxValue
  const step = (width - pad * 2) / rows.length
  const netPoints = rows.map((row, index) => `${pad + step * (index + .5)},${mid - row.net * scale}`).join(' ')
  const mobileRows = rows.slice().reverse()
  const hoveredIndex = rows.findIndex((row) => row.period === hoveredPeriod)
  const hovered = hoveredIndex >= 0 ? rows[hoveredIndex] : null
  const hoveredCentre = hovered ? pad + step * (hoveredIndex + .5) : 0
  const tooltipWidth = 184
  const tooltipX = hovered ? Math.max(pad, Math.min(width - pad - tooltipWidth, hoveredCentre - tooltipWidth / 2)) : 0

  return <>
    <div className="bank-chart-desktop bank-chart-scroll">
      <svg className="cashflow-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actual connected account cash flow">
        <line x1={pad} y1={mid} x2={width - pad} y2={mid} className="axis" />
        {rows.map((row, index) => {
          const centre = pad + step * (index + .5)
          const periodLabel = formatCashPeriod(row.period)
          return <g key={row.period}>
            <rect x={centre - 19} y={mid - row.inflow * scale} width="17" height={row.inflow * scale} rx="3" className="inflow-bar" />
            <rect x={centre + 2} y={mid} width="17" height={row.outflow * scale} rx="3" className="outflow-bar" />
            <text x={centre} y={height - 18} textAnchor="middle">{periodLabel}</text>
            <rect className="bank-cashflow-hit-area" x={centre - step / 2} y="12" width={step} height={height - 42} tabIndex="0" aria-label={`${periodLabel}: Money in ${currency(row.inflow)}, Money out ${currency(row.outflow)}, Net business cash ${currency(row.net)}`} onPointerEnter={() => setHoveredPeriod(row.period)} onPointerLeave={() => setHoveredPeriod('')} onFocus={() => setHoveredPeriod(row.period)} onBlur={() => setHoveredPeriod('')} />
          </g>
        })}
        <polyline points={netPoints} className="net-line" />
        {rows.map((row, index) => <circle key={`net-${row.period}`} cx={pad + step * (index + .5)} cy={mid - row.net * scale} r="3.5" className="net-dot" />)}
        {hovered && <g className="bank-cashflow-tooltip" pointerEvents="none"><line x1={hoveredCentre} y1="28" x2={hoveredCentre} y2={height - 38} className="bank-cashflow-hover-guide" /><g transform={`translate(${tooltipX},18)`}><rect width={tooltipWidth} height="78" rx="12" /><text x="12" y="20" className="period">{formatCashPeriod(hovered.period)}</text><text x="12" y="39">Money in <tspan x="172" textAnchor="end">{currency(hovered.inflow)}</tspan></text><text x="12" y="56">Money out <tspan x="172" textAnchor="end">{currency(hovered.outflow)}</tspan></text><text x="12" y="72" className="net">Net <tspan x="172" textAnchor="end">{currency(hovered.net)}</tspan></text></g></g>}
      </svg>
    </div>
    <div className="bank-cashflow-mobile" aria-label="Mobile cash flow periods">
      {mobileRows.map((row) => <article key={row.period}><div className="bank-mobile-period"><b>{formatCashPeriod(row.period)}</b><span className={row.net >= 0 ? 'positive' : 'negative'}>{currency(row.net)} net</span></div><div className="bank-mobile-flow-values"><span><ArrowUpRight size={14} /> In <b>{currency(row.inflow)}</b></span><span><ArrowDownRight size={14} /> Out <b>{currency(row.outflow)}</b></span></div></article>)}
    </div>
  </>
}

export default function BankWorkspace({ user, properties = [], tenants = [], onCashHeldChange }) {
  const [connections, setConnections] = useState([])
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const [period, setPeriod] = useState('month')
  const [range, setRange] = useState('all')
  const [selectedAccountIds, setSelectedAccountIds] = useState([])
  const [showStatementImport, setShowStatementImport] = useState(false)
  const [includeDlaInBalance, setIncludeDlaInBalance] = useState(false)

  const loadData = async () => {
    const [connectionRows, accountRows, transactionRows] = await Promise.all([
      readAllRows('bank_connections', '*'),
      readAllRows('bank_accounts', '*,bank_connections(institution_name,institution_logo,status,last_synced_at,access_expires_at)'),
      readAllRows('bank_transactions', '*', 'booked_at'),
    ])
    const mappedAccounts = accountRows.map(mapAccount)
    const accountNames = new Map(mappedAccounts.map((account) => [account.id, `${account.institutionName} · ${account.displayName}`]))
    const mappedTransactions = detectInternalTransfers(deduplicateTransactions(transactionRows.map((row) => mapTransaction(row, accountNames))))
    setConnections(connectionRows)
    setAccounts(mappedAccounts)
    setTransactions(mappedTransactions)
    setSelectedAccountIds((current) => {
      const valid = current.filter((id) => mappedAccounts.some((account) => account.id === id))
      // Account selection is independent of the cash-held preference: historical
      // accounts must not disappear simply because they are not cash holdings.
      return valid.length ? valid : mappedAccounts.map((account) => account.id)
    })
    const cashHeld = latestCashHeldFromAccounts(mappedAccounts, mappedTransactions)
    if (mappedAccounts.some((account) => account.includeInCash)) onCashHeldChange(cashHeld)
    setStatus('ready')
  }

  useEffect(() => {
    let active = true
    const start = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const callbackConnection = params.get('bank_callback') === '1' ? params.get('connection') : null
        if (callbackConnection) {
          setStatus('syncing')
          await apiRequest('', { action: 'finalize', connectionId: callbackConnection })
          window.history.replaceState({}, '', window.location.pathname)
        }
        if (active) {
          await apiRequest('', { action: 'reconcile-transfers' }).catch(() => null)
          await loadData()
        }
      } catch (requestError) {
        if (active) { setError(requestError.message); setStatus(requestError.code === 'not_configured' ? 'not-configured' : 'error') }
      }
    }
    start()
    return () => { active = false }
  }, [user.id])

  const openConnect = async () => {
    setShowConnect(true)
    setError('')
    if (institutions.length) return
    try {
      const response = await apiRequest('institutions')
      setInstitutions(response.institutions)
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.code === 'not_configured') setStatus('not-configured')
    }
  }

  const connect = async (institutionId) => {
    setStatus('connecting')
    setError('')
    try {
      const response = await apiRequest('', { action: 'connect', institutionId })
      window.location.assign(response.link)
    } catch (requestError) {
      setError(requestError.message)
      setStatus(requestError.code === 'not_configured' ? 'not-configured' : 'ready')
    }
  }

  const syncAll = async () => {
    setStatus('syncing')
    setError('')
    try {
      for (const connection of connections) await apiRequest('', { action: 'sync', connectionId: connection.id })
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  const toggleAccount = async (account) => {
    const includeInCash = !account.includeInCash
    const { error: updateError } = await supabase.from('bank_accounts').update({ include_in_cash: includeInCash }).eq('id', account.id)
    if (updateError) { setError(updateError.message); return }
    const next = accounts.map((candidate) => candidate.id === account.id ? { ...candidate, includeInCash } : candidate)
    setAccounts(next)
    onCashHeldChange(latestCashHeldFromAccounts(next, transactions))
  }

  const updateTransactionMeta = async (transaction, patch) => {
    const mappedPatch = bankTransactionStatePatch(patch)
    setTransactions((current) => current.map((row) => row.id === transaction.id ? { ...row, ...mappedPatch } : row))
    const { error: updateError } = await supabase.from('bank_transactions').update(patch).eq('id', transaction.id)
    if (updateError) {
      setError(updateError.message)
      await loadData().catch(() => {})
      return false
    }
    return true
  }

  const updateTransactionsMeta = async (targets, patch) => {
    const ids = [...new Set((targets || []).map((transaction) => transaction?.id).filter(Boolean))]
    if (!ids.length) return false
    const mappedPatch = bankTransactionStatePatch(patch)
    const idSet = new Set(ids)
    setTransactions((current) => current.map((row) => idSet.has(row.id) ? { ...row, ...mappedPatch } : row))
    const { error: updateError } = await supabase.from('bank_transactions').update(patch).in('id', ids)
    if (updateError) {
      setError(updateError.message)
      await loadData().catch(() => {})
      return false
    }
    return true
  }


  const toggleTransactionExcluded = (transaction) => updateTransactionMeta(transaction, {
    exclude_from_performance: !transaction.excludeFromPerformance,
  })

  const deleteConnection = async (connection) => {
    if (!connection) return
    if (!window.confirm(`Disconnect ${connection.institution_name}? Its imported account history will be removed from this workspace.`)) return
    if (String(connection.requisition_id || '').startsWith('manual:tide:')) {
      const { error: deleteError } = await supabase.from('bank_connections').delete().eq('id', connection.id)
      if (deleteError) { setError(deleteError.message); return }
      await loadData()
      return
    }
    const { data } = await supabase.auth.getSession()
    const response = await fetch(`/api/banking?connection=${encodeURIComponent(connection.id)}`, { method: 'DELETE', headers: { authorization: `Bearer ${data.session?.access_token || ''}` } })
    if (!response.ok) { const payload = await response.json().catch(() => ({})); setError(payload.error || 'The connection could not be removed.'); return }
    await loadData()
  }

  const selected = useMemo(() => accounts.filter((account) => selectedAccountIds.includes(account.id)), [accounts, selectedAccountIds])
  const reportingIds = useMemo(() => reportingAccountIds(accounts, selectedAccountIds, 'GBP'), [accounts, selectedAccountIds])
  const reportingSelected = useMemo(() => accounts.filter((account) => reportingIds.includes(account.id)), [accounts, reportingIds])
  const timeline = useMemo(() => bankingTimelineRange(transactions, {
    accountIds: reportingIds, range,
  }), [transactions, reportingIds, range])
  const fromDate = timeline.from
  const toDate = timeline.to
  const filteredTransactions = useMemo(() => transactions.filter((transaction) => selectedAccountIds.includes(transaction.accountId)
    && (!fromDate || transaction.bookedAt >= fromDate) && (!toDate || transaction.bookedAt <= toDate)), [transactions, selectedAccountIds, fromDate, toDate])
  const balanceSeries = useMemo(() => reconstructBalanceSeries(reportingSelected, transactions, {
    accountIds: reportingIds,
    includeExcluded: false,
    includeOwnerFunding: includeDlaInBalance,
  }), [reportingSelected, transactions, reportingIds, includeDlaInBalance])
  const visibleBalanceSeries = useMemo(() => alignBankingBalanceSeries(balanceSeries, { from: fromDate, to: toDate }), [balanceSeries, fromDate, toDate])
  const trueCashTransactions = useMemo(() => trueCashFlowTransactions(transactions), [transactions])
  const cashFlow = useMemo(() => bankingCashFlowSeries(trueCashTransactions, {
    period, accountIds: reportingIds, from: fromDate, to: toDate,
  }), [trueCashTransactions, period, reportingIds, fromDate, toDate])
  const metrics = useMemo(() => calculateBankMetrics(trueCashTransactions, visibleBalanceSeries, { accountIds: reportingIds, from: fromDate || undefined, to: toDate || undefined, asOf: toDate }), [trueCashTransactions, visibleBalanceSeries, reportingIds, fromDate, toDate])
  const cashSummary = useMemo(() => summarizeCashFlowPipeline(transactions, { accountIds: reportingIds, from: fromDate || undefined, to: toDate || undefined }), [transactions, reportingIds, fromDate, toDate])
  const authoritativeBalanceValues = reportingSelected.map((account) => authoritativeAccountBalance(account, transactions))
  const reportingBalanceAuthoritative = authoritativeBalanceValues.every((value) => value != null)
  const reportingBalanceValues = reportingSelected.map((account) => latestAccountBalance(account, transactions))
  const reportingBalanceAvailable = reportingBalanceValues.every((value) => value != null)
  const reportingBalance = reportingBalanceAvailable
    ? reportingBalanceValues.reduce((total, value) => total + value, 0)
    : null
  const accountDisplayBalances = useMemo(() => new Map(accounts.map((account) => [
    account.id,
    latestAccountBalance(account, transactions),
  ])), [accounts, transactions])

  const exportCsv = () => downloadFile(`bank-transactions-${new Date().toISOString().slice(0, 10)}.csv`, transactionsToCsv(filteredTransactions), 'text/csv;charset=utf-8')
  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const document = new jsPDF({ unit: 'pt', format: 'a4' })
    const lines = [
      `Accounts: ${selected.map((account) => `${account.institutionName} ${account.displayName}`).join(', ')}`,
      `Current connected GBP balance: ${reportingBalance == null ? 'Unavailable from imported statement' : currency(reportingBalance)}`,
      `Property operating cash flow: ${currency(cashSummary.operatingCashFlow)}`,
      `Company free cash flow: ${currency(cashSummary.companyFreeCashFlow)}`,
      `Net owner/DLA funding: ${currency(cashSummary.ownerFundingNet)}`,
      `Cash extraction: ${currency(cashSummary.cashExtractionNet)}`,
      `Analysed net movement (excluded ignored; only balanced internal transfers removed): ${currency(cashSummary.netBankMovement)}`,
      `Raw statement movement (all booked rows included): ${currency(cashSummary.rawBankMovement)}`,
      `12 month average true inflow: ${currency(metrics.averages.twelveMonth.inflow)}`,
      `12 month average true outflow: ${currency(metrics.averages.twelveMonth.outflow)}`,
      `Lowest balance: ${currency(metrics.lowestBalance)}   Highest balance: ${currency(metrics.highestBalance)}`,
    ]
    document.setFont('helvetica', 'bold'); document.setFontSize(18); document.text('Banking and cash flow report', 44, 52)
    document.setFont('helvetica', 'normal'); document.setFontSize(10); document.text(`Generated ${new Date().toLocaleString('en-GB')}`, 44, 70)
    let y = 100
    lines.forEach((line) => { document.text(document.splitTextToSize(line, 500), 44, y); y += 20 })
    y += 10; document.setFont('helvetica', 'bold'); document.text('Recent transactions', 44, y); y += 18; document.setFont('helvetica', 'normal')
    filteredTransactions.slice().reverse().slice(0, 120).forEach((transaction) => {
      const line = `${transaction.bookedAt || ''}  ${transaction.description || ''}  ${money(transaction.amount, transaction.currency)}  ${transaction.category}`
      const wrapped = document.splitTextToSize(line, 500)
      if (y + wrapped.length * 12 > 790) { document.addPage(); y = 50 }
      document.text(wrapped, 44, y); y += wrapped.length * 12 + 4
    })
    document.save(`bank-report-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const finishStatementImport = async () => {
    let reconciliation = { reconciled: 0 }
    try { reconciliation = await apiRequest('', { action: 'reconcile-transfers' }) }
    catch (requestError) { setError(requestError.message) }
    await loadData()
    return reconciliation
  }

  const filteredInstitutions = institutions.filter((institution) => institution.name.toLowerCase().includes(search.toLowerCase()))
  if (status === 'loading' || status === 'syncing') return <div className="app-inline-loading"><RefreshCw /><b>{status === 'syncing' ? 'Securely syncing bank data…' : 'Loading connected accounts…'}</b></div>

  return <div className="bank-workspace">
    <section className="panel bank-command-bar"><header><div className="bank-command-context"><ShieldCheck size={16} /><span>Secure bank connection</span></div><div className="bank-command-actions"><button className="secondary-button small" onClick={syncAll} disabled={!connections.length || status === 'syncing'}><RefreshCw size={15} /> Sync</button><button className="secondary-button small" onClick={() => setShowStatementImport(true)}><FileText size={15} /> Import Tide statement</button><button className="primary-button small" onClick={openConnect}><Link2 size={15} /> Connect account</button></div></header>{error && <p className="bank-error"><AlertTriangle size={16} />{error}</p>}{status === 'not-configured' && <div className="bank-setup-note"><AlertTriangle /><span><b>One-time GoCardless setup required</b><small>The secure server integration is ready. Add Bank Account Data user secrets to Cloudflare to enable live bank selection.</small></span></div>}</section>

    {showStatementImport && <BankStatementImportSheet user={user} connections={connections} accounts={accounts} properties={properties} onClose={() => setShowStatementImport(false)} onImported={finishStatementImport} />}

    {showConnect && <section className="panel bank-picker"><header><div><span className="kicker">AVAILABLE UK INSTITUTIONS</span><h2>Choose a bank</h2><p>Tide, Monzo, Revolut and Chase are prioritised when returned by GoCardless; all other supported UK providers remain searchable.</p></div><label><Search size={16} /><BrainDrainNumericInput aria-label="Search banks" placeholder="Search banks" value={search} onChange={(event) => setSearch(event.target.value)} /></label></header><div className="bank-picker-grid">{filteredInstitutions.map((institution) => <button key={institution.id} onClick={() => connect(institution.id)} disabled={status === 'connecting'}>{institution.logo ? <img src={institution.logo} alt="" /> : <Landmark />}<span><b>{institution.name}</b><small>Up to {Math.min(730, institution.transactionDays)} days history</small></span>{institution.preferred && <em>Priority</em>}<ExternalLink size={14} /></button>)}</div>{!institutions.length && status !== 'not-configured' && <div className="bank-empty-chart"><RefreshCw /><span>Loading live institution availability…</span></div>}</section>}

    {accounts.length > 0 && <>
      <section className="bank-account-grid">{accounts.map((account) => <article className={`panel bank-account ${selectedAccountIds.includes(account.id) ? 'selected' : ''}`} key={account.id}><header><label><BrainDrainNumericInput type="checkbox" checked={selectedAccountIds.includes(account.id)} onChange={() => setSelectedAccountIds((current) => current.includes(account.id) ? current.filter((id) => id !== account.id) : [...current, account.id])} /><i />{account.institutionLogo ? <img src={account.institutionLogo} alt="" /> : <Building2 />}</label><button className="icon-button" aria-label={`Disconnect ${account.institutionName}`} onClick={() => deleteConnection(connections.find((connection) => connection.id === account.connectionId))}><Trash2 size={15} /></button></header><span>{account.institutionName}</span><h3>{account.displayName}</h3><strong>{accountDisplayBalances.get(account.id) == null ? '—' : money(accountDisplayBalances.get(account.id), account.currency)}</strong><small>{account.currency} · {account.ibanLast4 ? `ending ${account.ibanLast4}` : 'account details protected'}</small><footer><label className="switch-label"><BrainDrainNumericInput type="checkbox" checked={account.includeInCash} onChange={() => toggleAccount(account)} /><i /><span>Include in cash held</span></label></footer></article>)}</section>

      <div className="bank-data-controls" aria-label="Banking period and exports"><div><span>Period</span><div className="segmented">{[['3', '3M'], ['6', '6M'], ['12', '12M'], ['all', 'All']].map(([value, label]) => <button className={range === value ? 'active' : ''} key={value} onClick={() => setRange(value)}>{label}</button>)}</div></div><div className="bank-exports"><button className="secondary-button small" onClick={exportCsv}><Download size={14} /> CSV</button><button className="secondary-button small" onClick={exportPdf}><FileText size={14} /> PDF</button></div></div>

      <BankSummary reportingBalance={reportingBalance} reportingAccountCount={reportingIds.length} cashSummary={cashSummary} balanceDerived={reportingBalanceAvailable && !reportingBalanceAuthoritative} />

      <section className="panel bank-chart-panel bank-balance-panel"><header><div><h2>Balance history <span className="bank-analysis-badge">{reportingBalanceAuthoritative ? 'Analysis-adjusted' : 'Relative movement'}</span></h2><p>{reportingBalanceAuthoritative ? 'Opening bank balance is preserved. Excluded transactions and confirmed internal-transfer pairs are ignored; DLA movements follow the toggle.' : 'This Tide statement export contains no balance column, so the opening balance is unknown. The chart starts at £0 and shows cumulative included movements; excluded transactions and confirmed internal-transfer pairs are ignored, and DLA follows the toggle.'}</p></div><div className="bank-balance-head-controls"><label className="bank-dla-toggle" title="Toggle owner funding / DLA movements in this analysis-adjusted balance. Excluded transactions and confirmed internal-transfer pairs always remain hidden."><BrainDrainNumericInput type="checkbox" checked={includeDlaInBalance} onChange={(event) => setIncludeDlaInBalance(event.target.checked)} /><i /><span>Include DLA movements</span></label><span className="panel-stat">{visibleBalanceSeries.length ? `${shortDate(visibleBalanceSeries[0].date)} – ${shortDate(visibleBalanceSeries.at(-1).date)}` : 'No history'}</span></div></header><BalanceChart points={visibleBalanceSeries} /></section>

      <section className="panel bank-chart-panel bank-cashflow-panel"><header><div><h2>Business cash flow</h2><p>Money generated by the business. Owner funding, cash extraction, confirmed internal transfers and anything still awaiting review are excluded. The timeline begins with the first booked transaction, including excluded history; zero-activity periods remain visible.</p></div><div className="segmented"><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Monthly</button><button className={period === 'year' ? 'active' : ''} onClick={() => setPeriod('year')}>Yearly</button></div></header><div className="bank-chart-legend"><span className="inflow">Money in</span><span className="outflow">Money out</span><span className="net">Net business cash</span></div><CashFlowChart rows={cashFlow} /></section>

      <CashFlowReconciliation cashSummary={cashSummary} transactions={filteredTransactions} properties={properties} onToggleExcluded={toggleTransactionExcluded} />

      <BankTransactionReview transactions={filteredTransactions} properties={properties} tenants={tenants} onUpdate={updateTransactionMeta} onUpdateMany={updateTransactionsMeta} />

    </>}

    {!accounts.length && status === 'ready' && !showConnect && <section className="panel bank-empty-state"><WalletCards /><h2>Connect the account that receives your property income</h2><p>Its opted-in GBP balances will update the portfolio’s cash-held figure. You can connect and compare multiple accounts.</p><button className="primary-button" onClick={openConnect}><Link2 size={16} /> Choose a bank</button></section>}
  </div>
}
