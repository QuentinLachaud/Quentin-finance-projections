import { canonicalTransactionKey, classifyTransaction, suggestPropertyId } from './banking.js'

const clean = (value) => String(value ?? '').trim()
const number = (value) => {
  const parsed = Number(String(value ?? '').replace(/[£,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}
const isoDate = (value) => {
  const source = clean(value)
  let match = source.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  match = source.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3])
    return `${year}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`
  }
  const parsed = Date.parse(source)
  if (Number.isNaN(parsed)) return ''
  return new Date(parsed).toISOString().slice(0, 10)
}
const normaliseHeader = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const firstIndex = (headers, aliases) => headers.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)))
const parseDelimitedRows = (text, delimiter) => {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); cell = ''
      if (row.some((value) => clean(value))) rows.push(row)
      row = []
    } else cell += char
  }
  row.push(cell)
  if (row.some((value) => clean(value))) rows.push(row)
  return rows
}
const amountFromColumns = (row, indexes) => {
  const signed = indexes.amount >= 0 ? number(row[indexes.amount]) : null
  if (signed != null) return signed
  const incoming = indexes.moneyIn >= 0 ? number(row[indexes.moneyIn]) : null
  const outgoing = indexes.moneyOut >= 0 ? number(row[indexes.moneyOut]) : null
  if (incoming != null && Math.abs(incoming) > 0) return Math.abs(incoming)
  if (outgoing != null && Math.abs(outgoing) > 0) return -Math.abs(outgoing)
  return null
}
const finaliseTransactions = (rows, properties = []) => rows
  .filter((row) => row.bookedAt && Number.isFinite(row.amount) && row.amount !== 0)
  .map((row, index) => {
    const category = row.category || classifyTransaction(row)
    const propertyId = row.propertyId || suggestPropertyId({ ...row, category }, properties)
    const transaction = {
      ...row,
      category,
      propertyId,
      sourceType: 'tide_statement',
      status: row.status || 'booked',
      isTransfer: row.isTransfer === true || category === 'transfer',
      sourceMetadata: row.sourceMetadata || {},
    }
    const canonicalKey = canonicalTransactionKey(transaction)
    return {
      ...transaction,
      transactionKey: row.transactionKey || `statement-row:${canonicalKey}:${index}`,
      canonicalKey,
      statementIndex: index,
    }
  })

const TIDE_CURRENT_HEADERS = [
  'Date', 'Transaction ID', 'Transaction description', 'Reference', 'From', 'To',
  'Paid in', 'Paid out', 'Category name', 'Transaction type', 'Status', 'Initiated by', 'Tag 1',
]
const stripLeadingApostrophe = (value) => clean(value).replace(/^'/, '')
const normaliseText = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const classifyExactTideRow = (transaction, metadata) => {
  const categoryName = normaliseText(metadata.categoryName)
  const transactionType = normaliseText(metadata.transactionType)
  const haystack = normaliseText([metadata.description, metadata.reference, metadata.from, metadata.to].join(' '))
  const ownSavingsTransfer = transactionType === 'fundstransferout'
    && (normaliseText(metadata.to) === 'savings account' || haystack.includes('savings account'))
  if (ownSavingsTransfer) return { category: 'transfer', isTransfer: true }
  if (categoryName === 'director s loan' || /\b(?:director loan|directors loan|dla)\b/.test(haystack)) {
    return { category: transaction.amount >= 0 ? 'dla_injected' : 'dla_repaid', isTransfer: false }
  }
  if (categoryName === 'bank interest paid' || /\b(?:paragon|tmw|the mortgage works|mortgage)\b/.test(haystack)) return { category: 'mortgage', isTransfer: false }
  if (categoryName === 'rent' || (categoryName === 'income' && transaction.amount > 0) || /\brent\b/.test(haystack)) return { category: 'rent', isTransfer: false }
  if (categoryName === 'taxes' || /\b(?:hmrc|corporation tax|income tax|vat|council tax)\b/.test(haystack)) return { category: 'tax', isTransfer: false }
  if (/\b(?:salary|payroll|wages)\b/.test(haystack)) return { category: 'salary', isTransfer: false }
  if (/\b(?:speirs gumley|factor|property management|service charge)\b/.test(haystack)) return { category: 'factors', isTransfer: false }
  if (/\b(?:repair|maintenance|plumb|electrician|joiner|roofer|screwfix|toolstation|gas safety|eicr|pat)\b/.test(haystack)) return { category: 'repairs', isTransfer: false }
  if (categoryName === 'phone and internet' || /\b(?:electricity|energy|gas|water|broadband|internet|phone|utility|scottish power|octopus|edf)\b/.test(haystack)) return { category: 'utilities', isTransfer: false }
  if (/\b(?:insurance|insurer|premium|aviva|direct line)\b/.test(haystack)) return { category: 'insurance', isTransfer: false }
  if (categoryName === 'bank fees' || categoryName === 'professional fees' || transactionType === 'fee') return { category: 'fees', isTransfer: false }
  // Tide's broad "Transfers" category includes real external payments/deposits.
  // Only the evidenced Current -> Savings FundsTransferOut rows above are internal transfers.
  if (categoryName === 'transfers') return { category: 'other', isTransfer: false }
  const category = classifyTransaction({ ...transaction, additionalInformation: haystack })
  return { category, isTransfer: category === 'transfer' }
}

export const parseTideCsv = (text, properties = []) => {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0] || ''
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','
  const rows = parseDelimitedRows(String(text || ''), delimiter)
  if (rows.length < 2) return { transactions: [], closingBalance: null, statementFrom: '', statementTo: '', warnings: ['No transaction rows were found.'] }

  const rawHeaders = rows[0].map(clean)
  const exactTide = TIDE_CURRENT_HEADERS.every((header) => rawHeaders.includes(header))
  if (exactTide) {
    const index = Object.fromEntries(rawHeaders.map((header, position) => [header, position]))
    let skippedRows = 0
    const parsed = rows.slice(1).map((row) => {
      const tideTransactionId = stripLeadingApostrophe(row[index['Transaction ID']])
      const bookedAt = isoDate(row[index.Date])
      const paidIn = number(row[index['Paid in']])
      const paidOut = number(row[index['Paid out']])
      const amount = paidIn != null && Math.abs(paidIn) > 0
        ? Math.abs(paidIn)
        : paidOut != null && Math.abs(paidOut) > 0 ? -Math.abs(paidOut) : null
      if (!tideTransactionId || !bookedAt || !Number.isFinite(amount) || amount === 0) {
        skippedRows += 1
        return null
      }
      const sourceMetadata = {
        tideTransactionId,
        tideDate: clean(row[index.Date]),
        description: clean(row[index['Transaction description']]),
        reference: clean(row[index.Reference]),
        from: clean(row[index.From]),
        to: clean(row[index.To]),
        categoryName: clean(row[index['Category name']]),
        transactionType: clean(row[index['Transaction type']]),
        tideStatus: clean(row[index.Status]),
        initiatedBy: clean(row[index['Initiated by']]),
        tag1: clean(row[index['Tag 1']]),
      }
      const description = sourceMetadata.description || sourceMetadata.reference || sourceMetadata.from || sourceMetadata.to || 'Tide transaction'
      const counterparty = amount >= 0 ? sourceMetadata.from : sourceMetadata.to
      const status = normaliseText(sourceMetadata.tideStatus) === 'cleared' ? 'booked' : 'pending'
      const base = {
        transactionKey: `tide:${tideTransactionId}`,
        bookedAt,
        valueAt: bookedAt,
        amount,
        currency: 'GBP',
        description,
        counterparty,
        bankCode: sourceMetadata.transactionType,
        status,
        balanceAfter: null,
        sourceMetadata,
      }
      const classification = classifyExactTideRow(base, sourceMetadata)
      return { ...base, ...classification }
    }).filter(Boolean)
    const transactions = finaliseTransactions(parsed, properties)
    const dates = transactions.map((row) => row.bookedAt).sort()
    const warnings = []
    if (skippedRows) warnings.push(`${skippedRows} Tide row${skippedRows === 1 ? '' : 's'} skipped because the transaction ID, date or amount was missing.`)
    const pending = transactions.filter((row) => row.status !== 'booked').length
    if (pending) warnings.push(`${pending} non-cleared transaction${pending === 1 ? '' : 's'} will be stored but excluded from actual cash flow until cleared.`)
    return {
      transactions,
      closingBalance: null,
      statementFrom: dates[0] || '',
      statementTo: dates.at(-1) || '',
      warnings,
    }
  }

  // Compatibility fallback for older Tide CSV layouts.
  const headers = rawHeaders.map(normaliseHeader)
  const indexes = {
    date: firstIndex(headers, ['date', 'transaction date', 'created date', 'booking date']),
    description: firstIndex(headers, ['description', 'transaction', 'details', 'merchant', 'reference', 'name']),
    amount: firstIndex(headers, ['amount', 'transaction amount']),
    moneyIn: firstIndex(headers, ['money in', 'paid in', 'credit']),
    moneyOut: firstIndex(headers, ['money out', 'paid out', 'debit']),
    balance: firstIndex(headers, ['balance', 'running balance']),
  }
  if (indexes.date < 0 || (indexes.amount < 0 && indexes.moneyIn < 0 && indexes.moneyOut < 0)) {
    return { transactions: [], closingBalance: null, statementFrom: '', statementTo: '', warnings: ['The Tide export columns were not recognised. Use the standard transaction CSV or PDF statement export.'] }
  }
  const parsed = rows.slice(1).map((row) => {
    const bookedAt = isoDate(row[indexes.date])
    const amount = amountFromColumns(row, indexes)
    const description = clean(indexes.description >= 0 ? row[indexes.description] : '') || 'Tide transaction'
    const balanceAfter = indexes.balance >= 0 ? number(row[indexes.balance]) : null
    return { bookedAt, valueAt: bookedAt, amount, currency: 'GBP', description, counterparty: '', balanceAfter }
  })
  const transactions = finaliseTransactions(parsed, properties)
  const dates = transactions.map((row) => row.bookedAt).sort()
  const latestBalance = parsed.filter((row) => Number.isFinite(row.balanceAfter) && row.bookedAt)
    .sort((left, right) => left.bookedAt.localeCompare(right.bookedAt)).at(-1)
  return {
    transactions,
    closingBalance: latestBalance?.balanceAfter ?? null,
    statementFrom: dates[0] || '',
    statementTo: dates.at(-1) || '',
    warnings: [],
  }
}

const moneyTokens = (text) => [...String(text || '').matchAll(/(?:[-+]\s*)?£?\s*\d[\d,]*(?:\.\d{2})/g)]
const parseSignedMoneyToken = (token) => {
  const value = number(token)
  if (value == null) return null
  return /^\s*-/.test(token) ? -Math.abs(value) : Math.abs(value)
}

export const parseTideStatementText = (text, properties = []) => {
  const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean)
  const parsed = []
  for (const line of lines) {
    const dateMatch = line.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/)
    if (!dateMatch) continue
    const bookedAt = isoDate(dateMatch[1])
    const tokens = moneyTokens(line)
    if (!bookedAt || !tokens.length) continue
    const values = tokens.map((match) => ({ text: match[0], index: match.index, value: parseSignedMoneyToken(match[0]) })).filter((item) => item.value != null)
    if (!values.length) continue
    const balanceAfter = values.length > 1 ? Math.abs(values.at(-1).value) : null
    const amountToken = values.length > 1 ? values.at(-2) : values[0]
    let amount = amountToken.value
    const description = clean(line.slice(dateMatch.index + dateMatch[0].length, amountToken.index)).replace(/\s+/g, ' ') || 'Tide transaction'
    if (!/^[+-]/.test(clean(amountToken.text))) {
      if (/\b(paragon|mortgage|tmw|the mortgage works|fee|payment|debit|card|direct debit|dd)\b/i.test(description)) amount = -Math.abs(amount)
      else if (/\b(rent|credit|money in|paid in)\b/i.test(description)) amount = Math.abs(amount)
      else continue
    }
    parsed.push({ bookedAt, valueAt: bookedAt, amount, currency: 'GBP', description, counterparty: '', balanceAfter })
  }
  const transactions = finaliseTransactions(parsed, properties)
  const dates = transactions.map((row) => row.bookedAt).sort()
  return {
    transactions,
    closingBalance: parsed.filter((row) => Number.isFinite(row.balanceAfter) && row.bookedAt)
      .sort((left, right) => left.bookedAt.localeCompare(right.bookedAt)).at(-1)?.balanceAfter ?? null,
    statementFrom: dates[0] || '',
    statementTo: dates.at(-1) || '',
    warnings: transactions.length ? [] : ['No unambiguous signed Tide transactions could be read from this PDF. A Tide transaction CSV will import more reliably.'],
  }
}

const hashBytes = async (bytes) => {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const value of new Uint8Array(bytes)) { hash ^= value; hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const pdfRows = async (bytes) => {
  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) })
  const document = await loadingTask.promise
  const lines = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const groups = new Map()
    for (const item of content.items || []) {
      if (!item?.str) continue
      const y = Math.round(Number(item.transform?.[5] || 0) / 2) * 2
      const row = groups.get(y) || []
      row.push({ text: item.str, x: Number(item.transform?.[4] || 0) })
      groups.set(y, row)
    }
    const pageLines = [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    lines.push(...pageLines)
  }
  return lines.join('\n')
}

export const readTideStatementFile = async (file, properties = []) => {
  const bytes = await file.arrayBuffer()
  const fileHash = await hashBytes(bytes)
  const lowerName = clean(file.name).toLowerCase()
  let parsed
  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    parsed = parseTideStatementText(await pdfRows(bytes), properties)
  } else {
    parsed = parseTideCsv(new TextDecoder().decode(bytes), properties)
  }
  return { ...parsed, fileHash, fileName: file.name || 'Tide statement' }
}
