import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, Check, Download, ExternalLink,
  FileText, Landmark, Link2, RefreshCw, Search, Trash2, TrendingUp, WalletCards,
} from 'lucide-react'
import { supabase } from './supabase.js'
import {
  aggregateCashFlow, BANK_CATEGORIES, calculateBankMetrics, cashHeldFromAccounts,
  detectInternalTransfers, reconstructBalanceSeries, reportingAccountIds, transactionsToCsv,
} from './banking.js'
import { currency, shortDate } from './calculations.js'

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
  currentBalance: Number(row.current_balance || 0),
  availableBalance: row.available_balance == null ? null : Number(row.available_balance),
  balanceUpdatedAt: row.balance_updated_at,
  includeInCash: row.include_in_cash,
  institutionName: row.bank_connections?.institution_name || 'Connected bank',
  institutionLogo: row.bank_connections?.institution_logo,
})

const mapTransaction = (row, accountNames) => ({
  id: row.id,
  accountId: row.account_id,
  accountName: accountNames.get(row.account_id) || 'Bank account',
  transactionKey: row.transaction_key,
  bookedAt: row.booked_at,
  valueAt: row.value_at,
  amount: Number(row.amount || 0),
  currency: row.currency,
  description: row.description,
  counterparty: row.counterparty,
  bankCode: row.bank_code,
  status: row.status,
  balanceAfter: row.balance_after == null ? null : Number(row.balance_after),
  category: row.category,
  isTransfer: row.is_transfer,
  categoryOverridden: row.category_overridden,
})

const downloadFile = (name, contents, type) => {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function BalanceChart({ points }) {
  if (points.length < 2) return <div className="bank-empty-chart"><TrendingUp /><span>Balance history will build after transactions are synced.</span></div>
  const width = 900
  const height = 270
  const pad = 34
  const balances = points.map((point) => point.balance)
  const minimum = Math.min(...balances)
  const maximum = Math.max(...balances)
  const spread = Math.max(1, maximum - minimum)
  const coordinates = points.map((point, index) => ({
    ...point,
    x: pad + index / Math.max(1, points.length - 1) * (width - pad * 2),
    y: pad + (maximum - point.balance) / spread * (height - pad * 2),
  }))
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = `${line} L${coordinates.at(-1).x},${height - pad} L${coordinates[0].x},${height - pad} Z`
  return <div className="bank-chart-scroll"><svg className="balance-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Connected bank balance over time"><defs><linearGradient id="balance-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f9b76" stopOpacity=".28" /><stop offset="1" stopColor="#3f9b76" stopOpacity=".02" /></linearGradient></defs><line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="axis" /><path d={area} fill="url(#balance-area)" /><path d={line} className="balance-line" /><text x={pad} y={22}>{currency(maximum)}</text><text x={pad} y={height - 10}>{shortDate(points[0].date)}</text><text x={width - pad} y={height - 10} textAnchor="end">{shortDate(points.at(-1).date)}</text><text x={width - pad} y={22} textAnchor="end">Latest {currency(points.at(-1).balance)}</text></svg></div>
}

function CashFlowChart({ rows }) {
  if (!rows.length) return <div className="bank-empty-chart"><WalletCards /><span>No cash flow in this range.</span></div>
  const width = Math.max(760, rows.length * 76)
  const height = 300
  const mid = 145
  const pad = 35
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.inflow, row.outflow, Math.abs(row.net)]))
  const scale = 105 / maxValue
  const step = (width - pad * 2) / rows.length
  const netPoints = rows.map((row, index) => `${pad + step * (index + .5)},${mid - row.net * scale}`).join(' ')
  return <div className="bank-chart-scroll"><svg className="cashflow-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actual connected account cash flow"><line x1={pad} y1={mid} x2={width - pad} y2={mid} className="axis" />{rows.map((row, index) => { const centre = pad + step * (index + .5); return <g key={row.period}><rect x={centre - 19} y={mid - row.inflow * scale} width="17" height={row.inflow * scale} rx="3" className="inflow-bar"><title>{row.period} inflow {currency(row.inflow)}</title></rect><rect x={centre + 2} y={mid} width="17" height={row.outflow * scale} rx="3" className="outflow-bar"><title>{row.period} outflow {currency(row.outflow)}</title></rect><text x={centre} y={height - 18} textAnchor="middle">{row.period}</text></g>})}<polyline points={netPoints} className="net-line" />{rows.map((row, index) => <circle key={`net-${row.period}`} cx={pad + step * (index + .5)} cy={mid - row.net * scale} r="3.5" className="net-dot"><title>{row.period} net {currency(row.net)}</title></circle>)}</svg></div>
}

function BankMetric({ label, value, note, tone }) {
  return <article className={`bank-metric ${tone || ''}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>
}

export default function BankWorkspace({ user, onCashHeldChange }) {
  const [connections, setConnections] = useState([])
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [institutions, setInstitutions] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const [includeTransfers, setIncludeTransfers] = useState(false)
  const [period, setPeriod] = useState('month')
  const [range, setRange] = useState('12')
  const [selectedAccountIds, setSelectedAccountIds] = useState([])

  const loadData = async () => {
    const [connectionRows, accountRows, transactionRows] = await Promise.all([
      readAllRows('bank_connections', '*'),
      readAllRows('bank_accounts', '*,bank_connections(institution_name,institution_logo,status,last_synced_at,access_expires_at)'),
      readAllRows('bank_transactions', '*', 'booked_at'),
    ])
    const mappedAccounts = accountRows.map(mapAccount)
    const accountNames = new Map(mappedAccounts.map((account) => [account.id, `${account.institutionName} · ${account.displayName}`]))
    const mappedTransactions = detectInternalTransfers(transactionRows.map((row) => mapTransaction(row, accountNames)))
    setConnections(connectionRows)
    setAccounts(mappedAccounts)
    setTransactions(mappedTransactions)
    setSelectedAccountIds((current) => current.length ? current.filter((id) => mappedAccounts.some((account) => account.id === id)) : mappedAccounts.map((account) => account.id))
    const cashHeld = cashHeldFromAccounts(mappedAccounts)
    if (mappedAccounts.length) onCashHeldChange(cashHeld)
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
        if (active) await loadData()
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
    onCashHeldChange(cashHeldFromAccounts(next))
  }

  const updateCategory = async (transaction, category) => {
    const { error: updateError } = await supabase.from('bank_transactions').update({ category, is_transfer: category === 'transfer', category_overridden: true }).eq('id', transaction.id)
    if (updateError) { setError(updateError.message); return }
    setTransactions((current) => current.map((row) => row.id === transaction.id ? { ...row, category, isTransfer: category === 'transfer', categoryOverridden: true } : row))
  }

  const deleteConnection = async (connection) => {
    if (!window.confirm(`Disconnect ${connection.institution_name}? Its imported account history will be removed from this workspace.`)) return
    const { data } = await supabase.auth.getSession()
    const response = await fetch(`/api/banking?connection=${encodeURIComponent(connection.id)}`, { method: 'DELETE', headers: { authorization: `Bearer ${data.session?.access_token || ''}` } })
    if (!response.ok) { const payload = await response.json().catch(() => ({})); setError(payload.error || 'The connection could not be removed.'); return }
    await loadData()
  }

  const selected = useMemo(() => accounts.filter((account) => selectedAccountIds.includes(account.id)), [accounts, selectedAccountIds])
  const reportingIds = useMemo(() => reportingAccountIds(accounts, selectedAccountIds, 'GBP'), [accounts, selectedAccountIds])
  const reportingSelected = useMemo(() => accounts.filter((account) => reportingIds.includes(account.id)), [accounts, reportingIds])
  const fromDate = useMemo(() => {
    if (range === 'all') return ''
    const date = new Date()
    date.setMonth(date.getMonth() - Number(range))
    return date.toISOString().slice(0, 10)
  }, [range])
  const filteredTransactions = useMemo(() => transactions.filter((transaction) => selectedAccountIds.includes(transaction.accountId) && (!fromDate || transaction.bookedAt >= fromDate)), [transactions, selectedAccountIds, fromDate])
  const balanceSeries = useMemo(() => reconstructBalanceSeries(reportingSelected, transactions, { accountIds: reportingIds }), [reportingSelected, transactions, reportingIds])
  const visibleBalanceSeries = useMemo(() => fromDate ? balanceSeries.filter((point) => point.date >= fromDate) : balanceSeries, [balanceSeries, fromDate])
  const cashFlow = useMemo(() => aggregateCashFlow(transactions, { period, accountIds: reportingIds, includeTransfers, from: fromDate || undefined }), [transactions, period, reportingIds, includeTransfers, fromDate])
  const metrics = useMemo(() => calculateBankMetrics(transactions, visibleBalanceSeries, { accountIds: reportingIds, includeTransfers, from: fromDate || undefined }), [transactions, visibleBalanceSeries, reportingIds, includeTransfers, fromDate])
  const reportingBalance = reportingSelected.reduce((total, account) => total + account.currentBalance, 0)

  const exportCsv = () => downloadFile(`bank-transactions-${new Date().toISOString().slice(0, 10)}.csv`, transactionsToCsv(filteredTransactions), 'text/csv;charset=utf-8')
  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const document = new jsPDF({ unit: 'pt', format: 'a4' })
    const lines = [
      `Accounts: ${selected.map((account) => `${account.institutionName} ${account.displayName}`).join(', ')}`,
      `Current connected GBP balance: ${currency(reportingBalance)}`,
      `Net cash flow: ${currency(metrics.netCashFlow)}`,
      `12 month average inflow: ${currency(metrics.averages.twelveMonth.inflow)}`,
      `12 month average outflow: ${currency(metrics.averages.twelveMonth.outflow)}`,
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

  const filteredInstitutions = institutions.filter((institution) => institution.name.toLowerCase().includes(search.toLowerCase()))
  if (status === 'loading' || status === 'syncing') return <div className="app-inline-loading"><RefreshCw /><b>{status === 'syncing' ? 'Securely syncing bank data…' : 'Loading connected accounts…'}</b></div>

  return <div className="bank-workspace">
    <section className="panel bank-hero"><header><div><span className="kicker">OPEN BANKING · GOCARDLESS</span><h2>Bank balances & actual cash flow</h2><p>Connect accounts with bank-hosted consent. Your bank credentials never pass through this app.</p></div><div><button className="secondary-button small" onClick={syncAll} disabled={!connections.length || status === 'syncing'}><RefreshCw size={15} /> Sync</button><button className="primary-button small" onClick={openConnect}><Link2 size={15} /> Connect account</button></div></header>{error && <p className="bank-error"><AlertTriangle size={16} />{error}</p>}{status === 'not-configured' && <div className="bank-setup-note"><AlertTriangle /><span><b>One-time GoCardless setup required</b><small>The secure server integration is ready. Add Bank Account Data user secrets to Cloudflare to enable live bank selection.</small></span></div>}</section>

    {showConnect && <section className="panel bank-picker"><header><div><span className="kicker">AVAILABLE UK INSTITUTIONS</span><h2>Choose a bank</h2><p>Tide, Monzo, Revolut and Chase are prioritised when returned by GoCardless; all other supported UK providers remain searchable.</p></div><label><Search size={16} /><input aria-label="Search banks" placeholder="Search banks" value={search} onChange={(event) => setSearch(event.target.value)} /></label></header><div className="bank-picker-grid">{filteredInstitutions.map((institution) => <button key={institution.id} onClick={() => connect(institution.id)} disabled={status === 'connecting'}>{institution.logo ? <img src={institution.logo} alt="" /> : <Landmark />}<span><b>{institution.name}</b><small>Up to {Math.min(730, institution.transactionDays)} days history</small></span>{institution.preferred && <em>Priority</em>}<ExternalLink size={14} /></button>)}</div>{!institutions.length && status !== 'not-configured' && <div className="bank-empty-chart"><RefreshCw /><span>Loading live institution availability…</span></div>}</section>}

    {accounts.length > 0 && <>
      <section className="bank-account-grid">{accounts.map((account) => <article className={`panel bank-account ${selectedAccountIds.includes(account.id) ? 'selected' : ''}`} key={account.id}><header><label><input type="checkbox" checked={selectedAccountIds.includes(account.id)} onChange={() => setSelectedAccountIds((current) => current.includes(account.id) ? current.filter((id) => id !== account.id) : [...current, account.id])} /><i />{account.institutionLogo ? <img src={account.institutionLogo} alt="" /> : <Building2 />}</label><button className="icon-button" aria-label={`Disconnect ${account.institutionName}`} onClick={() => deleteConnection(connections.find((connection) => connection.id === account.connectionId))}><Trash2 size={15} /></button></header><span>{account.institutionName}</span><h3>{account.displayName}</h3><strong>{money(account.currentBalance, account.currency)}</strong><small>{account.currency} · {account.ibanLast4 ? `ending ${account.ibanLast4}` : 'account details protected'}</small><footer><label className="switch-label"><input type="checkbox" checked={account.includeInCash} onChange={() => toggleAccount(account)} /><i /><span>Include in cash held</span></label></footer></article>)}</section>

      <section className="bank-metrics-grid"><BankMetric label="Connected GBP balance" value={currency(reportingBalance)} note={`${reportingIds.length} selected GBP account${reportingIds.length === 1 ? '' : 's'} · non-GBP excluded from aggregates`} tone="dark" /><BankMetric label="Net cash flow" value={currency(metrics.netCashFlow)} note="Selected range" tone={metrics.netCashFlow >= 0 ? 'positive' : 'negative'} /><BankMetric label="Average monthly inflow" value={currency(metrics.averageMonthlyInflow)} note={`Trailing up to 12 months · ${metrics.historyMonths || 0} month${metrics.historyMonths === 1 ? '' : 's'} available`} /><BankMetric label="Average monthly outflow" value={currency(metrics.averageMonthlyOutflow)} note={`Trailing up to 12 months · ${metrics.historyMonths || 0} month${metrics.historyMonths === 1 ? '' : 's'} available`} /><BankMetric label="Lowest balance" value={currency(metrics.lowestBalance)} note="Selected range" /><BankMetric label="Highest balance" value={currency(metrics.highestBalance)} note="Selected range" /></section>

      <section className="panel bank-toolbar"><div className="segmented">{[['3', '3M'], ['6', '6M'], ['12', '12M'], ['all', 'All']].map(([value, label]) => <button className={range === value ? 'active' : ''} key={value} onClick={() => setRange(value)}>{label}</button>)}</div><label className="switch-label"><input type="checkbox" checked={includeTransfers} onChange={(event) => setIncludeTransfers(event.target.checked)} /><i /><span>Include transfers</span></label><div className="bank-exports"><button className="secondary-button small" onClick={exportCsv}><Download size={14} /> CSV</button><button className="secondary-button small" onClick={exportPdf}><FileText size={14} /> PDF</button></div></section>

      <section className="panel bank-chart-panel"><header><div><span className="kicker">BALANCE HISTORY</span><h2>Cash balance over time</h2></div><span className="panel-stat">{visibleBalanceSeries.length ? `${shortDate(visibleBalanceSeries[0].date)} – ${shortDate(visibleBalanceSeries.at(-1).date)}` : 'No history'}</span></header><BalanceChart points={visibleBalanceSeries} /></section>

      <section className="panel bank-chart-panel"><header><div><span className="kicker">ACTUAL CASH FLOW</span><h2>Inflow, outflow & net movement</h2></div><div className="segmented"><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Monthly</button><button className={period === 'year' ? 'active' : ''} onClick={() => setPeriod('year')}>Yearly</button></div></header><div className="bank-chart-legend"><span className="inflow">Inflow</span><span className="outflow">Outflow</span><span className="net">Net cash flow</span></div><CashFlowChart rows={cashFlow} /></section>

      <section className="bank-average-grid">{[['3 month', metrics.averages.threeMonth], ['6 month', metrics.averages.sixMonth], ['12 month', metrics.averages.twelveMonth]].map(([label, average]) => <article className="panel" key={label}><span>{label} average</span><div><p><ArrowUpRight /> Inflow <b>{currency(average.inflow)}</b></p><p><ArrowDownRight /> Outflow <b>{currency(average.outflow)}</b></p><p className={average.net >= 0 ? 'positive' : 'negative'}><TrendingUp /> Net <b>{currency(average.net)}</b></p></div></article>)}</section>

      <section className="panel bank-transactions"><header><div><span className="kicker">AUTOMATIC CLASSIFICATION</span><h2>Transactions</h2><p>Rules classify rent, mortgages, tax, salary, factors, director loans and common property costs. You can correct any result.</p></div></header><div className="bank-transaction-table"><table><thead><tr><th>Date</th><th>Account</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>{filteredTransactions.slice().reverse().slice(0, 150).map((transaction) => <tr key={transaction.id}><td>{shortDate(transaction.bookedAt)}</td><td>{transaction.accountName}</td><td><b>{transaction.description}</b><small>{transaction.counterparty}</small></td><td><select aria-label={`Category for ${transaction.description}`} value={transaction.category} onChange={(event) => updateCategory(transaction, event.target.value)}>{BANK_CATEGORIES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>{transaction.categoryOverridden && <Check size={12} />}</td><td className={transaction.amount >= 0 ? 'positive' : 'negative'}>{money(transaction.amount, transaction.currency)}</td></tr>)}</tbody></table></div></section>
    </>}

    {!accounts.length && status === 'ready' && !showConnect && <section className="panel bank-empty-state"><WalletCards /><h2>Connect the account that receives your property income</h2><p>Its opted-in GBP balances will update the portfolio’s cash-held figure. You can connect and compare multiple accounts.</p><button className="primary-button" onClick={openConnect}><Link2 size={16} /> Choose a bank</button></section>}
  </div>
}
