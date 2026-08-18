import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestDelete, onRequestGet, onRequestPost } from './banking.js'

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable',
  GOCARDLESS_SECRET_ID: 'secret-id',
  GOCARDLESS_SECRET_KEY: 'secret-key',
}

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const authenticatedRequest = (url, body) => new Request(url, {
  method: body ? 'POST' : 'GET',
  headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
})

describe('banking Pages Function', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('rejects unauthenticated requests before contacting GoCardless', async () => {
    fetch.mockResolvedValueOnce(response({}, 401))
    const result = await onRequestGet({ request: new Request('https://app.test/api/banking?action=institutions'), env })
    expect(result.status).toBe(401)
    expect(fetch).toHaveBeenCalledTimes(0)
  })

  it('returns a safe setup state when server credentials are missing', async () => {
    fetch.mockResolvedValueOnce(response({ id: 'user-1' }))
    const result = await onRequestGet({ request: authenticatedRequest('https://app.test/api/banking?action=institutions'), env: { ...env, GOCARDLESS_SECRET_ID: '' } })
    expect(result.status).toBe(503)
    expect(await result.json()).toMatchObject({ code: 'not_configured' })
  })

  it('sorts preferred UK institutions first without hard-coding institution IDs', async () => {
    fetch
      .mockResolvedValueOnce(response({ id: 'user-1' }))
      .mockResolvedValueOnce(response({ access: 'gc-access', access_expires: 3600 }))
      .mockResolvedValueOnce(response([
        { id: 'OTHER', name: 'Another Bank', transaction_total_days: '90' },
        { id: 'MONZO_DYNAMIC_ID', name: 'Monzo Bank', transaction_total_days: '730', max_access_valid_for_days: '90' },
      ]))
    const result = await onRequestGet({ request: authenticatedRequest('https://app.test/api/banking?action=institutions'), env })
    expect(result.status).toBe(200)
    expect((await result.json()).institutions.map((bank) => bank.id)).toEqual(['MONZO_DYNAMIC_ID', 'OTHER'])
  })

  it('creates a consent link with capped history and access periods and persists only user-scoped metadata', async () => {
    fetch
      .mockResolvedValueOnce(response({ id: 'user-1' }))
      .mockResolvedValueOnce(response([
        { id: 'TIDE_DYNAMIC', name: 'Tide', transaction_total_days: '1000', max_access_valid_for_days: '120' },
      ]))
      .mockResolvedValueOnce(response({ id: 'agreement-1' }))
      .mockResolvedValueOnce(response({ id: 'req-1', status: 'CR', link: 'https://ob.gocardless.test/consent' }))
      .mockResolvedValueOnce(response([{ id: 'connection-1' }], 201))
    const result = await onRequestPost({
      request: authenticatedRequest('https://app.test/api/banking', { action: 'connect', institutionId: 'TIDE_DYNAMIC' }), env,
    })
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ link: 'https://ob.gocardless.test/consent' })
    const agreementCall = fetch.mock.calls.find(([url]) => String(url).includes('/agreements/enduser/'))
    expect(JSON.parse(agreementCall[1].body)).toMatchObject({ max_historical_days: 730, access_valid_for_days: 90 })
    const storedCall = fetch.mock.calls.find(([url]) => String(url).includes('/rest/v1/bank_connections'))
    const stored = JSON.parse(storedCall[1].body)[0]
    expect(stored).toMatchObject({ user_id: 'user-1', requisition_id: 'req-1', institution_id: 'TIDE_DYNAMIC' })
    expect(stored).not.toHaveProperty('secret_key')
  })
})

describe('banking API boundary audit', () => {
  it('rejects unknown GET actions after authentication without contacting GoCardless', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ id: 'user-1' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await onRequestGet({
      request: authenticatedRequest('https://app.test/api/banking?action=unknown'),
      env,
    })
    expect(result.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects unknown POST actions after authentication without contacting GoCardless', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ id: 'user-1' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await onRequestPost({
      request: authenticatedRequest('https://app.test/api/banking', { action: 'unknown' }),
      env,
    })
    expect(result.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns 404 for a sync request referencing a connection the user cannot access', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ id: 'user-1' }))
      .mockResolvedValueOnce(response([]))
    vi.stubGlobal('fetch', fetchMock)
    const result = await onRequestPost({
      request: authenticatedRequest('https://app.test/api/banking', { action: 'sync', connectionId: 'missing' }),
      env,
    })
    expect(result.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects unauthenticated disconnect attempts before any upstream request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await onRequestDelete({
      request: new Request('https://app.test/api/banking?connection=one', { method: 'DELETE' }),
      env,
    })
    expect(result.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
