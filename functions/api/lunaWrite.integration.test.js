import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './luna.js'

const call = (operation, target, data) => ({
  output: [{ type: 'function_call', name: 'portfolio_action', call_id: 'call-1', arguments: JSON.stringify({ operation, target, data }) }],
})
const answer = (value) => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: value }] }] })
const property = {
  id: 'p1', name: 'BTL1', address: '130 Kelvinhaugh Street', active: true,
  rent: 1500, factorsAccountNumber: '', depositScheme: 'SafeDeposits Scotland', depositRegistrationNumber: '',
}
const base = () => ({
  properties: [structuredClone(property)],
  loans: [], tenants: [], propertyTimelineEvents: [], settings: {},
})
const run = async (fetchImpl, message = 'Update BTL1') => {
  vi.stubGlobal('fetch', fetchImpl)
  const response = await onRequestPost({
    request: new Request('https://portfolio.test/api/luna', {
      method: 'POST',
      headers: { authorization: 'Bearer signed-in-user', 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    }),
    env: { SUPABASE_URL: 'https://supabase.test', SUPABASE_PUBLISHABLE_KEY: 'public', OPENAI_API_KEY: 'server-only' },
  })
  return { status: response.status, body: await response.json() }
}

afterEach(() => vi.unstubAllGlobals())

describe('Luna authenticated writes and concurrent state', () => {
  it('uses a version-checked update, returns saved values and stops duplicate client saves', async () => {
    const calls = []
    let modelCall = 0
    const fetchMock = vi.fn(async (url, options = {}) => {
      const href = String(url)
      calls.push([href, options])
      if (href.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' })
      if (href.includes('/rest/v1/portfolio_states?') && !options.method)
        return Response.json([{ portfolio: base(), updated_at: '2026-10-10T10:00:00.000Z' }])
      if (href.includes('/rest/v1/portfolio_states?') && options.method === 'PATCH') {
        const sent = JSON.parse(options.body)
        return Response.json([{ portfolio: sent.portfolio, updated_at: '2026-10-10T10:01:00.000Z' }])
      }
      if (href.endsWith('/responses')) return Response.json(modelCall++ === 0
        ? call('property.update', 'BTL1', { factorsAccountNumber: '99530067' })
        : answer('Updated factors account 99530067.'))
      throw new Error('Unexpected upstream request: ' + href)
    })
    const { status, body } = await run(fetchMock)
    expect(status).toBe(200)
    expect(body.changed).toBe(true)
    expect(body.updatedAt).toBe('2026-10-10T10:01:00.000Z')
    expect(body.portfolio.properties[0].factorsAccountNumber).toBe('99530067')
    const patch = calls.find(([, options]) => options.method === 'PATCH')
    expect(patch[0]).toContain('updated_at=eq.')
    expect(patch[1].headers.prefer).toBe('return=representation')
    expect(JSON.parse(patch[1].body).portfolio.properties[0].rent).toBe(1500)
  })

  it('fails safely if the portfolio changed since Luna read it', async () => {
    let modelCall = 0
    const fetchMock = vi.fn(async (url, options = {}) => {
      const href = String(url)
      if (href.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' })
      if (href.includes('/rest/v1/portfolio_states?') && !options.method)
        return Response.json([{ portfolio: base(), updated_at: '2026-10-10T10:00:00.000Z' }])
      if (href.includes('/rest/v1/portfolio_states?') && options.method === 'PATCH') return Response.json([])
      if (href.endsWith('/responses')) {
        modelCall++
        return Response.json(call('property.update', 'BTL1', { factorsAccountNumber: '99530067' }))
      }
      throw new Error('Unexpected request')
    })
    const { status, body } = await run(fetchMock)
    expect(status).toBe(409)
    expect(body.error).toMatch(/another tab or device/)
    expect(modelCall).toBe(1)
  })

  it('saves a multi-property batch only once and does not save if a nested step is invalid', async () => {
    const operations = [
      { operation: 'property.update', target: 'BTL1', data: { factorsAccountNumber: '99530067' } },
      { operation: 'property.update', target: 'MISSING', data: { depositRegistrationNumber: 'DPC421785' } },
    ]
    let writes = 0
    const fetchMock = vi.fn(async (url, options = {}) => {
      const href = String(url)
      if (href.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' })
      if (href.includes('/rest/v1/portfolio_states?') && !options.method)
        return Response.json([{ portfolio: base(), updated_at: '2026-10-10T10:00:00.000Z' }])
      if (href.includes('/rest/v1/portfolio_states?') && options.method) { writes++; return Response.json([]) }
      if (href.endsWith('/responses')) return Response.json(call('portfolio.batch', null, { actions: operations }))
      throw new Error('Unexpected request')
    })
    const { status, body } = await run(fetchMock)
    expect(status).toBe(500)
    expect(body.error).toMatch(/not found or ambiguous/)
    expect(writes).toBe(0)
  })
})
