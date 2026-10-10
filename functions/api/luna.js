import { executePortfolioAction, LUNA_PHASE_ONE_OPERATIONS, resolveLunaProperty } from '../../src/lunaCapabilities.js'
import { mapStoredBankTransaction } from '../../src/banking.js'
import { executeLunaUiOperation, LUNA_UI_OPERATIONS, LUNA_WORKSPACE_IDS } from '../../src/lunaUiOperations.js'
import { answerDeterministicPortfolioQuestion } from '../../src/lunaDeterministicAnswers.js'
import { chatActionsForPortfolioResult, mergeLunaChatActions } from '../../src/lunaChatActions.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
})

const apiError = async (response, fallback) => {
  const payload = await response.json().catch(() => ({}))
  const error = new Error(payload.error?.message || payload.message || payload.error || fallback)
  error.status = response.status
  throw error
}

const supabaseConfiguration = (env) => ({
  url: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  key: env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

const authenticateUser = async (request, env) => {
  const authorization = request.headers.get('authorization')
  const { url, key } = supabaseConfiguration(env)
  if (!authorization?.startsWith('Bearer ') || !url || !key) return null
  const response = await fetch(`${url}/auth/v1/user`, { headers: { authorization, apikey: key } })
  return response.ok ? response.json() : null
}

const supabaseFetch = async (env, authorization, path, options = {}) => {
  const { url, key } = supabaseConfiguration(env)
  if (!url || !key) throw new Error('Supabase is not configured.')
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization,
      'content-type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) return apiError(response, 'Portfolio data could not be saved securely.')
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const loadPortfolio = async (env, authorization, userId) => {
  const rows = await supabaseFetch(
    env,
    authorization,
    `portfolio_states?user_id=eq.${encodeURIComponent(userId)}&select=portfolio,updated_at`,
  )
  return { portfolio: rows?.[0]?.portfolio || { properties: [], settings: {} }, updatedAt: rows?.[0]?.updated_at || null }
}

const savePortfolio = async (env, authorization, userId, portfolio, expectedUpdatedAt = null) => {
  // Compare-and-swap: prevent Luna from overwriting a portfolio changed by another client.
  const versioned = Boolean(expectedUpdatedAt)
  const path = versioned
    ? 'portfolio_states?user_id=eq.' + encodeURIComponent(userId)
      + '&updated_at=eq.' + encodeURIComponent(expectedUpdatedAt)
    : 'portfolio_states?on_conflict=user_id'
  const rows = await supabaseFetch(env, authorization, path, {
    method: versioned ? 'PATCH' : 'POST',
    headers: { prefer: versioned ? 'return=representation' : 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(versioned ? { portfolio } : { user_id: userId, portfolio }),
  })
  if (!rows?.length) {
    const error = new Error('Portfolio was changed in another tab or device. Refresh and retry; Luna did not overwrite those changes.')
    error.status = 409
    throw error
  }
  return { portfolio: rows[0].portfolio, updatedAt: rows[0].updated_at || null }
}


const LUNA_BANK_READ_OPERATIONS = ['bank.accounts', 'bank.transactions', 'bank.summary']

const validatedBankOptions = (raw) => {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const allowed = new Set(['limit', 'account', 'accountId', 'property', 'propertyId', 'category', 'from', 'to', 'query'])
  const invalid = Object.keys(data).filter((key) => !allowed.has(key))
  if (invalid.length) throw new Error('Unsupported banking query option(s): ' + invalid.join(', '))
  const limit = data.limit == null ? 100 : Number(data.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Bank transaction limit must be 1 to 200.')
  for (const key of ['from', 'to']) {
    if (data[key] != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data[key]))) {
      throw new Error('Invalid bank date: ' + key)
    }
  }
  return { ...data, limit }
}

const bankAccounts = async (env, authorization, userId) => {
  const rows = await supabaseFetch(
    env, authorization,
    'bank_accounts?user_id=eq.' + encodeURIComponent(userId)
      + '&select=id,display_name,currency,current_balance,available_balance,balance_updated_at,include_in_cash'
      + '&order=display_name.asc',
  )
  return (rows || []).map((row) => ({
    id: row.id, name: row.display_name, currency: row.currency || 'GBP',
    balance: Number(row.current_balance || 0),
    availableBalance: row.available_balance == null ? null : Number(row.available_balance),
    balanceUpdatedAt: row.balance_updated_at || null,
    includedInCash: row.include_in_cash === true,
  }))
}

const readBankRecords = async (env, authorization, user, portfolio, args) => {
  const operation = args.operation
  const opts = validatedBankOptions(args.data)
  const accounts = await bankAccounts(env, authorization, user.id)
  if (operation === 'bank.accounts') return { accounts, count: accounts.length }
  if (operation === 'bank.summary') {
    const included = accounts.filter((account) => account.includedInCash)
    const currencies = [...new Set(included.map((account) => account.currency))]
    return {
      accounts,
      includedBalancesByCurrency: currencies.map((currency) => ({
        currency, total: included.filter((account) => account.currency === currency)
          .reduce((sum, account) => sum + account.balance, 0),
      })),
      note: 'Cached account balances as of balanceUpdatedAt. No cross-currency conversion or assumption that these equal the portfolio cashHeld setting.',
    }
  }
  const accountRef = String(opts.accountId || opts.account || '').trim().toLowerCase()
  const matches = accountRef && accounts.filter((item) => item.id.toLowerCase() === accountRef
    || item.name.toLowerCase() === accountRef)
  if (accountRef && matches.length !== 1) throw new Error('Bank account not found or ambiguous: ' + accountRef)
  const propertyRef = opts.property || opts.propertyId
  const property = propertyRef ? resolveLunaProperty(portfolio, String(propertyRef)) : null
  const query = (raw, op, comparator = 'eq') => raw == null || raw === '' ? '' : '&' + op + '=' + comparator + '.' + encodeURIComponent(raw)
  const params = 'bank_transactions?user_id=eq.' + encodeURIComponent(user.id)
    + '&select=id,account_id,booked_at,value_at,amount,currency,description,counterparty,status,category,is_transfer,category_overridden,property_id,performance_treatment,exclude_from_performance,source_type'
    + '&order=booked_at.desc&limit=' + opts.limit
    + query(matches?.[0]?.id, 'account_id')
    + query(property?.id, 'property_id')
    + query(opts.category, 'category')
    + query(opts.from, 'booked_at', 'gte')
    + query(opts.to, 'booked_at', 'lte')
  const rows = await supabaseFetch(env, authorization, params)
  const names = new Map(accounts.map((item) => [item.id, item.name]))
  const mapped = (rows || []).map((item) => mapStoredBankTransaction(item, names))
  const term = String(opts.query || '').trim().toLowerCase()
  const filtered = term ? mapped.filter((item) => [item.description, item.counterparty, item.category]
    .some((value) => String(value).toLowerCase().includes(term))) : mapped
  return {
    count: filtered.length, items: filtered,
    cappedAt: opts.limit, mayHaveMore: (rows || []).length >= opts.limit,
    note: term
      ? 'Text search filters the most recent bounded set; older matches may exist. Dates/bank/property/category filters are applied at source.'
      : 'Cached bank transactions; may include imported bank statements. Consult sourceType and bookedAt for provenance.',
  }
}

const OPENAI_ROOT = 'https://api.openai.com/v1'
const OPENAI_RUNTIME_DIAGNOSIS = {
  missingKey: 'missing_openai_key',
  ready: 'runtime_ready',
}
const OPENAI_FAILURE_CODES = {
  authentication: 'openai_authentication_failure',
  model: 'openai_model_failure',
  rateLimit: 'openai_rate_limited',
  network: 'openai_network_failure',
  upstream: 'openai_upstream_failure',
  api: 'openai_api_failure',
}

export const LUNA_HISTORY_MESSAGE_LIMIT = 16
export const LUNA_HISTORY_CHARACTER_LIMIT = 32000
export const LUNA_HISTORY_PER_MESSAGE_LIMIT = 3000

const plainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const sanitizeConversationHistory = (history, characterLimit = LUNA_HISTORY_CHARACTER_LIMIT) => {
  if (!Array.isArray(history)) return []
  const newest = []
  let characters = 0
  const maximumCharacters = Math.max(0, Math.min(LUNA_HISTORY_CHARACTER_LIMIT, characterLimit))

  for (let index = history.length - 1; index >= 0 && newest.length < LUNA_HISTORY_MESSAGE_LIMIT; index -= 1) {
    const item = history[index]
    if (!plainObject(item) || item.persist === false || (item.role !== 'user' && item.role !== 'assistant')) continue
    const text = typeof item.text === 'string' ? item.text : item.content
    if (typeof text !== 'string' || !text.trim() || text.length > LUNA_HISTORY_PER_MESSAGE_LIMIT) continue
    if (characters + text.length > maximumCharacters) break
    newest.push({ role: item.role, content: text })
    characters += text.length
  }

  return newest.reverse()
}

export const buildConversationInput = (history, message) => {
  const sanitized = sanitizeConversationHistory(history)
  const last = sanitized[sanitized.length - 1]
  if (last?.role === 'user' && last.content === message) sanitized.pop()
  const input = sanitizeConversationHistory(sanitized, LUNA_HISTORY_CHARACTER_LIMIT - message.length)
  input.push({ role: 'user', content: message })
  return input
}

const sanitizedOpenAIError = (code, status) => {
  const error = new Error('Luna could not complete this request.')
  error.code = code
  error.status = status
  return error
}

const classifyOpenAIResponseError = async (response) => {
  if (response.status === 401 || response.status === 403) {
    return sanitizedOpenAIError(OPENAI_FAILURE_CODES.authentication, response.status)
  }
  if (response.status === 429) {
    return sanitizedOpenAIError(OPENAI_FAILURE_CODES.rateLimit, response.status)
  }
  if (response.status >= 500) {
    return sanitizedOpenAIError(OPENAI_FAILURE_CODES.upstream, response.status)
  }
  if (response.status === 404) {
    return sanitizedOpenAIError(OPENAI_FAILURE_CODES.model, response.status)
  }

  const payload = await response.json().catch(() => ({}))
  const upstreamError = payload?.error && typeof payload.error === 'object' ? payload.error : {}
  const upstreamCode = String(upstreamError.code || '').toLowerCase()
  const upstreamParam = String(upstreamError.param || '').toLowerCase()
  if (upstreamParam === 'model' || ['invalid_model', 'model_not_found', 'unsupported_model'].includes(upstreamCode)) {
    return sanitizedOpenAIError(OPENAI_FAILURE_CODES.model, response.status)
  }
  return sanitizedOpenAIError(OPENAI_FAILURE_CODES.api, response.status)
}

const portfolioTool = {
  type: 'function',
  name: 'portfolio_action',
  description: [
    'Read or change the authenticated user’s BTL Portfolio using one supported semantic operation.',
    'Use names/addresses when IDs are unknown; the server resolves unambiguous targets.',
    'For a property rent or other direct property field use property.get. For complete linked property context use property.context.',
    'For portfolio-wide or selected BTL financial calculations use portfolio.financial_summary, with data.properties as an array of names/IDs for a subset.',
    'For portfolio projections use portfolio.projection with optional months and milestones; never invent financial calculations.',
    'For expenses and receipt metadata search use expense.filtered with property, category, date and query filters; for generated property history use timeline.view. For targeted cross-domain records use portfolio.context with data.collections (up to four): properties, loans, tenants, expenses, contractors, contractorTags, propertyTimelineEvents, performanceEvents, acquisitionScenarios, remortgageComparisons, companyCosts, extractions, notificationPreferences. It excludes credentials and external banking tables.',
    'For multiple linked writes in one transaction use portfolio.batch with data.actions array, each containing operation, target and data. Never run a partially successful batch.',
    'For bank balances and transactions use bank.accounts, bank.summary, or bank.transactions. Bank data is stored separately from portfolio JSON; use data.account or accountId and data.property or propertyId plus optional from, to, category, limit. Results contain cached time-stamped balances and transaction provenance. These operations are read-only.',

    'Property administration keys: factorsProvider, factorsAccountNumber, mortgageNumber, buildingsInsuranceProvider, buildingsInsurancePolicyNumber, buildingsInsuranceInsuredValue, depositScheme, depositRegistrationNumber.',
    'Saved acquisition scenario actions: acquisition.create/update/duplicate/reorder/delete. Scenario fields: name, purchasePrice, expectedMonthlyRent, jurisdiction, ltv, adsRate, legalFees, mortgageFee, mortgageFeeAddedToLoan, sourceUrl, sourceProvider. Reorder uses data.index.',
    'Saved remortgage actions: remortgage.create/update/duplicate/delete/compare. Create with target BTL name and data.name or data.left/right. Scenario side fields: propertyValue, loanAmount, ltv, rate (percent, e.g. 5.66), feeMode, feeValue, addFeeToLoan. Compare uses existing deterministic comparison.',
    'Manual investment cashflow entries: performance_event.create/update/delete with title, type (initial_capital/acquisition_cost/tax/refinance_cash/other), amount and occurredAt YYYY-MM-DD; a BTL target determines property association.',
    'Compliance reminders: notification.list gives actual reminder keys, then notification.dismiss or notification.snooze with reminder key and optional data.days 1-30. Next BTL planning preference fields via next_btl.get/update.',

    'Other property fields use storage field names such as rent, latestValuation, epc, gasExpiry, purchaseDate. Only send requested changes, never rewrite unrelated fields.',
    'Mortgage numbers are stored on the linked loan as well as displayed on the property. For multiple loans update the specific loan.',
    'Use empty string only when explicitly clearing a field. Unknown fields are rejected, not silently ignored.',

    'For loans or mortgages identified by a property, use property.loans with the property reference; do not use loan.get with a property name. It returns every linked loan.',
    'For tenants identified by a property, use property.tenants with the property reference; use tenant.list only when asking about tenants across the portfolio.',
    'For net monthly income, monthly cash flow, or property cash flow, use property.financial_summary so the answer uses the app’s canonical calculation.',
    'Rates are decimals in storage: 4.84% should be sent as 4.84 or 0.0484; the server normalises either.',
    `Supported operations: ${[...LUNA_PHASE_ONE_OPERATIONS, ...LUNA_BANK_READ_OPERATIONS].join(', ')}.`,
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: [...LUNA_PHASE_ONE_OPERATIONS, ...LUNA_BANK_READ_OPERATIONS] },
      target: { type: ['string', 'null'], description: 'Existing entity ID/name/description, or null when not applicable.' },
      data: { type: ['object', 'null'], description: 'Fields required for the operation.' },
    },
    required: ['operation', 'target', 'data'],
    additionalProperties: false,
  },
  strict: false,
}

const uiActionTool = {
  type: 'function',
  name: 'client_ui_action',
  description: [
    'Safely open an allow-listed BTL Portfolio workspace, select one unambiguous real property there, or run the existing acquisition simulator.',
    'Use workspace.open for a clear workspace request, property.open for a property-specific request, and acquisition.simulate for purchase-timing scenarios.',
    'Do not use this tool for casual questions, ambiguous destinations, portfolio writes, arbitrary URLs, DOM access, selectors, or code execution.',
    `Supported operations: ${LUNA_UI_OPERATIONS.join(', ')}.`,
    `Supported workspace IDs: ${LUNA_WORKSPACE_IDS.join(', ')}.`,
    'For property.open, target is the user-provided property name/address/postcode and workspace should be the most relevant property-aware destination.',
    'For acquisition.simulate, use workspace acquisition, target null, and data containing only supplied simulator fields such as purchasePrice.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: LUNA_UI_OPERATIONS },
      workspace: { type: 'string', enum: LUNA_WORKSPACE_IDS },
      target: { type: ['string', 'null'] },
      data: {
        type: ['object', 'null'],
        properties: {
          purchasePrice: { type: 'number' },
          appreciationPercent: { type: 'number' },
          scenarioIndex: { type: 'integer', enum: [0, 1, 2] },
          preserveBuffer: { type: 'boolean' },
          includeExtraction: { type: 'boolean' },
          includeRentGrowth: { type: 'boolean' },
          jurisdiction: { type: 'string', enum: ['scotland', 'england-ni'] },
          ltv: { type: 'number' },
          adsRate: { type: 'number' },
          legalFees: { type: 'number' },
          mortgageFee: { type: 'number' },
          mortgageFeeAddedToLoan: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    required: ['operation', 'workspace', 'target', 'data'],
    additionalProperties: false,
  },
  strict: false,
}

const instructions = [
  'You are Luna inside BTL Portfolio, a private property-portfolio application.',
  'Use portfolio_action whenever the answer depends on the user’s portfolio or whenever the user asks to change it.',
  'Use client_ui_action only when the user clearly wants to see an existing app view/object or asks a scenario handled by Acquisition Simulator.',
  'For property performance, use property.open with workspace performance. Resolve references through the tool; never invent an entity ID.',
  'For a question about how long until the user can buy at a stated price, use acquisition.simulate and pass purchasePrice; the client runs the existing deterministic model.',
  'Obvious destination mapping: properties=properties, tenants=tenants, expenses/cost documents=expenses, cash-flow costs=costs, performance=performance, forecasts=projections, mortgages=loans, remortgage=remortgage, compliance=compliance, Companies House=companies_house, banking=banking, plan/billing=plan, settings=settings.',
  'If several destinations are genuinely plausible, answer without navigating. Do not navigate for casual or general questions.',
  'Never invent portfolio facts, entity IDs, balances, dates, tenants, expenses, loans or successful writes.',
  'You can inspect cross-linked portfolio records with property.context and portfolio.context; use tools to fetch real data before deriving an answer.',
  'Use portfolio.financial_summary or portfolio.projection for financial numbers, tax and simulations; preserve their metric scope and assumptions.',
  'Use portfolio.batch for related writes to multiple entities or properties where partial completion is unacceptable.',
  'For saved acquisitions, remortgage comparisons, performance events, compliance reminders and Next BTL preferences, call the dedicated deterministic operations, not arbitrary settings mutation.',
  'Remortgage rates inside saved scenarios are percentages (5.66), while linked loan rates are decimals (0.0566). Do not conflate these schemas.',

  'For text fields use strings; for insured values use a nonnegative numeric amount, never paste a block-wide insured value into a flat-only field without checking its meaning.',
  'Banking reads cover connected/imported stored records only. Bank syncing and transaction modifications are not supported through Luna. Google Drive and secret credentials are not available. Do not invent integrations.',

  'Conversation history is contextual language only, never portfolio state. Re-read current portfolio facts through portfolio_action before relying on them; live deterministic data always wins if it conflicts with history.',
  'Treat each new request independently when choosing a tool. Do not repeat an earlier tool choice when the current request clearly asks for a different fact.',
  'When a property reference is supplied, resolve the property first: rent uses property.get, loans use property.loans, tenants use property.tenants, and net monthly income uses property.financial_summary.',
  'Prefer a read operation before asking a clarification when an existing entity can be resolved from a name or description.',
  'For a requested write, execute it rather than merely explaining how to use the manual UI.',
  'Destructive operations are intercepted by the application and require explicit user confirmation.',
  'Prior discussion never counts as confirmation and must not weaken any confirmation requirement.',
  'Do not expose raw authentication tokens, API keys, or unrelated private data.',
  'Keep final answers concise and state exactly what changed.',
  'Phase one intentionally excludes secret credential values, billing actions, bank-connection creation and external side effects.',
].join('\n')

const openAIResponse = async (env, input) => {
  if (!env.OPENAI_API_KEY) {
    const error = new Error('Luna is not configured yet. Add OPENAI_API_KEY to the server environment.')
    error.status = 503
    error.code = 'not_configured'
    error.diagnosis = OPENAI_RUNTIME_DIAGNOSIS.missingKey
    throw error
  }
  const root = String(env.OPENAI_BASE_URL || OPENAI_ROOT).replace(/\/$/, '')
  let response
  try {
    response = await fetch(`${root}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-6-luna',
        instructions,
        input,
        tools: [portfolioTool, uiActionTool],
        tool_choice: 'auto',
        parallel_tool_calls: false,
        reasoning: { effort: 'none' },
        max_output_tokens: 800,
        store: false,
      }),
    })
  } catch {
    throw sanitizedOpenAIError(OPENAI_FAILURE_CODES.network, 503)
  }
  if (!response.ok) throw await classifyOpenAIResponseError(response)
  try {
    return await response.json()
  } catch {
    throw sanitizedOpenAIError(OPENAI_FAILURE_CODES.api, 502)
  }
}

const responseText = (response) => {
  for (const item of response?.output || []) {
    if (item.type !== 'message') continue
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text
    }
  }
  return ''
}

const executeConfirmed = async ({ env, authorization, user, confirmation }) => {
  if (confirmation?.name !== 'portfolio_action' || !confirmation.arguments) {
    return json({ error: 'This Luna confirmation is invalid.' }, 400)
  }
  const loaded = await loadPortfolio(env, authorization, user.id)
  const result = executePortfolioAction(loaded.portfolio, confirmation.arguments, { confirmed: true })
  if (!result.mutated) return json({ error: 'The confirmed action did not change the portfolio.' }, 400)
  const saved = await savePortfolio(env, authorization, user.id, result.state, loaded.updatedAt)
  return json({ message: result.result?.message || 'Done.', changed: true, portfolio: saved.portfolio, updatedAt: saved.updatedAt })
}

export async function onRequestGet({ request, env }) {
  return json({
    configured: Boolean(env.OPENAI_API_KEY),
    model: env.OPENAI_MODEL || 'gpt-6-luna',
    phaseOneOperations: LUNA_PHASE_ONE_OPERATIONS.length,
    diagnostics: {
      requestHost: request?.url ? new URL(request.url).host : null,
      cloudflarePages: {
        present: Boolean(env.CF_PAGES),
        branch: env.CF_PAGES_BRANCH || null,
        url: env.CF_PAGES_URL || null,
        commitSha: env.CF_PAGES_COMMIT_SHA || null,
      },
      openAIEnvironment: {
        apiKeyPresent: Boolean(env.OPENAI_API_KEY),
        modelPresent: Boolean(env.OPENAI_MODEL),
        baseUrlPresent: Boolean(env.OPENAI_BASE_URL),
        diagnosis: env.OPENAI_API_KEY ? OPENAI_RUNTIME_DIAGNOSIS.ready : OPENAI_RUNTIME_DIAGNOSIS.missingKey,
      },
    },
  })
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await authenticateUser(request, env)
    if (!user) return json({ error: 'Your session could not be verified.' }, 401)
    const authorization = request.headers.get('authorization')
    const body = await request.json().catch(() => ({}))

    if (body.confirmation) return executeConfirmed({ env, authorization, user, confirmation: body.confirmation })

    const message = String(body.message || '').trim()
    if (!message || message.length > 3000) return json({ error: 'Enter a short request for Luna.' }, 400)

    const loaded = await loadPortfolio(env, authorization, user.id)
    let portfolio = loaded.portfolio
    let revision = loaded.updatedAt
    let changed = false
    const uiActions = []
    let chatActions = []
    const input = buildConversationInput(body.history, message)
    const deterministicAnswer = answerDeterministicPortfolioQuestion(portfolio, message)
    if (deterministicAnswer) {
      return json({
        message: deterministicAnswer.message,
        changed: false,
        portfolio: null,
        uiActions: [],
        chatActions: deterministicAnswer.chatActions,
      })
    }

    for (let step = 0; step < 8; step += 1) {
      const response = await openAIResponse(env, input)
      const outputs = Array.isArray(response.output) ? response.output : []
      input.push(...outputs)
      const calls = outputs.filter((item) => item.type === 'function_call')

      if (!calls.length) {
        const messageText = responseText(response)
        if (!messageText) throw new Error('Luna returned no answer.')
        return json({ message: messageText, changed, portfolio: changed ? portfolio : null, updatedAt: changed ? revision : null, uiActions, chatActions })
      }

      for (const call of calls) {
        let args
        try {
          args = JSON.parse(call.arguments || '{}')
        } catch {
          throw new Error('Luna returned invalid tool arguments.')
        }

        if (call.name === 'client_ui_action') {
          const result = executeLunaUiOperation(portfolio, args)
          uiActions.push(...result.actions)
          input.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({ ok: true, message: result.message, property: result.property || null }),
          })
          continue
        }
        if (call.name !== 'portfolio_action') throw new Error(`Luna requested unsupported tool: ${call.name}`)

        if (LUNA_BANK_READ_OPERATIONS.includes(args.operation)) {
          const bankResult = await readBankRecords(env, authorization, user, portfolio, args)
          input.push({
            type: 'function_call_output', call_id: call.call_id,
            output: JSON.stringify({ ok: true, result: bankResult }),
          })
          continue
        }
        const result = executePortfolioAction(portfolio, args)
        if (!result.mutated && !result.confirmationRequired) {
          chatActions = mergeLunaChatActions(
            chatActions,
            chatActionsForPortfolioResult(portfolio, args, result.result),
          )
        }
        if (result.confirmationRequired) {
          return json({
            message: result.confirmationPrompt,
            changed,
            portfolio: changed ? portfolio : null,
            uiActions,
            chatActions,
            confirmation: { name: call.name, arguments: args },
            updatedAt: changed ? revision : null,
          })
        }

        if (result.mutated) {
          const saved = await savePortfolio(env, authorization, user.id, result.state, revision)
          portfolio = saved.portfolio
          revision = saved.updatedAt
          if (result.result?.changes) {
            const persisted = (portfolio.properties || []).find((item) => item.id === result.result.entity?.id)
            if (!persisted || Object.entries(result.result.changes).some(([key, value]) => JSON.stringify(persisted[key]) !== JSON.stringify(value))) {
              throw new Error('Portfolio write was not verified. Reload the property before continuing.')
            }
          }
          changed = true
        }

        input.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result.result),
        })
      }
    }

    return json({ error: 'Luna reached the action limit for one request. Split the request into smaller steps.' }, 409)
  } catch (error) {
    return json(
      { error: error.message || 'Luna is temporarily unavailable.', code: error.code, diagnosis: error.diagnosis },
      error.status >= 400 && error.status < 600 ? error.status : 500,
    )
  }
}
