const DAY_MS = 86_400_000

export const BANK_CATEGORIES = [
  ['rent', 'Rent'],
  ['mortgage', 'Mortgage'],
  ['tax', 'Tax'],
  ['salary', 'Salary'],
  ['factors', 'Factors & management'],
  ['dla_injected', 'DLA injected'],
  ['dla_repaid', 'DLA repaid'],
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
  ['repairs', /\b(repair|maintenance|plumb(?:er|ing)|electrician|joiner|roofer|screwfix|toolstation|b&q)\b/i],
  ['utilities', /\b(electric(?:ity)?|energy|gas|water|broadband|internet|utility|scottish power|octopus|edf|virgin media)\b/i],
  ['insurance', /\b(insurance|insurer|policy premium|aviva|direct line|landlord insurance)\b/i],
  ['fees', /\b(bank fee|account fee|service fee|overdraft fee|interest charge)\b/i],
  ['transfer', /\b(internal transfer|own account|between accounts|savings transfer|cash transfer|monzo pot|revolut vault)\b/i],
]

const DLA_PATTERN = /\b(directors?'? loan|shareholder loan|loan (?:from|to) director|director advance)\b/i
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
  if (DLA_PATTERN.test(haystack)) return number(transaction.amount) >= 0 ? 'dla_injected' : 'dla_repaid'
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(haystack))?.[0] || 'other'
}

const canonicalText = (value) => cleanCanonical(value).replace(/\b(?:ref|reference|transaction|payment)\b/g, ' ').replace(/\s+/g, ' ').trim()
const cleanCanonical = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export const canonicalTransactionKey = (transaction) => stableHash([
  isoDate(transaction.bookedAt || transaction.booked_at),
  number(transaction.amount).toFixed(2),
  String(transaction.currency || 'GBP').toUpperCase(),
  canonicalText(transaction.description || transaction.counterparty),
].join('|'))

export const mapStoredBankTransaction = (row, accountNames = new Map()) => {
  const transaction = {
    id: row.id,
    accountId: row.account_id,
    accountName: accountNames.get(row.account_id) || 'Bank account',
    transactionKey: row.transaction_key,
    bookedAt: row.booked_at,
    valueAt: row.value_at,
    amount: Number(row.amount || 0),
    currency: row.currency || 'GBP',
    description: row.description || 'Bank transaction',
    counterparty: row.counterparty || '',
    bankCode: row.bank_code || '',
    status: row.status || 'booked',
    balanceAfter: row.balance_after == null ? null : Number(row.balance_after),
    category: row.category || 'other',
    isTransfer: row.is_transfer === true,
    categoryOverridden: row.category_overridden === true,
    sourceType: row.source_type || 'gocardless',
    propertyId: row.property_id || '',
    performanceTreatment: row.performance_treatment || 'auto',
    excludeFromPerformance: row.exclude_from_performance === true,
    sourceMetadata: row.source_metadata || {},
  }
  return { ...transaction, canonicalKey: canonicalTransactionKey(transaction) }
}

export const deduplicateTransactions = (transactions) => {
  const rows = (Array.isArray(transactions) ? transactions : []).map((transaction) => ({
    ...transaction,
    canonicalKey: transaction.canonicalKey || canonicalTransactionKey(transaction),
  }))
  const liveKeys = new Set(rows.filter((row) => row.sourceType === 'gocardless').map((row) => row.canonicalKey))
  return rows.filter((row) => !(row.sourceType === 'tide_statement' && liveKeys.has(row.canonicalKey)))
}

export const performanceTreatmentForTransaction = (transaction) => {
  if (transaction?.excludeFromPerformance || transaction?.exclude_from_performance) return 'exclude'
  const override = transaction?.performanceTreatment || transaction?.performance_treatment || 'auto'
  if (override !== 'auto') return override
  if (transaction?.isTransfer || transaction?.is_transfer || transaction?.category === 'transfer') return 'exclude'
  if (['dla_injected', 'dla_repaid'].includes(transaction?.category)) return 'investor'
  if (['tax', 'salary'].includes(transaction?.category)) return 'company'
  if (transaction?.category === 'mortgage') return 'financing'
  if (['rent', 'repairs', 'factors', 'utilities', 'insurance', 'fees'].includes(transaction?.category)) return 'operating'
  return 'review'
}

const propertyTokens = (property) => [property?.name, property?.postcode, property?.address, property?.lender]
  .map((value) => cleanCanonical(value)).filter((value) => value.length >= 3)

export const suggestPropertyId = (transaction, properties = []) => {
  const metadata = transaction?.sourceMetadata || transaction?.source_metadata || {}
  const haystack = cleanCanonical([transaction?.description, transaction?.counterparty, metadata.reference, metadata.from, metadata.to].filter(Boolean).join(' '))
  const matches = (properties || []).map((property) => ({
    property,
    score: propertyTokens(property).reduce((score, token) => score + (haystack.includes(token) ? Math.max(1, Math.min(4, token.split(' ').length)) : 0), 0),
  })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score)
  return matches.length && (matches.length === 1 || matches[0].score > matches[1].score) ? String(matches[0].property.id || '') : ''
}

export const transactionNeedsReview = (transaction, properties = []) => {
  const treatment = performanceTreatmentForTransaction(transaction)
  if (treatment === 'review') return true
  if (['operating', 'financing'].includes(treatment) && !transaction?.propertyId && !transaction?.property_id) return true
  return false
}


export const trueCashFlowTransactions = (transactions = []) => (transactions || []).filter((transaction) => {
  const treatment = performanceTreatmentForTransaction(transaction)
  return ['operating', 'company', 'financing'].includes(treatment)
})

export const summarizeCashFlowPipeline = (transactions = [], options = {}) => {
  const accountIds = options.accountIds ? new Set(options.accountIds) : null
  const rows = (transactions || []).filter((transaction) => (
    (!accountIds || accountIds.has(transaction.accountId))
    && (options.includePending || transaction.status !== 'pending')
    && (!options.from || transaction.bookedAt >= options.from)
    && (!options.to || transaction.bookedAt <= options.to)
  ))
  const totals = {
    operatingCashFlow: 0,
    companyOnlyCashFlow: 0,
    financingCashFlow: 0,
    ownerFundingNet: 0,
    dlaInjected: 0,
    dlaRepaid: 0,
    reviewNet: 0,
    reviewAbsolute: 0,
    reviewCount: 0,
    internalTransferCount: 0,
    internalTransferAbsolute: 0,
    excludedCount: 0,
    excludedNet: 0,
    excludedAbsolute: 0,
  }
  rows.forEach((transaction) => {
    const amount = number(transaction.amount)
    const treatment = performanceTreatmentForTransaction(transaction)
    if (transaction.isTransfer || transaction.is_transfer || transaction.category === 'transfer') {
      totals.internalTransferCount += 1
      totals.internalTransferAbsolute += Math.abs(amount)
      return
    }
    if (treatment === 'operating') totals.operatingCashFlow += amount
    else if (treatment === 'company') totals.companyOnlyCashFlow += amount
    else if (treatment === 'financing') totals.financingCashFlow += amount
    else if (treatment === 'investor') {
      totals.ownerFundingNet += amount
      if (transaction.category === 'dla_injected') totals.dlaInjected += Math.max(0, amount)
      if (transaction.category === 'dla_repaid') totals.dlaRepaid += Math.max(0, -amount)
    } else if (treatment === 'review') {
      totals.reviewNet += amount
      totals.reviewAbsolute += Math.abs(amount)
      totals.reviewCount += 1
    } else {
      totals.excludedCount += 1
      totals.excludedNet += amount
      totals.excludedAbsolute += Math.abs(amount)
    }
  })
  const companyFreeCashFlow = totals.operatingCashFlow + totals.companyOnlyCashFlow + totals.financingCashFlow
  const netDlaFunding = totals.dlaInjected - totals.dlaRepaid
  const netBankMovement = companyFreeCashFlow + totals.ownerFundingNet + totals.reviewNet + totals.excludedNet
  return Object.fromEntries(Object.entries({
    ...totals,
    companyFreeCashFlow,
    netDlaFunding,
    netBankMovement,
  }).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(2)) : value]))
}

export const sortTransactionsForReview = (transactions = [], mode = 'amount') => [...(transactions || [])].sort((left, right) => {
  if (mode === 'newest') return String(right.bookedAt || '').localeCompare(String(left.bookedAt || '')) || Math.abs(number(right.amount)) - Math.abs(number(left.amount))
  return Math.abs(number(right.amount)) - Math.abs(number(left.amount)) || String(right.bookedAt || '').localeCompare(String(left.bookedAt || ''))
})

const GENERIC_REVIEW_PARTIES = new Set(['', 'bank account', 'current account', 'savings account', 'tide'])
export const transactionReviewSignature = (transaction) => {
  const metadata = transaction?.sourceMetadata || transaction?.source_metadata || {}
  const party = cleanCanonical(transaction?.counterparty || (number(transaction?.amount) >= 0 ? metadata.from : metadata.to))
  if (party.length >= 4 && !GENERIC_REVIEW_PARTIES.has(party)) return `party:${party}`
  const description = cleanCanonical(transaction?.description)
  return description.length >= 8 ? `description:${description}` : ''
}

export const similarTransactionsFor = (transaction, transactions = []) => {
  const signature = transactionReviewSignature(transaction)
  if (!signature) return []
  return (transactions || []).filter((candidate) => candidate !== transaction
    && String(candidate?.id || '') !== String(transaction?.id || '')
    && transactionReviewSignature(candidate) === signature)
}

export const similarTransactionsNeedingReviewFor = (transaction, transactions = [], properties = []) =>
  similarTransactionsFor(transaction, transactions).filter((candidate) => transactionNeedsReview(candidate, properties))

export const reviewPropagationPatch = (transaction) => ({
  category: transaction?.category || 'other',
  category_overridden: true,
  is_transfer: transaction?.category === 'transfer' || transaction?.isTransfer === true || transaction?.is_transfer === true,
  property_id: transaction?.propertyId || transaction?.property_id || null,
  performance_treatment: transaction?.performanceTreatment || transaction?.performance_treatment || 'auto',
  exclude_from_performance: transaction?.excludeFromPerformance === true || transaction?.exclude_from_performance === true,
})

export const bankTransactionStatePatch = (patch = {}) => ({
  ...(Object.hasOwn(patch, 'category') ? { category: patch.category } : {}),
  ...(Object.hasOwn(patch, 'is_transfer') ? { isTransfer: patch.is_transfer } : {}),
  ...(Object.hasOwn(patch, 'category_overridden') ? { categoryOverridden: patch.category_overridden } : {}),
  ...(Object.hasOwn(patch, 'property_id') ? { propertyId: patch.property_id || '' } : {}),
  ...(Object.hasOwn(patch, 'performance_treatment') ? { performanceTreatment: patch.performance_treatment } : {}),
  ...(Object.hasOwn(patch, 'exclude_from_performance') ? { excludeFromPerformance: patch.exclude_from_performance } : {}),
})

export const reviewTransactionsForDisplay = (transactions = [], properties = [], options = {}) => {
  const mode = options.mode === 'all' ? 'all' : 'review'
  const sortMode = options.sortMode === 'newest' ? 'newest' : 'amount'
  const base = mode === 'review'
    ? (transactions || []).filter((transaction) => transactionNeedsReview(transaction, properties))
    : (transactions || [])
  const sorted = sortTransactionsForReview(base, sortMode)
  if (mode !== 'review' || !options.activeReviewId) return sorted
  const activeId = String(options.activeReviewId)
  const active = (transactions || []).find((transaction) => String(transaction?.id || '') === activeId)
  if (!active) return sorted
  return [active, ...sorted.filter((transaction) => String(transaction?.id || '') !== activeId)]
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
  const trailingOptions = { ...options }
  delete trailingOptions.from
  delete trailingOptions.to
  const trailingHistory = selectedTransactions(transactions, trailingOptions)
  const latestTransactionDate = trailingHistory.map((transaction) => transaction.bookedAt).sort().at(-1)
  const asOf = isoDate(options.asOf || latestTransactionDate || new Date().toISOString())
  const monthly = aggregateCashFlow(trailingHistory, { period: 'month', includeTransfers: true, includePending: true })
  const byMonth = new Map(monthly.map((row) => [row.period, row]))
  const earliestTransactionDate = trailingHistory.map((transaction) => transaction.bookedAt).filter(Boolean).sort().at(0)
  const monthSpan = (from, to) => {
    if (!from || !to) return 0
    const start = new Date(`${isoDate(from)}T12:00:00Z`)
    const end = new Date(`${isoDate(to)}T12:00:00Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
    return Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1)
  }
  const historyMonths = Math.min(12, monthSpan(earliestTransactionDate, asOf))
  const average = (months, field) => {
    const divisor = Math.min(months, historyMonths)
    if (!divisor) return 0
    return Number((trailingMonthKeys(asOf, months)
      .reduce((total, key) => total + (byMonth.get(key)?.[field] || 0), 0) / divisor).toFixed(2))
  }
  const balances = balanceSeries.map((point) => Number(point.balance)).filter(Number.isFinite)
  const inflow = filtered.reduce((total, transaction) => total + Math.max(0, transaction.amount), 0)
  const outflow = filtered.reduce((total, transaction) => total + Math.max(0, -transaction.amount), 0)
  return {
    inflow: Number(inflow.toFixed(2)),
    outflow: Number(outflow.toFixed(2)),
    netCashFlow: Number((inflow - outflow).toFixed(2)),
    averageMonthlyInflow: average(12, 'inflow'),
    averageMonthlyOutflow: average(12, 'outflow'),
    historyMonths,
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
  .filter((account) => account.includeInCash !== false && String(account.currency || '').toUpperCase() === 'GBP')
  .reduce((total, account) => total + number(account.currentBalance), 0)
  .toFixed(2))

export const reportingAccountIds = (accounts, selectedIds, currency = 'GBP') => {
  const selected = new Set(selectedIds || accounts.map((account) => account.id))
  return accounts
    .filter((account) => selected.has(account.id) && String(account.currency || '').toUpperCase() === currency)
    .map((account) => account.id)
}

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
