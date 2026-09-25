import { describe, expect, it } from 'vitest'
import { onRequestGet } from './luna.js'

describe('Luna GET runtime diagnostics', () => {
  it('returns allowlisted deployment metadata and OpenAI variable presence without exposing secrets', async () => {
    const apiKey = 'sentinel-openai-api-key-never-return'
    const response = await onRequestGet({
      request: new Request('https://preview.example.test/api/luna'),
      env: {
        OPENAI_API_KEY: apiKey,
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
        },
      },
    })
    expect(serialized).not.toContain(apiKey)
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
        },
      },
    })
  })
})
