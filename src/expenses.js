const makeId = () => globalThis.crypto?.randomUUID?.() || `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`

const clean = (value) => String(value ?? '').trim()

export const inferExpenseType = (amount) => {
  if (amount === '' || amount == null || !Number.isFinite(Number(amount))) return 'unspecified'
  const value = Number(amount)
  if (value > 0) return 'income'
  if (value < 0) return 'expense'
  return 'neutral'
}

export const parseExpenseAmount = (value) => {
  const source = clean(value)
  if (!source) return ''
  const negative = /\(.*\)/.test(source)
  const numeric = Number(source.replace(/[£,\s()]/g, ''))
  if (!Number.isFinite(numeric)) return ''
  return negative ? -Math.abs(numeric) : numeric
}

export const normalizeExpenseDate = (value) => {
  const source = clean(value)
  if (!source || source === '?') return ''

  const isoMatch = source.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const ukMatch = source.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  const match = isoMatch
    ? [source, isoMatch[3], isoMatch[2], isoMatch[1]]
    : ukMatch

  if (!match) return ''
  const [, dayText, monthText, yearText] = match
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return ''

  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return ''
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const createExpense = (overrides = {}) => ({
  id: overrides.id || makeId(),
  date: '',
  property: 'All',
  category: '',
  amount: '',
  description: '',
  recurrence: '',
  notes: '',
  receiptLink: '',
  ...overrides,
})

const headerKey = (value) => clean(value)
  .toLowerCase()
  .replace('£', '')
  .replace(/[^a-z0-9]+/g, '')

const csvRows = (text, delimiter) => {
  if (delimiter === '\t') return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split('\t'))
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => clean(value))) rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  row.push(field)
  if (row.some((value) => clean(value))) rows.push(row)
  return rows
}

export const parseExpenseImport = (text) => {
  const source = String(text || '').trim()
  if (!source) return []
  const firstLine = source.split(/\r?\n/, 1)[0]
  const delimiter = firstLine.includes('\t') ? '\t' : ','
  const rows = csvRows(source, delimiter)
  if (rows.length < 2) return []

  const header = rows[0].map(headerKey)
  const indexes = Object.fromEntries(header.map((key, index) => [key, index]))
  const get = (row, ...keys) => {
    const key = keys.find((candidate) => indexes[candidate] != null)
    return key ? clean(row[indexes[key]]) : ''
  }

  return rows.slice(1).map((row) => createExpense({
    date: normalizeExpenseDate(get(row, 'date')),
    property: get(row, 'property') || 'All',
    category: get(row, 'category'),
    amount: parseExpenseAmount(get(row, 'amount', 'amountgbp')),
    description: get(row, 'description'),
    recurrence: get(row, 'recurrence'),
    notes: get(row, 'notes'),
    receiptLink: get(row, 'receiptlink', 'receipt', 'link'),
  })).filter((item) => item.date || item.category || item.amount !== '' || item.description || item.notes || item.receiptLink)
}

const fingerprint = (item) => [
  item.date, item.property, item.category, item.amount, item.description, item.recurrence, item.notes, item.receiptLink, item.document?.title, item.document?.type, item.document?.contractorId, ...(item.document?.tagIds || []),
].map((value) => clean(value).toLowerCase()).join('|')

export const mergeExpenseImports = (existing, incoming) => {
  const known = new Set((existing || []).map(fingerprint))
  const added = []
  let duplicates = 0
  for (const item of incoming || []) {
    const key = fingerprint(item)
    if (known.has(key)) {
      duplicates += 1
      continue
    }
    known.add(key)
    added.push(item)
  }
  return { expenses: [...added, ...(existing || [])], added: added.length, duplicates }
}

export const filterExpenses = (expenses, filters = {}) => {
  const query = clean(filters.query).toLowerCase()
  const property = clean(filters.property).toLowerCase()
  const category = clean(filters.category).toLowerCase()
  const recurrence = clean(filters.recurrence).toLowerCase()
  const type = clean(filters.type).toLowerCase()
  const from = normalizeExpenseDate(filters.from)
  const to = normalizeExpenseDate(filters.to)

  return [...(expenses || [])].filter((item) => {
    const itemType = inferExpenseType(item.amount)
    if (property && property !== '__all__' && clean(item.property).toLowerCase() !== property) return false
    if (category && category !== '__all__' && clean(item.category).toLowerCase() !== category) return false
    if (recurrence && recurrence !== '__all__' && clean(item.recurrence).toLowerCase() !== recurrence) return false
    if (type && type !== '__all__' && itemType !== type) return false
    if (from && (!item.date || item.date < from)) return false
    if (to && (!item.date || item.date > to)) return false
    if (query) {
      const haystack = [item.date, item.property, item.category, item.description, item.recurrence, item.notes, item.receiptLink, itemType, item.document?.title, item.document?.type, item.document?.association?.label, item.document?.contractorId, ...(item.document?.tagIds || [])]
        .map((value) => clean(value).toLowerCase()).join(' ')
      if (!haystack.includes(query)) return false
    }
    return true
  }).sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })
}

export const summarizeExpenses = (expenses) => {
  const amounts = (expenses || []).map((item) => Number(item.amount)).filter(Number.isFinite)
  const income = amounts.filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0)
  const expense = Math.abs(amounts.filter((amount) => amount < 0).reduce((sum, amount) => sum + amount, 0))
  return { income, expense, net: income - expense, count: (expenses || []).length }
}

export const isReceiptUrl = (value) => /^https?:\/\//i.test(clean(value))
