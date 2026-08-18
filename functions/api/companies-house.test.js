import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from './companies-house.js'

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  COMPANIES_HOUSE_API_KEY: 'companies-house-key',
}

const request = (query = '') => new Request(`https://app.example/api/companies-house${query}`, {
  headers: { authorization: 'Bearer user-token' },
})

afterEach(() => vi.unstubAllGlobals())

describe('Companies House authenticated proxy', () => {
  it('rejects requests without a signed-in user before calling an upstream service', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: new Request('https://app.example/api/companies-house?mode=search&q=test'), env })
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports missing server configuration without exposing credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const response = await onRequestGet({ request: request('?mode=search&q=test'), env: { ...env, COMPANIES_HOUSE_API_KEY: '' } })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Companies House is not configured yet.', code: 'not_configured' })
  })

  it('verifies Supabase then performs an authenticated, bounded company search', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ title: 'QUARK HOLDINGS LTD' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: request('?mode=search&q=Quark%20Holdings'), env })
    const companiesHouseCall = fetchMock.mock.calls[1]

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [{ title: 'QUARK HOLDINGS LTD' }] })
    expect(companiesHouseCall[0]).toContain('/search/companies?q=Quark%20Holdings&items_per_page=8')
    expect(companiesHouseCall[1].headers.authorization).toBe(`Basic ${btoa('companies-house-key:')}`)
  })

  it('sanitises company numbers before fetching the five official resources', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: request('?mode=company&number=sc-12%203'), env })
    const upstreamUrls = fetchMock.mock.calls.slice(1).map(([url]) => url)

    expect(response.status).toBe(200)
    expect(upstreamUrls).toHaveLength(5)
    expect(upstreamUrls.every((url) => url.includes('/company/SC123'))).toBe(true)
  })
})

describe('Companies House boundary audit', () => {
  it('rejects too-short searches without calling Companies House', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: request('?mode=search&q=x'), env })
    expect(response.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats optional company resources returning 404 as absent rather than failing the whole company view', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ company_name: 'TEST LTD' }), { status: 200 }))
      .mockResolvedValue(new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: request('?mode=company&number=SC123456'), env })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.profile).toEqual({ company_name: 'TEST LTD' })
    expect(body).toMatchObject({ filings: null, officers: null, psc: null, charges: null })
  })

  it('maps an upstream Companies House authentication failure to a safe error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestGet({ request: request('?mode=search&q=test'), env })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Companies House API authentication failed.' })
  })
})
