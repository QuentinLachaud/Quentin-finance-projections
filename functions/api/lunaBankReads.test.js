import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './luna.js'

const property = { id: 'p1', name: 'BTL1', postcode: 'G3 8PP', active: true }
const modelCall = (operation, data = null) => ({
  output: [{
    type: 'function_call', name: 'portfolio_action', call_id: 'bank-read',
    arguments: JSON.stringify({ operation, target: null, data }),
  }],
})
const finalAnswer = () => ({
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'Bank summary obtained from saved banking data.' }] }],
})

const run = async (operation, data) => {
  let modelCount = 0
  const calls = []
  const mock = vi.fn(async (url, options = {}) => {
    const href = String(url)
    calls.push({ href, options })
    if (href.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' })
    if (href.includes('/rest/v1/portfolio_states?')) return Response.json([{
      portfolio: { properties: [property], settings: { cashHeld: 10000 } },
      updated_at: '2026-10-10T11:00:00Z',
    }])
    if (href.includes('/rest/v1/bank_accounts?')) return Response.json([
      { id: 'account-one', display_name: 'Tide', currency: 'GBP', current_balance: 3500, available_balance: 3400, balance_updated_at: '2026-10-09T12:00:00Z', include_in_cash: true },
      { id: 'account-two', display_name: 'Euro', currency: 'EUR', current_balance: 400, balance_updated_at: null, include_in_cash: true },
    ])
    if (href.includes('/rest/v1/bank_transactions?')) return Response.json([{
      id: 'transaction-1', account_id: 'account-one', booked_at: '2026-10-07',
      amount: -120, currency: 'GBP', category: 'repairs', description: 'Plumber', counterparty: 'ABC',
      property_id: 'p1', source_type: 'tide_statement', performance_treatment: 'operating',
    }])
    if (href.endsWith('/responses')) return Response.json(modelCount++ === 0 ? modelCall(operation, data) : finalAnswer())
    throw new Error('Unexpected request ' + href)
  })
  vi.stubGlobal('fetch', mock)
  const res = await onRequestPost({
    request: new Request('https://portfolio.example/api/luna', {
      method: 'POST',
      headers: { authorization: 'Bearer user-access-token', 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Show banking data' }),
    }),
    env: { SUPABASE_URL: 'https://supabase.test', SUPABASE_PUBLISHABLE_KEY: 'public', OPENAI_API_KEY: 'server-secret' },
  })
  return { res, payload: await res.json(), calls }
}

afterEach(() => vi.unstubAllGlobals())

describe('Luna RLS-scoped banking read capabilities', () => {
  it('reads time-stamped bank balances without inventing a mixed-currency total or changing the portfolio', async () => {
    const { res, payload, calls } = await run('bank.summary')
    expect(res.status).toBe(200)
    expect(payload.changed).toBe(false)
    expect(calls.filter((call) => call.href.includes('/rest/v1/bank_accounts'))).toHaveLength(1)
    expect(calls.some((call) => call.options.method === 'PATCH' || call.options.method === 'POST'
      && call.href.includes('/rest/v1/portfolio_states'))).toBe(false)
    const response = calls.find((call) => call.href.endsWith('/responses') && call.options.body.includes('function_call_output'))
    expect(response).toBeTruthy()
    const body = JSON.parse(response.options.body)
    const bankText = body.input.find((item) => item.type === 'function_call_output').output
    expect(bankText).toContain('3500')
    expect(bankText).toContain('EUR')
    expect(bankText).not.toContain('user-access-token')
  })

  it('filters transactions by real property ID, category, dates and account without mutating records', async () => {
    const { res, payload, calls } = await run('bank.transactions', {
      property: 'BTL 1', account: 'Tide', from: '2026-10-01', to: '2026-10-10',
      category: 'repairs', limit: 25, offset: 40,
    })
    expect(res.status).toBe(200)
    expect(payload.changed).toBe(false)
    const url = calls.find((call) => call.href.includes('/rest/v1/bank_transactions')).href
    expect(url).toContain('property_id=eq.p1')
    expect(url).toContain('account_id=eq.account-one')
    expect(url).toContain('booked_at=gte.2026-10-01')
    expect(url).toContain('booked_at=lte.2026-10-10')
    expect(url).toContain('category=eq.repairs')
    expect(url).toContain('offset=40')
  })

  it('rejects banking query options not in its allow-list before accessing account records', async () => {
    const { res, payload, calls } = await run('bank.transactions', { password: 'reveal' })
    expect(res.status).toBe(500)
    expect(payload.error).toMatch(/Unsupported banking query option/)
    expect(calls.some((call) => call.href.includes('/rest/v1/bank_accounts'))).toBe(false)
  })
})
