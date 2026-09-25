import { executePortfolioAction, LUNA_PHASE_ONE_OPERATIONS } from '../../src/lunaCapabilities.js'
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
  return rows?.[0]?.portfolio || { properties: [], settings: {} }
}

const savePortfolio = async (env, authorization, userId, portfolio) => {
  const rows = await supabaseFetch(
    env,
    authorization,
    'portfolio_states?on_conflict=user_id',
    {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: userId, portfolio }),
    },
  )
  return rows?.[0]?.portfolio || portfolio
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
    'For a property rent or other direct property field use property.get.',
    'For loans or mortgages identified by a property, use property.loans with the property reference; do not use loan.get with a property name. It returns every linked loan.',
    'For tenants identified by a property, use property.tenants with the property reference; use tenant.list only when asking about tenants across the portfolio.',
    'For net monthly income, monthly cash flow, or property cash flow, use property.financial_summary so the answer uses the app’s canonical calculation.',
    'Rates are decimals in storage: 4.84% should be sent as 4.84 or 0.0484; the server normalises either.',
    `Supported operations: ${LUNA_PHASE_ONE_OPERATIONS.join(', ')}.`,
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: LUNA_PHASE_ONE_OPERATIONS },
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
  const portfolio = await loadPortfolio(env, authorization, user.id)
  const result = executePortfolioAction(portfolio, confirmation.arguments, { confirmed: true })
  if (!result.mutated) return json({ error: 'The confirmed action did not change the portfolio.' }, 400)
  const saved = await savePortfolio(env, authorization, user.id, result.state)
  return json({ message: result.result?.message || 'Done.', changed: true, portfolio: saved })
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

    let portfolio = await loadPortfolio(env, authorization, user.id)
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
        return json({ message: messageText, changed, portfolio: changed ? portfolio : null, uiActions, chatActions })
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
          })
        }

        if (result.mutated) {
          portfolio = await savePortfolio(env, authorization, user.id, result.state)
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
