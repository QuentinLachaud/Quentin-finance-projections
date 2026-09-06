const DAY_MS = 86_400_000

export const BANK_CATEGORIES = [
  ['rent', 'Rent'],
  ['other_property_income', 'Other property income'],
  ['mortgage', 'Mortgage'],
  ['repairs', 'Repairs & maintenance'],
  ['capital_improvement', 'Capital improvement'],
  ['factors', 'Factors & management'],
  ['insurance', 'Insurance'],
  ['utilities', 'Utilities'],
  ['legal_professional', 'Legal & professional'],
  ['tax_property_duties', 'Tax & property duties'],
  ['property_acquisition', 'Property acquisition'],
  ['tenant_deposit', 'Tenant deposit'],
  ['payroll', 'Payroll'],
  ['bank_admin_fees', 'Bank & admin fees'],
  ['bank_interest', 'Bank interest'],
  ['owner_funding', 'Owner funding / DLA'],
  ['cash_extraction', 'Cash extraction'],
  ['transfer', 'Internal transfer'],
  ['other', 'Other'],
]

const LEGACY_BANK_CATEGORIES = {
  tax: 'tax_property_duties',
  salary: 'payroll',
  fees: 'bank_admin_fees',
  dla_injected: 'owner_funding',
  dla_repaid: 'owner_funding',
}
export const normalizeBankCategory = (value) => LEGACY_BANK_CATEGORIES[value] || value || 'other'

const CATEGORY_RULES = [
  ['tenant_deposit', /\b(safe\s*deposits?\s*scotland|safedepositscotland|tenan(?:t|cy) deposit|deposit protection|deposit scheme|despoit)\b/i],
  ['property_acquisition', /\b(lbtt|additional dwelling supplement|property acquisition|property purchase|purchase deposit|purchase costs?|purchase completion|completion monies|completion funds)\b/i],
  ['capital_improvement', /\b(capital improvement|refurb(?:ishment)?|renovation|new kitchen|new bathroom|extension)\b/i],
  ['cash_extraction', /\b(cash extraction|owner extraction|owner draw|distribution|dividend)\b/i],
  ['rent', /\b(rent|tenan(?:t|cy)|letting|airbnb|booking\.com)\b/i],
  ['mortgage', /\b(mortgage|the mortgage works|tmw|paragon|precise mortgages?|landbay)\b/i],
  ['tax_property_duties', /\b(hmrc|revenue\s*(?:and|&)\s*customs|corporation tax|income tax|council tax|self assessment|vat)\b/i],
  ['payroll', /\b(salary|payroll|wages?|payroll payment)\b/i],
  ['factors', /\b(factor(?:ing|s)?|property management|residential management|service charge)\b/i],
  ['repairs', /\b(contractor|repair|maintenance|plumb(?:er|ing)|electrician|joiner|roofer|screwfix|toolstation|b&q|gas safety|eicr|pat)\b/i],
  ['utilities', /\b(electric(?:ity)?|energy|gas|water|broadband|internet|utility|scottish power|octopus|edf|virgin media)\b/i],
  ['insurance', /\b(insurance|insurer|policy premium|aviva|direct line|landlord insurance)\b/i],
  ['legal_professional', /\b(solicitor|legal fee|legal services|conveyanc(?:e|ing)|accountant|accountancy)\b/i],
  ['bank_admin_fees', /\b(bank fee|account fee|overdraft fee|interest charge|bank interest|debit interest|bank charge)\b/i],
  ['transfer', /\b(internal transfer|own account|between accounts|savings transfer|cash transfer|monzo pot|revolut vault)\b/i],
]

const DLA_PATTERN = /\b(dla|directors?'? loan|shareholder loan|loan (?:from|to) director|director advance)\b/i
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
  if (DLA_PATTERN.test(haystack)) return 'owner_funding'
  if (number(transaction?.amount) > 0 && /\b(bank interest|interest earned|interest received|credit interest|savings interest)\b/i.test(haystack)) return 'bank_interest'
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
    category: normalizeBankCategory(row.category || 'other'),
    isTransfer: row.is_transfer === true,
    categoryOverridden: row.category_overridden === true,
    sourceType: row.source_type || 'gocardless',
    importId: row.import_id || '',
    propertyId: row.property_id || '',
    performanceTreatment: row.performance_treatment || 'auto',
    excludeFromPerformance: row.exclude_from_performance === true,
    sourceMetadata: row.source_metadata || {},
  }
  return { ...transaction, canonicalKey: canonicalTransactionKey(transaction) }
}

const reviewStateScore = (transaction) => (
  (transaction?.categoryOverridden || transaction?.category_overridden ? 4 : 0)
  + (transaction?.propertyId || transaction?.property_id ? 2 : 0)
  + ((transaction?.performanceTreatment || transaction?.performance_treatment || 'auto') !== 'auto' ? 2 : 0)
  + (transaction?.excludeFromPerformance || transaction?.exclude_from_performance ? 1 : 0)
)

const statementImportId = (transaction) => String(transaction?.importId || transaction?.import_id || '')

const preferredStatementImportRows = (rows) => {
  const byImport = new Map()
  const unscoped = []
  rows.forEach((row, index) => {
    const importId = statementImportId(row)
    if (!importId) { unscoped.push(row); return }
    const group = byImport.get(importId) || { importId, firstIndex: index, rows: [] }
    group.rows.push(row)
    byImport.set(importId, group)
  })
  if (byImport.size < 2) return rows
  const preferred = [...byImport.values()].sort((left, right) => (
    right.rows.length - left.rows.length
    || right.rows.reduce((sum, row) => sum + reviewStateScore(row), 0) - left.rows.reduce((sum, row) => sum + reviewStateScore(row), 0)
    || left.firstIndex - right.firstIndex
  ))[0].rows
  return [...preferred, ...unscoped]
}

export const deduplicateTransactions = (transactions) => {
  const rows = (Array.isArray(transactions) ? transactions : []).map((transaction) => ({
    ...transaction,
    canonicalKey: transaction.canonicalKey || canonicalTransactionKey(transaction),
  }))
  const groups = new Map()
  rows.forEach((row) => {
    const group = groups.get(row.canonicalKey) || []
    group.push(row)
    groups.set(row.canonicalKey, group)
  })
  return [...groups.values()].flatMap((group) => {
    const live = group.filter((row) => row.sourceType === 'gocardless')
    const statements = group.filter((row) => row.sourceType === 'tide_statement')
    const other = group.filter((row) => !['gocardless', 'tide_statement'].includes(row.sourceType))
    if (live.length) return [...live, ...other]
    if (statements.length <= 1) return group
    const preferredStatements = preferredStatementImportRows(statements)
    return [...preferredStatements, ...other]
  })
}

export const performanceTreatmentForTransaction = (transaction) => {
  if (transaction?.excludeFromPerformance || transaction?.exclude_from_performance) return 'exclude'
  const override = transaction?.performanceTreatment || transaction?.performance_treatment || 'auto'
  if (override !== 'auto') return override
  const category = normalizeBankCategory(transaction?.category)
  if (transaction?.isTransfer || transaction?.is_transfer || category === 'transfer') return 'exclude'
  if (category === 'owner_funding') return 'investor'
  if (['cash_extraction', 'payroll'].includes(category)) return 'extraction'
  if (['property_acquisition', 'capital_improvement'].includes(category)) return 'capital'
  if (category === 'tenant_deposit') return 'liability'
  if (category === 'mortgage') return 'financing'
  if (['bank_admin_fees', 'bank_interest'].includes(category)) return 'company'
  if (category === 'tax_property_duties') return (transaction?.propertyId || transaction?.property_id) ? 'operating' : 'company'
  if (category === 'legal_professional') return (transaction?.propertyId || transaction?.property_id) ? 'operating' : 'review'
  if (['rent', 'other_property_income', 'repairs', 'factors', 'utilities', 'insurance'].includes(category)) return 'operating'
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

const PROPERTY_LINKED_CATEGORIES = new Set([
  'rent', 'other_property_income', 'mortgage', 'repairs', 'capital_improvement', 'factors', 'insurance', 'utilities',
  'legal_professional', 'tax_property_duties', 'property_acquisition', 'tenant_deposit',
])
export const categoryUsesProperty = (category) => PROPERTY_LINKED_CATEGORIES.has(normalizeBankCategory(category))

const numericTextValue = (value) => {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : NaN
}
const closeMoney = (actual, expected) => Number.isFinite(Number(expected))
  && Math.abs(Number(actual) - Number(expected)) <= Math.max(1, Math.abs(Number(expected)) * 0.005)
const daysBetween = (left, right) => {
  const a = Date.parse(`${isoDate(left)}T12:00:00Z`)
  const b = Date.parse(`${isoDate(right)}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) / DAY_MS : Number.POSITIVE_INFINITY
}
const tenantActiveAt = (tenant, bookedAt) => {
  const date = isoDate(bookedAt)
  if (!date) return true
  const moveIn = isoDate(tenant?.moveIn || tenant?.tenantMoveIn)
  const moveOut = isoDate(tenant?.moveOut || tenant?.tenantMoveOut)
  return (!moveIn || moveIn <= date) && (!moveOut || date <= moveOut)
}
const tenantNameMatches = (name, haystack) => {
  const normalized = cleanCanonical(name)
  if (normalized.length < 4) return false
  if (haystack.includes(normalized)) return true
  const tokens = normalized.split(' ').filter((token) => token.length >= 3)
  return tokens.length >= 2 && tokens.every((token) => haystack.includes(token))
}
const inferenceTenants = (properties = [], tenants = []) => {
  const rows = [
    ...(Array.isArray(tenants) ? tenants : []),
    ...(properties || []).filter((property) => property?.tenantName).map((property) => ({
      id: `property-tenant:${property.id}`,
      propertyId: property.id,
      name: property.tenantName,
      moveIn: property.tenantMoveIn,
      moveOut: property.tenantMoveOut,
      depositHeld: property.depositHeld,
    })),
  ]
  const seen = new Set()
  return rows.filter((tenant) => {
    const key = `${tenant?.propertyId || ''}|${cleanCanonical(tenant?.name)}|${isoDate(tenant?.moveIn)}`
    if (!tenant?.propertyId || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const suggestTransactionAssignment = (transaction, properties = [], tenants = []) => {
  const amount = number(transaction?.amount)
  const category = normalizeBankCategory(transaction?.category)
  const metadata = transaction?.sourceMetadata || transaction?.source_metadata || {}
  const haystack = cleanCanonical([
    transaction?.description, transaction?.counterparty, metadata.reference, metadata.from, metadata.to,
  ].filter(Boolean).join(' '))
  const byProperty = new Map((properties || []).map((property) => [String(property?.id || ''), property]))
  const tenantRows = inferenceTenants(properties, tenants).filter((tenant) => byProperty.has(String(tenant.propertyId)))
  const candidates = tenantRows.map((tenant) => {
    const property = byProperty.get(String(tenant.propertyId))
    const expectedRent = Number(property?.rent)
    const deposit = numericTextValue(tenant?.depositHeld)
    return {
      tenant,
      property,
      propertyId: String(property?.id || ''),
      nameMatch: tenantNameMatches(tenant?.name, haystack),
      rentMatch: closeMoney(amount, expectedRent),
      depositMatch: closeMoney(Math.abs(amount), Math.abs(deposit)),
      active: tenantActiveAt(tenant, transaction?.bookedAt || transaction?.booked_at),
      nearMoveIn: daysBetween(transaction?.bookedAt || transaction?.booked_at, tenant?.moveIn) <= 45,
    }
  })
  const explicitDeposit = category === 'tenant_deposit'
    || /\b(safe\s*deposits?\s*scotland|safedepositscotland|tenan(?:t|cy) deposit|deposit protection|deposit scheme)\b/.test(haystack)

  const depositCandidates = candidates.filter((candidate) => (
    (candidate.nameMatch && candidate.depositMatch && candidate.nearMoveIn)
    || (explicitDeposit && candidate.nameMatch)
    || (explicitDeposit && candidate.depositMatch)
  ))
  const depositPropertyIds = [...new Set(depositCandidates.map((candidate) => candidate.propertyId))]
  if (depositPropertyIds.length === 1 && (explicitDeposit || amount > 0)) {
    const chosen = depositCandidates.find((candidate) => candidate.propertyId === depositPropertyIds[0])
    return {
      category: 'tenant_deposit',
      propertyId: depositPropertyIds[0],
      reason: chosen?.nameMatch ? 'Tenant + deposit match' : 'Deposit amount + tenancy match',
    }
  }

  if (amount <= 0) return { category, propertyId: '', reason: '' }
  const active = candidates.filter((candidate) => candidate.active)
  const tenantRent = active.filter((candidate) => candidate.nameMatch && candidate.rentMatch)
  const tenantRentIds = [...new Set(tenantRent.map((candidate) => candidate.propertyId))]
  if (tenantRentIds.length === 1) return { category: 'rent', propertyId: tenantRentIds[0], reason: 'Tenant + rent match' }

  const rentMatches = (properties || []).filter((property) => closeMoney(amount, Number(property?.rent)))
    .filter((property) => active.some((candidate) => candidate.propertyId === String(property.id)))
  if (rentMatches.length === 1) return { category: 'rent', propertyId: String(rentMatches[0].id || ''), reason: 'Expected rent match' }

  if (category === 'rent') {
    const tenantOnly = active.filter((candidate) => candidate.nameMatch)
    const tenantOnlyIds = [...new Set(tenantOnly.map((candidate) => candidate.propertyId))]
    if (tenantOnlyIds.length === 1) return { category: 'rent', propertyId: tenantOnlyIds[0], reason: 'Tenant match' }
  }
  return { category, propertyId: '', reason: '' }
}

export const transactionNeedsReview = (transaction, properties = []) => {
  const treatment = performanceTreatmentForTransaction(transaction)
  if (treatment === 'review') return true
  if (['operating', 'financing', 'capital', 'liability'].includes(treatment) && !transaction?.propertyId && !transaction?.property_id) return true
  return false
}


export const reconciliationTransactionsForBucket = (transactions = [], bucket = 'net') => (transactions || []).filter((transaction) => {
  if (transaction?.status === 'pending') return false
  const category = normalizeBankCategory(transaction?.category)
  const transferLike = transaction?.isTransfer || transaction?.is_transfer || category === 'transfer'
  if (transferLike) {
    const unresolved = transaction?.transferConfirmed === false
    if (bucket === 'net' || bucket === 'other') return unresolved
    return false
  }
  const treatment = performanceTreatmentForTransaction(transaction)
  if (bucket === 'excluded') return treatment === 'exclude'
  if (treatment === 'exclude') return false
  if (bucket === 'business') return ['operating', 'company', 'financing'].includes(treatment)
  if (bucket === 'owner') return treatment === 'investor'
  if (bucket === 'extraction') return treatment === 'extraction'
  if (bucket === 'other') return ['capital', 'liability', 'review'].includes(treatment)
  return bucket === 'net'
})

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
    cashExtractionNet: 0,
    cashExtractionAbsolute: 0,
    cashExtractionCount: 0,
    capitalMovementNet: 0,
    capitalMovementAbsolute: 0,
    capitalMovementCount: 0,
    liabilityMovementNet: 0,
    liabilityMovementAbsolute: 0,
    liabilityMovementCount: 0,
    reviewNet: 0,
    reviewAbsolute: 0,
    reviewCount: 0,
    internalTransferCount: 0,
    internalTransferAbsolute: 0,
    internalTransferNet: 0,
    unreconciledTransferCount: 0,
    unreconciledTransferAbsolute: 0,
    unreconciledTransferNet: 0,
    excludedCount: 0,
    excludedNet: 0,
    excludedAbsolute: 0,
    rawBankMovement: 0,
  }
  rows.forEach((transaction) => {
    const amount = number(transaction.amount)
    const treatment = performanceTreatmentForTransaction(transaction)
    // Raw means raw: every booked ledger row participates. Balanced internal transfers cancel without special arithmetic.
    totals.rawBankMovement += amount
    const transferLike = transaction.isTransfer || transaction.is_transfer || normalizeBankCategory(transaction.category) === 'transfer'
    if (transferLike) {
      if (transaction.transferConfirmed === true) {
        totals.internalTransferCount += 1
        totals.internalTransferAbsolute += Math.abs(amount)
        totals.internalTransferNet += amount
      } else {
        totals.unreconciledTransferCount += 1
        totals.unreconciledTransferAbsolute += Math.abs(amount)
        totals.unreconciledTransferNet += amount
      }
      return
    }
    if (treatment === 'operating') totals.operatingCashFlow += amount
    else if (treatment === 'company') totals.companyOnlyCashFlow += amount
    else if (treatment === 'financing') totals.financingCashFlow += amount
    else if (treatment === 'investor') {
      totals.ownerFundingNet += amount
      if (amount >= 0) totals.dlaInjected += amount
      else totals.dlaRepaid += Math.abs(amount)
    } else if (treatment === 'extraction') {
      totals.cashExtractionNet += amount
      totals.cashExtractionAbsolute += Math.abs(amount)
      totals.cashExtractionCount += 1
    } else if (treatment === 'capital') {
      totals.capitalMovementNet += amount
      totals.capitalMovementAbsolute += Math.abs(amount)
      totals.capitalMovementCount += 1
    } else if (treatment === 'liability') {
      totals.liabilityMovementNet += amount
      totals.liabilityMovementAbsolute += Math.abs(amount)
      totals.liabilityMovementCount += 1
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
  // A confirmed pair is ignored only when both legs are present in the selected scope. One-sided/boundary movement is retained.
  const confirmedTransferBoundaryNet = Math.abs(totals.internalTransferNet) < 0.005 ? 0 : totals.internalTransferNet
  const transferAdjustmentNet = totals.unreconciledTransferNet + confirmedTransferBoundaryNet
  const netBankMovement = companyFreeCashFlow + totals.ownerFundingNet + totals.cashExtractionNet + totals.capitalMovementNet
    + totals.liabilityMovementNet + totals.reviewNet + transferAdjustmentNet
  return Object.fromEntries(Object.entries({
    ...totals,
    companyFreeCashFlow,
    netDlaFunding,
    confirmedTransferBoundaryNet,
    transferAdjustmentNet,
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
  category: normalizeBankCategory(transaction?.category),
  category_overridden: true,
  is_transfer: normalizeBankCategory(transaction?.category) === 'transfer' || transaction?.isTransfer === true || transaction?.is_transfer === true,
  property_id: transaction?.propertyId || transaction?.property_id || null,
  performance_treatment: transaction?.performanceTreatment || transaction?.performance_treatment || 'auto',
  exclude_from_performance: transaction?.excludeFromPerformance === true || transaction?.exclude_from_performance === true,
})

export const bankTransactionStatePatch = (patch = {}) => ({
  ...(Object.hasOwn(patch, 'category') ? { category: normalizeBankCategory(patch.category) } : {}),
  ...(Object.hasOwn(patch, 'is_transfer') ? { isTransfer: patch.is_transfer } : {}),
  ...(Object.hasOwn(patch, 'category_overridden') ? { categoryOverridden: patch.category_overridden } : {}),
  ...(Object.hasOwn(patch, 'property_id') ? { propertyId: patch.property_id || '' } : {}),
  ...(Object.hasOwn(patch, 'performance_treatment') ? { performanceTreatment: patch.performance_treatment } : {}),
  ...(Object.hasOwn(patch, 'exclude_from_performance') ? { excludeFromPerformance: patch.exclude_from_performance } : {}),
})

const reviewedSimilarSuggestion = (transaction, transactions = []) => {
  const peers = similarTransactionsFor(transaction, transactions).filter((candidate) => (
    candidate?.categoryOverridden || candidate?.category_overridden
    || (candidate?.performanceTreatment || candidate?.performance_treatment || 'auto') !== 'auto'
  ))
  if (!peers.length) return null
  const states = peers.map((candidate) => ({
    category: normalizeBankCategory(candidate?.category),
    propertyId: candidate?.propertyId || candidate?.property_id || '',
    performanceTreatment: candidate?.performanceTreatment || candidate?.performance_treatment || 'auto',
  }))
  const first = states[0]
  return states.every((state) => state.category === first.category
    && state.propertyId === first.propertyId
    && state.performanceTreatment === first.performanceTreatment) ? first : null
}

export const reviewDraftForTransaction = (transaction, properties = [], tenants = [], transactions = []) => {
  const category = normalizeBankCategory(transaction?.category)
  const historical = reviewedSimilarSuggestion(transaction, transactions)
  const inferred = suggestTransactionAssignment({ ...transaction, category }, properties, tenants)
  const existingPropertyId = transaction?.propertyId || transaction?.property_id || ''
  const inferredPropertyId = historical?.propertyId || inferred.propertyId || ''
  const textSuggestion = existingPropertyId || inferredPropertyId ? '' : suggestPropertyId({ ...transaction, category }, properties)
  const inferredCategory = !transaction?.categoryOverridden && !transaction?.category_overridden
    ? normalizeBankCategory(historical?.category || inferred.category || category)
    : category
  return {
    category: inferredCategory,
    propertyId: existingPropertyId || inferredPropertyId || textSuggestion || '',
    performanceTreatment: transaction?.performanceTreatment || transaction?.performance_treatment || historical?.performanceTreatment || 'auto',
    excludeFromPerformance: transaction?.excludeFromPerformance === true || transaction?.exclude_from_performance === true,
    suggestionReason: existingPropertyId ? '' : (historical ? 'Previous matching transaction' : (inferred.propertyId ? inferred.reason : (textSuggestion ? 'Transaction details match' : ''))),
  }
}

export const reviewPatchFromDraft = (draft = {}) => {
  const category = normalizeBankCategory(draft.category)
  return {
    category,
    category_overridden: true,
    is_transfer: category === 'transfer',
    property_id: draft.propertyId || null,
    performance_treatment: draft.performanceTreatment || 'auto',
    exclude_from_performance: draft.excludeFromPerformance === true,
  }
}

export const exclusionUndoEntriesFor = (transactions = []) => (transactions || [])
  .filter((transaction) => performanceTreatmentForTransaction(transaction) !== 'exclude')
  .map((transaction) => ({
    transaction,
    patch: {
      exclude_from_performance: transaction?.excludeFromPerformance === true || transaction?.exclude_from_performance === true,
      performance_treatment: transaction?.performanceTreatment || transaction?.performance_treatment || 'auto',
    },
  }))

export const transactionWithReviewDraft = (transaction, draft = {}) => ({
  ...transaction,
  ...bankTransactionStatePatch(reviewPatchFromDraft(draft)),
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

const normalizedSourceTransactionType = (transaction) => cleanCanonical(
  (transaction?.sourceMetadata || transaction?.source_metadata || {}).transactionType || '',
).replace(/\s+/g, '')
const normalizedTideParty = (value) => cleanCanonical(value)
const stripTideApostrophe = (value) => String(value ?? '').trim().replace(/^'/, '')
const TIDE_OPAQUE_ID = /^[a-z0-9]{24,80}$/i

const tideMetadata = (transaction) => transaction?.sourceMetadata || transaction?.source_metadata || {}
const tideTransferOutToSavings = (transaction) => {
  const metadata = tideMetadata(transaction)
  return number(transaction?.amount) < 0
    && normalizedSourceTransactionType(transaction) === 'fundstransferout'
    && normalizedTideParty(metadata.to) === 'savings account'
}

export const tideInternalTransferIdentity = (transaction) => {
  const metadata = tideMetadata(transaction)
  const providerId = stripTideApostrophe(metadata.tideTransactionId)
  if (providerId && tideTransferOutToSavings(transaction)) return providerId.toLowerCase()
  if (providerId && number(transaction?.amount) > 0
    && normalizedSourceTransactionType(transaction) === 'fundstransferin'
    && /\bcurrent account\b/.test(normalizedTideParty(metadata.from))) return providerId.toLowerCase()
  if (number(transaction?.amount) <= 0) return ''
  const descriptionId = stripTideApostrophe(transaction?.description)
  return TIDE_OPAQUE_ID.test(descriptionId) ? descriptionId.toLowerCase() : ''
}

export const highConfidenceTideSourceCategory = (transaction) => {
  const metadata = tideMetadata(transaction)
  const haystack = cleanCanonical([
    transaction?.description, transaction?.counterparty, metadata.description, metadata.reference,
    metadata.from, metadata.to,
  ].filter(Boolean).join(' '))
  const tag = cleanCanonical(metadata.tag1)
  const type = normalizedSourceTransactionType(transaction)
  if (/\b(?:safe deposits scotland|safedeposits scotland|safedepositscotland|tenan(?:t|cy) deposit|deposit protection|deposit scheme|despoit)\b/.test(haystack)) return 'tenant_deposit'
  if (number(transaction?.amount) < 0 && /\b(?:purchase deposit|purchase costs?|property acquisition|property purchase|purchase completion|completion monies|completion funds|lbtt|additional dwelling supplement)\b/.test(haystack)) return 'property_acquisition'
  if (type === 'cardpaymentout' && /\btrivial benefit\b/.test(tag)) return 'cash_extraction'
  if (type === 'cardpaymentout' && (transaction?.isTransfer || transaction?.is_transfer || normalizeBankCategory(transaction?.category) === 'transfer')) {
    const inferred = classifyTransaction({ ...transaction, isTransfer: false, is_transfer: false, category: 'other' })
    return inferred === 'transfer' ? 'other' : inferred
  }
  return ''
}

const transferEvidenceScore = (transaction) => {
  const category = normalizeBankCategory(transaction?.category)
  const metadata = tideMetadata(transaction)
  const haystack = cleanCanonical([
    transaction?.description, transaction?.counterparty, transaction?.bankCode,
    metadata.reference, metadata.from, metadata.to, metadata.transactionType,
  ].filter(Boolean).join(' '))
  return (transaction?.isTransfer || transaction?.is_transfer || category === 'transfer' ? 4 : 0)
    + (/\b(savings account|current account|own account|internal transfer|between accounts|fundstransfer)\b/.test(haystack) ? 2 : 0)
}

const manuallyReviewedAsNonTransfer = (transaction) => (
  (transaction?.categoryOverridden || transaction?.category_overridden)
  && !(transaction?.isTransfer || transaction?.is_transfer || normalizeBankCategory(transaction?.category) === 'transfer')
)

const amountsCancel = (left, right) => Math.abs(number(left?.amount) + number(right?.amount)) < 0.005
const sameCurrency = (left, right) => String(left?.currency || 'GBP').toUpperCase() === String(right?.currency || 'GBP').toUpperCase()
const transferDayGap = (left, right) => {
  const leftTime = new Date(left?.bookedAt || left?.booked_at).getTime()
  const rightTime = new Date(right?.bookedAt || right?.booked_at).getTime()
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? Math.abs(leftTime - rightTime) / DAY_MS : Number.POSITIVE_INFINITY
}

export const detectInternalTransfers = (transactions) => {
  const result = (transactions || []).map((transaction) => ({
    ...transaction,
    transferConfirmed: false,
    transferMatch: '',
    sourceFactCorrection: false,
  }))

  // Source facts are stronger than a stale/manual Transfer label. Correct only facts that are intrinsically unambiguous.
  result.forEach((row) => {
    const sourceCategory = highConfidenceTideSourceCategory(row)
    if (!sourceCategory) return
    const wasTransfer = row.isTransfer || row.is_transfer || normalizeBankCategory(row.category) === 'transfer'
    if (normalizeBankCategory(row.category) !== sourceCategory || wasTransfer) {
      row.category = sourceCategory
      row.isTransfer = false
      row.sourceFactCorrection = true
    }
  })

  // Tide's Current CSV exposes the provider transaction ID on FundsTransferOut rows, while the Saver CSV may expose
  // that same ID as the quoted description. This is deterministic and remains valid for legacy imports that share account_id.
  const byProviderId = new Map()
  result.forEach((row, index) => {
    const identity = tideInternalTransferIdentity(row)
    if (!identity) return
    const group = byProviderId.get(identity) || []
    group.push(index)
    byProviderId.set(identity, group)
  })
  const matched = new Set()
  byProviderId.forEach((indices, identity) => {
    const debits = indices.filter((index) => tideTransferOutToSavings(result[index]))
    const credits = indices.filter((index) => number(result[index]?.amount) > 0)
    if (debits.length !== 1 || credits.length !== 1) return
    const left = result[debits[0]]
    const right = result[credits[0]]
    if (!amountsCancel(left, right) || !sameCurrency(left, right) || transferDayGap(left, right) > 2) return
    for (const index of [debits[0], credits[0]]) {
      const row = result[index]
      row.category = 'transfer'
      row.isTransfer = true
      row.transferConfirmed = true
      row.transferMatch = `tide:${identity}`
      matched.add(index)
    }
  })

  // Fallback for banks/providers without a durable shared ID: only unambiguous equal-and-opposite cross-account pairs.
  const candidates = []
  for (let left = 0; left < result.length; left += 1) {
    const a = result[left]
    if (matched.has(left) || a.status === 'pending' || manuallyReviewedAsNonTransfer(a)) continue
    for (let right = left + 1; right < result.length; right += 1) {
      const b = result[right]
      if (matched.has(right) || b.status === 'pending' || manuallyReviewedAsNonTransfer(b)) continue
      if (!a.accountId || !b.accountId || a.accountId === b.accountId || !sameCurrency(a, b)) continue
      if (!amountsCancel(a, b)) continue
      const dayGap = transferDayGap(a, b)
      const evidence = transferEvidenceScore(a) + transferEvidenceScore(b)
      const allowedGap = evidence > 0 ? 2 : 1
      if (dayGap > allowedGap) continue
      candidates.push({ left, right, score: evidence * 10 + (dayGap === 0 ? 3 : dayGap <= 1 ? 2 : 1), dayGap })
    }
  }
  const candidatesByIndex = new Map()
  candidates.forEach((candidate) => {
    for (const index of [candidate.left, candidate.right]) {
      const rows = candidatesByIndex.get(index) || []
      rows.push(candidate)
      candidatesByIndex.set(index, rows)
    }
  })
  const uniquelyBestFor = (index, candidate) => {
    const rows = candidatesByIndex.get(index) || []
    const bestScore = Math.max(...rows.map((row) => row.score))
    return candidate.score === bestScore && rows.filter((row) => row.score === bestScore).length === 1
  }
  candidates.sort((a, b) => b.score - a.score || a.dayGap - b.dayGap || a.left - b.left || a.right - b.right)
  candidates.forEach((candidate) => {
    const { left, right } = candidate
    if (matched.has(left) || matched.has(right) || !uniquelyBestFor(left, candidate) || !uniquelyBestFor(right, candidate)) return
    const a = result[left]
    const b = result[right]
    a.isTransfer = true
    b.isTransfer = true
    a.category = 'transfer'
    b.category = 'transfer'
    a.transferConfirmed = true
    b.transferConfirmed = true
    a.transferMatch = 'heuristic'
    b.transferMatch = 'heuristic'
    matched.add(left)
    matched.add(right)
  })
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

export const transactionExcludedFromAnalysis = (transaction) => {
  if (transaction?.excludeFromPerformance || transaction?.exclude_from_performance) return true
  const override = transaction?.performanceTreatment || transaction?.performance_treatment || 'auto'
  if (override === 'exclude') return true
  const category = normalizeBankCategory(transaction?.category)
  if (transaction?.isTransfer || transaction?.is_transfer || category === 'transfer') return transaction?.transferConfirmed === true
  return performanceTreatmentForTransaction(transaction) === 'exclude'
}

const optionalNumber = (value) => (
  value == null || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value)
)

const isManualTideStatementAccount = (account) => String(
  account?.externalAccountId || account?.external_account_id || '',
).startsWith('manual:tide')

const latestObservedBalanceForRows = (rows = []) => {
  let latest = null
  ;(rows || []).forEach((transaction, index) => {
    const balance = optionalNumber(transaction?.balanceAfter ?? transaction?.balance_after)
    if (balance == null || transaction?.status === 'pending' || !transaction?.bookedAt) return
    const candidate = { transaction, index, balance }
    if (!latest
      || String(transaction.bookedAt).localeCompare(String(latest.transaction.bookedAt)) > 0
      || (String(transaction.bookedAt) === String(latest.transaction.bookedAt) && index > latest.index)) {
      latest = candidate
    }
  })
  return latest
}

export const authoritativeAccountBalance = (account, transactions = []) => {
  const accountId = String(account?.id || '')
  const accountRows = (transactions || []).filter((transaction) => String(transaction?.accountId || transaction?.account_id || '') === accountId)
  const observed = latestObservedBalanceForRows(accountRows)
  if (isManualTideStatementAccount(account)) return observed?.balance ?? null
  const current = optionalNumber(account?.currentBalance ?? account?.current_balance)
  return current ?? observed?.balance ?? null
}

export const accountBalanceIsAuthoritative = (account, transactions = []) => (
  authoritativeAccountBalance(account, transactions) != null
)

export const reconstructBalanceSeries = (accounts, transactions, options = {}) => {
  const accountIds = new Set(options.accountIds || accounts.filter((account) => account.includeInCash !== false).map((account) => account.id))
  const selectedAccounts = accounts.filter((account) => accountIds.has(account.id))
  const dates = new Set()
  const histories = selectedAccounts.map((account) => {
    const allRows = transactions
      .filter((transaction) => transaction.accountId === account.id && transaction.status !== 'pending' && transaction.bookedAt)
      .sort((a, b) => a.bookedAt.localeCompare(b.bookedAt))
    const rows = allRows.filter((transaction) => (
      (options.includeExcluded !== false || !transactionExcludedFromAnalysis(transaction))
      && (options.includeOwnerFunding !== false || performanceTreatmentForTransaction(transaction) !== 'investor')
    ))
    allRows.forEach((transaction) => dates.add(transaction.bookedAt))

    const observed = latestObservedBalanceForRows(allRows)
    const manualStatement = isManualTideStatementAccount(account)
    const currentBalance = optionalNumber(account.currentBalance ?? account.current_balance)
    let baseline = 0

    if (manualStatement && observed) {
      baseline = observed.balance - allRows
        .slice(0, observed.index + 1)
        .reduce((sum, transaction) => sum + number(transaction.amount), 0)
    } else if (!manualStatement && currentBalance != null) {
      baseline = currentBalance - allRows.reduce((sum, transaction) => sum + number(transaction.amount), 0)
      const currentDate = isoDate(account.balanceUpdatedAt || account.balance_updated_at || options.asOf || new Date().toISOString())
      if (currentDate) dates.add(currentDate)
    } else if (observed) {
      baseline = observed.balance - allRows
        .slice(0, observed.index + 1)
        .reduce((sum, transaction) => sum + number(transaction.amount), 0)
    }

    return { baseline, rows }
  })

  return [...dates].sort().map((date) => ({
    date,
    balance: Number(histories.reduce((total, history) => total + history.baseline + history.rows
      .filter((transaction) => transaction.bookedAt <= date)
      .reduce((sum, transaction) => sum + number(transaction.amount), 0), 0).toFixed(2)),
  }))
}


export const balanceSeriesWithoutOwnerFundingDates = (balanceSeries = [], transactions = [], accountIds = []) => {
  const selected = accountIds?.length ? new Set(accountIds) : null
  const hiddenDates = new Set((transactions || [])
    .filter((transaction) => (!selected || selected.has(transaction.accountId)) && performanceTreatmentForTransaction(transaction) === 'investor')
    .map((transaction) => isoDate(transaction.bookedAt || transaction.booked_at))
    .filter(Boolean))
  if (!hiddenDates.size) return balanceSeries
  const latestDate = balanceSeries.at(-1)?.date
  const filtered = (balanceSeries || []).filter((point) => point.date === latestDate || !hiddenDates.has(point.date))
  return filtered.length >= 2 ? filtered : balanceSeries
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
