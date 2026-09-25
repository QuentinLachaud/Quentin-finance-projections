import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet, onRequestPost } from './luna.js'

const SENTINEL_API_KEY = 'sentinel-openai-api-key-never-return'

const authenticatedRequest = () => new Request('https://preview.example.test/api/luna', {
  method: 'POST',
  headers: { authorization: 'Bearer test-session-token', 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'Summarise my portfolio.' }),
})

const lunaEnv = (overrides = {}) => ({
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  OPENAI_API_KEY: SENTINEL_API_KEY,
  ...overrides,
})

const upstreamFetchMock = (upstreamResult) => vi.fn(async (url) => {
  const href = String(url)
  if (href.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
  if (href.includes('/rest/v1/portfolio_states?')) {
    return new Response(JSON.stringify([{ portfolio: { properties: [], settings: {} } }]), { status: 200 })
  }
  if (href.endsWith('/responses')) {
    if (upstreamResult instanceof Error) throw upstreamResult
    return upstreamResult
  }
  throw new Error(`Unexpected request: ${href}`)
})

afterEach(() => vi.unstubAllGlobals())

describe('Luna GET runtime diagnostics', () => {
  it('returns allowlisted deployment metadata and OpenAI variable presence without exposing secrets', async () => {
    const response = await onRequestGet({
      request: new Request('https://preview.example.test/api/luna'),
      env: {
        OPENAI_API_KEY: SENTINEL_API_KEY,
        OPENAI_MODEL: 'gpt-6-luna',
        OPENAI_BASE_URL: 'https://openai-proxy.example.test/v1',
        CF_PAGES: '1',
        CF_PAGES_BRANCH: 'diagnostics',
        CF_PAGES_URL: 'https://diagnostics.btl-portfolio.pages.dev',
        CF_PAGES_COMMIT_SHA: 'abc123',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')

    const serialized = await response.text()
    const body = JSON.parse(serialized)
    expect(body).toMatchObject({
      configured: true,
      model: 'gpt-6-luna',
      phaseOneOperations: expect.any(Number),
      diagnostics: {
        requestHost: 'preview.example.test',
        cloudflarePages: {
          present: true,
          branch: 'diagnostics',
          url: 'https://diagnostics.btl-portfolio.pages.dev',
          commitSha: 'abc123',
        },
        openAIEnvironment: {
          apiKeyPresent: true,
          modelPresent: true,
          baseUrlPresent: true,
          diagnosis: 'runtime_ready',
        },
      },
    })
    expect(serialized).not.toContain(SENTINEL_API_KEY)
  })

  it('returns false and null diagnostics when optional runtime fields are unavailable', async () => {
    const response = await onRequestGet({
      request: new Request('http://localhost:8788/api/luna'),
      env: {},
    })

    expect(await response.json()).toMatchObject({
      configured: false,
      model: 'gpt-6-luna',
      phaseOneOperations: expect.any(Number),
      diagnostics: {
        requestHost: 'localhost:8788',
        cloudflarePages: {
          present: false,
          branch: null,
          url: null,
          commitSha: null,
        },
        openAIEnvironment: {
          apiKeyPresent: false,
          modelPresent: false,
          baseUrlPresent: false,
          diagnosis: 'missing_openai_key',
        },
      },
    })
  })
})

describe('Luna OpenAI failure diagnostics', () => {
  it.each([
    ['authentication failure', 401, { error: { message: `Invalid ${SENTINEL_API_KEY}` } }, 'openai_authentication_failure'],
    ['authorization failure', 403, { error: { message: `Forbidden ${SENTINEL_API_KEY}` } }, 'openai_authentication_failure'],
    ['model not found', 404, { error: { code: 'model_not_found', message: `Missing ${SENTINEL_API_KEY}` } }, 'openai_model_failure'],
    ['invalid model', 400, { error: { code: 'invalid_model', param: 'model', message: `Invalid ${SENTINEL_API_KEY}` } }, 'openai_model_failure'],
    ['rate limiting', 429, { error: { message: `Limited ${SENTINEL_API_KEY}` } }, 'openai_rate_limited'],
    ['upstream failure', 502, { error: { message: `Bad gateway ${SENTINEL_API_KEY}` } }, 'openai_upstream_failure'],
    ['other API failure', 400, { error: { message: `Bad request ${SENTINEL_API_KEY}` } }, 'openai_api_failure'],
  ])('returns a sanitized code for %s', async (_name, status, payload, code) => {
    vi.stubGlobal('fetch', upstreamFetchMock(new Response(JSON.stringify(payload), { status })))

    const response = await onRequestPost({ request: authenticatedRequest(), env: lunaEnv() })
    const serialized = await response.text()

    expect(response.status).toBe(status)
    expect(JSON.parse(serialized)).toEqual({
      error: 'Luna could not complete this request.',
      code,
    })
    expect(serialized).not.toContain(SENTINEL_API_KEY)
  })

  it('returns a sanitized code for network and timeout failures', async () => {
    vi.stubGlobal('fetch', upstreamFetchMock(new Error(`Timed out with ${SENTINEL_API_KEY}`)))

    const response = await onRequestPost({ request: authenticatedRequest(), env: lunaEnv() })
    const serialized = await response.text()

    expect(response.status).toBe(503)
    expect(JSON.parse(serialized)).toEqual({
      error: 'Luna could not complete this request.',
      code: 'openai_network_failure',
    })
    expect(serialized).not.toContain(SENTINEL_API_KEY)
  })

  it('keeps not_configured while identifying the missing runtime key', async () => {
    vi.stubGlobal('fetch', upstreamFetchMock(new Error('OpenAI should not be called')))

    const response = await onRequestPost({
      request: authenticatedRequest(),
      env: lunaEnv({ OPENAI_API_KEY: '' }),
    })
    const serialized = await response.text()

    expect(response.status).toBe(503)
    expect(JSON.parse(serialized)).toEqual({
      error: 'Luna is not configured yet. Add OPENAI_API_KEY to the server environment.',
      code: 'not_configured',
      diagnosis: 'missing_openai_key',
    })
    expect(serialized).not.toContain(SENTINEL_API_KEY)
  })
})
