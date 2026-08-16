import { describe, expect, it, vi } from 'vitest'
import { onRequest } from './_middleware.js'

const run = (url) => {
  const next = vi.fn(async () => new Response('ok'))
  return { response: onRequest({ request: new Request(url), next }), next }
}

describe('canonical domain middleware', () => {
  it.each([
    'https://www.btlportfolio.co.uk/projections?range=12m#cashflow',
    'https://quentin-finance-projections.pages.dev/projections?range=12m#cashflow',
  ])('redirects %s to the canonical domain without losing the URL', async (source) => {
    const { response, next } = run(source)
    const result = await response

    expect(result.status).toBe(301)
    expect(result.headers.get('location')).toBe('https://btlportfolio.co.uk/projections?range=12m#cashflow')
    expect(next).not.toHaveBeenCalled()
  })

  it('passes canonical-domain requests through unchanged', async () => {
    const { response, next } = run('https://btlportfolio.co.uk/')

    expect((await response).status).toBe(200)
    expect(next).toHaveBeenCalledOnce()
  })

  it('does not redirect Cloudflare preview deployments', async () => {
    const { response, next } = run('https://preview.quentin-finance-projections.pages.dev/')

    expect((await response).status).toBe(200)
    expect(next).toHaveBeenCalledOnce()
  })
})
