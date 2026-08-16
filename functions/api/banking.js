import { detectInternalTransfers, normalizeGoCardlessTransaction } from '../../src/banking.js'

const GOCARDLESS_ROOT = 'https://bankaccountdata.gocardless.com/api/v2'
const PREFERRED_BANKS = ['Tide', 'Monzo', 'Revolut', 'Chase']
let tokenCache = null

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
})

const apiError = async (response, fallback) => {
  const payload = await response.json().catch(() => ({}))
  const error = new Error(payload.detail || payload.summary || payload.error || fallback)
  error.status = response.status
  throw error
}

const authenticateUser = async (request, env) => {
  const authorization = request.headers.get('authorization')
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !supabaseKey) return null
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { authorization, apikey: supabaseKey } })
  return response.ok ? response.json() : null
}

const requireConfiguration = (env) => {
  if (!env.GOCARDLESS_SECRET_ID || !env.GOCARDLESS_SECRET_KEY) {
    const error = new Error('Bank connections are not configured yet.')
    error.code = 'not_configured'
    error.status = 503
    throw error
  }
}

const getAccessToken = async (env) => {
  requireConfiguration(env)
  if (tokenCache?.expiresAt > Date.now() + 60_000) return tokenCache.access
  const response = await fetch(`${GOCARDLESS_ROOT}/token/new/`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ secret_id: env.GOCARDLESS_SECRET_ID, secret_key: env.GOCARDLESS_SECRET_KEY }),
  })
  if (!response.ok) return apiError(response, 'GoCardless authentication failed.')
  const payload = await response.json()
  tokenCache = { access: payload.access, expiresAt: Date.now() + Number(payload.access_expires || 86_400) * 1000 }
  return tokenCache.access
}

const gcFetch = async (path, env, options = {}) => {
  const access = await getAccessToken(env)
  const response = await fetch(`${GOCARDLESS_ROOT}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${access}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) return apiError(response, 'The bank data provider could not complete this request.')
  return response.status === 204 ? null : response.json()
}

const supabaseFetch = async (env, authorization, path, options = {}) => {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      authorization,
      'content-type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) return apiError(response, 'Bank data could not be saved securely.')
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const upsert = (env, authorization, table, conflict, rows) => supabaseFetch(
  env,
  authorization,
  `${table}?on_conflict=${encodeURIComponent(conflict)}`,
  {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  },
)

const selectConnection = async (env, authorization, id) => {
  const rows = await supabaseFetch(env, authorization, `bank_connections?id=eq.${encodeURIComponent(id)}&select=*`)
  if (!rows?.[0]) {
    const error = new Error('This bank connection was not found.')
    error.status = 404
    throw error
  }
  return rows[0]
}

const chooseBalances = (payload) => {
  const balances = payload?.balances || []
  const amount = (balance) => Number(balance?.balanceAmount?.amount || 0)
  const booked = balances.find((balance) => /interimBooked|closingBooked|expected/i.test(balance.balanceType)) || balances[0]
  const available = balances.find((balance) => /interimAvailable|available/i.test(balance.balanceType))
  return {
    current: amount(booked),
    available: available ? amount(available) : null,
    currency: booked?.balanceAmount?.currency || available?.balanceAmount?.currency || 'GBP',
    updatedAt: booked?.lastChangeDateTime || new Date().toISOString(),
  }
}

const chunks = (rows, size = 400) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size))

const syncAccount = async ({ externalAccountId, connection, user, env, authorization }) => {
  const [detailsPayload, balancePayload, transactionPayload] = await Promise.all([
    gcFetch(`/accounts/${encodeURIComponent(externalAccountId)}/details/`, env),
    gcFetch(`/accounts/${encodeURIComponent(externalAccountId)}/balances/`, env),
    gcFetch(`/accounts/${encodeURIComponent(externalAccountId)}/transactions/`, env),
  ])
  const details = detailsPayload?.account || {}
  const balance = chooseBalances(balancePayload)
  const iban = details.iban || details.bban || ''
  const [account] = await upsert(env, authorization, 'bank_accounts', 'user_id,external_account_id', [{
    user_id: user.id,
    connection_id: connection.id,
    external_account_id: externalAccountId,
    display_name: details.displayName || details.name || connection.institution_name || 'Bank account',
    owner_name: details.ownerName || details.owner_name || null,
    iban_last4: iban ? iban.slice(-4) : null,
    currency: details.currency || balance.currency,
    account_type: details.cashAccountType || details.product || null,
    current_balance: balance.current,
    available_balance: balance.available,
    balance_updated_at: balance.updatedAt,
  }])

  const existingOverrides = await supabaseFetch(
    env,
    authorization,
    `bank_transactions?account_id=eq.${encodeURIComponent(account.id)}&category_overridden=eq.true&select=transaction_key,category,is_transfer`,
  )
  const overrides = new Map((existingOverrides || []).map((row) => [row.transaction_key, row]))
  const booked = transactionPayload?.transactions?.booked || []
  const pending = transactionPayload?.transactions?.pending || []
  const normalised = [
    ...booked.map((row) => normalizeGoCardlessTransaction(row, account.id, 'booked')),
    ...pending.map((row) => normalizeGoCardlessTransaction(row, account.id, 'pending')),
  ].map((row) => {
    const override = overrides.get(row.transactionKey)
    return {
      user_id: user.id,
      account_id: account.id,
      transaction_key: row.transactionKey,
      booked_at: row.bookedAt || null,
      value_at: row.valueAt || null,
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      counterparty: row.counterparty || null,
      bank_code: row.bankCode || null,
      status: row.status,
      balance_after: row.balanceAfter,
      category: override?.category || row.category,
      is_transfer: override?.is_transfer ?? row.isTransfer,
      category_overridden: Boolean(override),
    }
  })
  for (const batch of chunks(normalised)) {
    if (batch.length) await upsert(env, authorization, 'bank_transactions', 'user_id,account_id,transaction_key', batch)
  }
  await upsert(env, authorization, 'bank_balance_snapshots', 'user_id,account_id,captured_on', [{
    user_id: user.id,
    account_id: account.id,
    captured_on: new Date().toISOString().slice(0, 10),
    balance: balance.current,
    available_balance: balance.available,
    currency: balance.currency,
  }])
  return account
}

const detectAndPersistTransfers = async (env, authorization) => {
  const rows = await supabaseFetch(env, authorization, 'bank_transactions?select=id,account_id,booked_at,amount,currency,status,is_transfer,category,category_overridden')
  const detected = detectInternalTransfers((rows || []).map((row) => ({
    id: row.id,
    accountId: row.account_id,
    bookedAt: row.booked_at,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    isTransfer: row.is_transfer,
    category: row.category,
    categoryOverridden: row.category_overridden,
  })))
  const updates = detected.filter((row) => row.isTransfer && !row.categoryOverridden)
  await Promise.all(updates.map((row) => supabaseFetch(env, authorization, `bank_transactions?id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_transfer: true, category: 'transfer' }),
  })))
}

const syncConnection = async ({ connection, user, env, authorization }) => {
  const requisition = await gcFetch(`/requisitions/${encodeURIComponent(connection.requisition_id)}/`, env)
  await supabaseFetch(env, authorization, `bank_connections?id=eq.${encodeURIComponent(connection.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: requisition.status,
      connected_at: requisition.status === 'LN' ? connection.connected_at || new Date().toISOString() : connection.connected_at,
      last_synced_at: requisition.status === 'LN' ? new Date().toISOString() : connection.last_synced_at,
    }),
  })
  if (requisition.status !== 'LN') return { status: requisition.status, accounts: [] }
  const accounts = []
  for (const externalAccountId of requisition.accounts || []) {
    accounts.push(await syncAccount({ externalAccountId, connection, user, env, authorization }))
  }
  await detectAndPersistTransfers(env, authorization)
  return { status: requisition.status, accounts }
}

const listInstitutions = async (env) => {
  const institutions = await gcFetch('/institutions/?country=gb', env)
  return institutions.map((institution) => ({
    id: institution.id,
    name: institution.name,
    bic: institution.bic,
    logo: institution.logo,
    transactionDays: Number(institution.transaction_total_days || 90),
    accessDays: Number(institution.max_access_valid_for_days || 90),
    preferred: PREFERRED_BANKS.some((name) => institution.name.toLowerCase().includes(name.toLowerCase())),
  })).sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.name.localeCompare(b.name))
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    const url = new URL(request.url)
    if (url.searchParams.get('action') !== 'institutions') return json({ error: 'Unknown bank-data request.' }, 400)
    return json({ institutions: await listInstitutions(env) })
  } catch (error) {
    return json({ error: error.message || 'Bank data is temporarily unavailable.', code: error.code }, error.status >= 400 && error.status < 600 ? error.status : 502)
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    const authorization = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))
    if (body.action === 'connect') {
      const institutions = await listInstitutions(env)
      const institution = institutions.find((candidate) => candidate.id === body.institutionId)
      if (!institution) return json({ error: 'Choose a currently available UK bank.' }, 400)
      const accessDays = Math.max(1, Math.min(90, institution.accessDays))
      const agreement = await gcFetch('/agreements/enduser/', env, {
        method: 'POST',
        body: JSON.stringify({
          institution_id: institution.id,
          max_historical_days: Math.max(1, Math.min(730, institution.transactionDays)),
          access_valid_for_days: accessDays,
          access_scope: ['balances', 'details', 'transactions'],
        }),
      })
      const connectionId = crypto.randomUUID()
      const origin = new URL(request.url).origin
      const redirect = new URL(`/?bank_callback=1&connection=${encodeURIComponent(connectionId)}`, origin).toString()
      const requisition = await gcFetch('/requisitions/', env, {
        method: 'POST',
        body: JSON.stringify({
          redirect,
          institution_id: institution.id,
          reference: crypto.randomUUID(),
          agreement: agreement.id,
          user_language: 'EN',
        }),
      })
      await upsert(env, authorization, 'bank_connections', 'user_id,requisition_id', [{
        id: connectionId,
        user_id: user.id,
        requisition_id: requisition.id,
        institution_id: institution.id,
        institution_name: institution.name,
        institution_logo: institution.logo,
        agreement_id: agreement.id,
        status: requisition.status || 'CR',
        access_expires_at: new Date(Date.now() + accessDays * DAY_MS).toISOString(),
      }])
      return json({ link: requisition.link, connectionId })
    }

    if (body.action === 'finalize' || body.action === 'sync') {
      const connection = await selectConnection(env, authorization, body.connectionId)
      return json(await syncConnection({ connection, user, env, authorization }))
    }
    return json({ error: 'Unknown bank-data request.' }, 400)
  } catch (error) {
    return json({ error: error.message || 'Bank data is temporarily unavailable.', code: error.code }, error.status >= 400 && error.status < 600 ? error.status : 502)
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    const authorization = request.headers.get('authorization')
    const id = new URL(request.url).searchParams.get('connection')
    const connection = await selectConnection(env, authorization, id)
    await gcFetch(`/requisitions/${encodeURIComponent(connection.requisition_id)}/`, env, { method: 'DELETE' })
    await supabaseFetch(env, authorization, `bank_connections?id=eq.${encodeURIComponent(connection.id)}`, { method: 'DELETE' })
    return json({ deleted: true })
  } catch (error) {
    return json({ error: error.message || 'The bank connection could not be removed.' }, error.status >= 400 && error.status < 600 ? error.status : 502)
  }
}

const DAY_MS = 86_400_000
