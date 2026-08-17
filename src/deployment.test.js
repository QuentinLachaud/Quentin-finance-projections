import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Cloudflare Pages deployment routing', () => {
  it('runs Pages Functions only for API requests', () => {
    const routes = JSON.parse(readFileSync('public/_routes.json', 'utf8'))
    expect(routes).toEqual({ version: 1, include: ['/api/*'], exclude: [] })
    expect(existsSync('functions/_middleware.js')).toBe(false)
  })

  it('uses Cloudflare Pages default cache behaviour', () => {
    expect(existsSync('public/_headers')).toBe(false)
  })
})
