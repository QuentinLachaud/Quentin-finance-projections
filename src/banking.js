const DAY_MS = 86_400_000

export const BANK_CATEGORIES = [
  ['rent', 'Rent'],
  ['mortgage', 'Mortgage'],
  ['tax', 'Tax'],
  ['salary', 'Salary'],
  ['factors', 'Factors & management'],
  ['director_loan', 'Director loan'],
  ['repairs', 'Repairs & maintenance'],
  ['utilities', 'Utilities'],
  ['insurance', 'Insurance'],
  ['fees', 'Bank fees'],
  ['transfer', 'Transfer'],
  ['other', 'Other'],
]

const CATEGORY_RULES = [
  ['rent', /\b(rent|tenan(?:t|cy)|letting|airbnb|booking\.com)\b/i],
  ['mortgage', /\b(mortgage|the mortgage works|tmw|paragon|precise mortgages?|landbay)\b/i],
  ['tax', /\b(hmrc|revenue\s*(?:and|&)\s*customs|corporation tax|income tax|council tax|self assessment|vat)\b/i],
  ['salary', /\b(salary|payroll|wages?|payroll payment)\b/i],
  ['factors', /\b(factor(?:ing|s)?|property management|residential management|service charge)\b/i],
  ['director_loan', /\b(directors?'? loan|shareholder loan|loan (?:from|to) director|director advance)\b/i],
  ['repairs', /\b(repair|maintenance|plumb(?:er|ing)|electrician|joiner|roofer|screwfix|toolstation|b&q)\b/i],
  ['utilities', /\b(electric(?:ity)?|energy|gas|water|broadband|internet|utility|scottish power|octopus|edf|virgin media)\b/i],
  ['insurance', /\b(insurance|insurer|policy premium|aviva|direct line|landlord insurance)\b/i],
  ['fees', /\b(bank fee|account fee|service fee|overdraft fee|interest charge)\b/i],
  ['transfer', /\b(internal transfer|own account|between accounts|savings transfer|cash transfer|monzo pot|revolut vault)\b/i],
]

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const isoDate = (value) => value ? String(value).slice(0, 10) : ''
const monthKey = (value) => isoDate(value).slice(0, 7)
const yearKey = (value) => isoDate(value).slice(0, 4)
const textValue = (...values) => values.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

const stableHash = (value) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const classifyTransaction = (transaction) => {
  const haystack = textValue(
    transaction.description,
    transaction.counterparty,
    transaction.bankCode,
    transaction.remittanceInformationUnstructured,
    transaction.additionalInformation,
  )
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(haystack))?.[0] || 'other'
}

export const normalizeGoCardlessTransaction = (raw, accountId, status = 'booked') => {
  const amount = number(raw.transactionAmount?.amount)
  const description = textValue(
    raw.remittanceInformationUnstructured,
    raw.remittanceInformationUnstructuredArray?.join(' '),
    raw.additionalInformation,
    raw.additionalInformationStructured,
  ) || 'Bank transaction'
  const counterparty = amount >= 0
    ? textValue(raw.debtorName, raw.debtorAccount?.name)
    : textValue(raw.creditorName, raw.creditorAccount?.name)
  const bookedAt = isoDate(raw.bookingDate || raw.valueDate || raw.bookingDateTime || raw.valueDateTime)
  const identity = raw.transactionId || raw.internalTransactionId || raw.entryReference || raw.endToEndId
    || stableHash([accountId, bookedAt, amount, description, counterparty].join('|'))
  const transaction = {
    accountId,
    transactionKey: String(identity),
    bookedAt,
    valueAt: isoDate(raw.valueDate || raw.bookingDate),
    amount,
    currency: raw.transactionAmount?.currency || 'GBP',
    description,
    counterparty,
    bankCode: raw.bankTransactionCode || raw.proprietaryBankTransactionCode || '',
    status,
    balanceAfter: raw.balanceAfterTransaction?.balanceAmount
      ? number(raw.balanceAfterTransaction.balanceAmount.amount)
      : null,
  }
  transaction.category = classifyTransaction(transaction)
  transaction.isTransfer = transaction.category === 'transfer'
  return transaction
}

export const detectInternalTransfers = (transactions) => {
  const result = transactions.map((transaction) => ({ ...transaction }))
  const matched = new Set()
  for (let left = 0; left < result.length; left += 1) {
    if (matched.has(left) || result[left].status === 'pending') continue
    for (let right = left + 1; right < result.length; right += 1) {
      if (matched.has(right) || result[right].status === 'pending') continue
      const a = result[left]
      const b = result[right]
      const dayGap = Math.abs(new Date(a.bookedAt).getTime() - new Date(b.bookedAt).getTime()) / DAY_MS
      if (a.accountId !== b.accountId && a.currency === b.currency && dayGap <= 2 && Math.abs(a.amount + b.amount) < 0.005) {
        a.isTransfer = true
        b.isTransfer = true
        a.category = 'transfer'
        b.category = 'transfer'
        matched.add(left)
        matched.add(right)
        break
      }
    }
  }
  return result
}

const selectedTransactions = (transactions, options = {}) => {
  const accountIds = options.accountIds ? new Set(options.accountIds) : null
  return transactions.filter((transaction) => (
    (!accountIds || accountIds.has(transaction.accountId))
    && (options.includePending || transaction.status !== 'pending')
    && (options.includeTransfers || !transaction.isTransfer)
    && (!options.from || transaction.bookedAt >= options.from)
    && (!options.to || transaction.bookedAt <= options.to)
  ))
}

export const aggregateCashFlow = (transactions, options = {}) => {
  const period = options.period === 'year' ? 'year' : 'month'
  const groups = new Map()
  selectedTransactions(transactions, options).forEach((transaction) => {
    const key = period === 'year' ? yearKey(transaction.bookedAt) : monthKey(transaction.bookedAt)
    if (!key) return
    const group = groups.get(key) || { period: key, inflow: 0, outflow: 0, net: 0, count: 0 }
    if (transaction.amount >= 0) group.inflow += transaction.amount
    else group.outflow += Math.abs(transaction.amount)
    group.net += transaction.amount
    group.count += 1
    groups.set(key, group)
  })
  return [...groups.values()].sort((a, b) => a.period.localeCompare(b.period)).map((group) => ({
    ...group,
    inflow: Number(group.inflow.toFixed(2)),
    outflow: Number(group.outflow.toFixed(2)),
    net: Number(group.net.toFixed(2)),
  }))
}

const trailingMonthKeys = (asOf, count) => {
  const date = new Date(`${isoDate(asOf)}T12:00:00Z`)
  return Array.from({ length: count }, (_, offset) => {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - (count - 1 - offset), 1))
    return month.toISOString().slice(0, 7)
  })
}

export const calculateBankMetrics = (transactions, balanceSeries = [], options = {}) => {
  const filtered = selectedTransactions(transactions, options)
  const latestTransactionDate = filtered.map((transaction) => transaction.bookedAt).sort().at(-1)
  const asOf = isoDate(options.asOf || latestTransactionDate || new Date().toISOString())
  const monthly = aggregateCashFlow(filtered, { period: 'month', includeTransfers: true, includePending: true })
  const byMonth = new Map(monthly.map((row) => [row.period, row]))
  const average = (months, field) => Number((trailingMonthKeys(asOf, months)
    .reduce((total, key) => total + (byMonth.get(key)?.[field] || 0), 0) / months).toFixed(2))
  const balances = balanceSeries.map((point) => number(point.balance)).filter(Number.isFinite)
  const inflow = filtered.reduce((total, transaction) => total + Math.max(0, transaction.amount), 0)
  const outflow = filtered.reduce((total, transaction) => total + Math.max(0, -transaction.amount), 0)
  return {
    inflow: Number(inflow.toFixed(2)),
    outflow: Number(outflow.toFixed(2)),
    netCashFlow: Number((inflow - outflow).toFixed(2)),
    averageMonthlyInflow: average(12, 'inflow'),
    averageMonthlyOutflow: average(12, 'outflow'),
    averages: {
      threeMonth: { inflow: average(3, 'inflow'), outflow: average(3, 'outflow'), net: average(3, 'net') },
      sixMonth: { inflow: average(6, 'inflow'), outflow: average(6, 'outflow'), net: average(6, 'net') },
      twelveMonth: { inflow: average(12, 'inflow'), outflow: average(12, 'outflow'), net: average(12, 'net') },
    },
    lowestBalance: balances.length ? Math.min(...balances) : 0,
    highestBalance: balances.length ? Math.max(...balances) : 0,
  }
}

export const reconstructBalanceSeries = (accounts, transactions, options = {}) => {
  const accountIds = new Set(options.accountIds || accounts.filter((account) => account.includeInCash !== false).map((account) => account.id))
  const selectedAccounts = accounts.filter((account) => accountIds.has(account.id))
  const dates = new Set()
  const histories = selectedAccounts.map((account) => {
    const rows = transactions
      .filter((transaction) => transaction.accountId === account.id && transaction.status !== 'pending' && transaction.bookedAt)
      .sort((a, b) => a.bookedAt.localeCompare(b.bookedAt))
    rows.forEach((transaction) => dates.add(transaction.bookedAt))
    const currentDate = isoDate(account.balanceUpdatedAt || options.asOf || new Date().toISOString())
    if (currentDate) dates.add(currentDate)
    return {
      baseline: number(account.currentBalance) - rows.reduce((sum, transaction) => sum + transaction.amount, 0),
      rows,
    }
  })
  return [...dates].sort().map((date) => ({
    date,
    balance: Number(histories.reduce((total, history) => total + history.baseline + history.rows
      .filter((transaction) => transaction.bookedAt <= date)
      .reduce((sum, transaction) => sum + transaction.amount, 0), 0).toFixed(2)),
  }))
}

export const cashHeldFromAccounts = (accounts) => Number(accounts
  .filter((account) => account.includeInCash !== false && account.currency === 'GBP')
  .reduce((total, account) => total + number(account.currentBalance), 0)
  .toFixed(2))

export const transactionsToCsv = (transactions) => {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const header = ['Date', 'Account', 'Description', 'Counterparty', 'Category', 'Status', 'Currency', 'Amount', 'Transfer']
  const rows = transactions.map((transaction) => [
    transaction.bookedAt, transaction.accountName || transaction.accountId, transaction.description,
    transaction.counterparty, transaction.category, transaction.status, transaction.currency,
    number(transaction.amount).toFixed(2), transaction.isTransfer ? 'Yes' : 'No',
  ])
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n')
}
