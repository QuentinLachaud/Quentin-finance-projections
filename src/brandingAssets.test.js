import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')

const requiredPublicAssets = [
  '../public/favicon.ico',
  '../public/favicon-16x16.png',
  '../public/favicon-32x32.png',
  '../public/apple-touch-icon.png',
  '../public/android-chrome-192x192.png',
  '../public/android-chrome-512x512.png',
  '../public/site.webmanifest',
  '../public/open-graph-1200x630.png',
  '../public/brand/btlportfolio-logo-horizontal-1024w.png',
  '../public/brand/btlportfolio-logo-horizontal-on-dark-1024w.png',
]

describe('BTL Portfolio supplied branding assets', () => {
  it('installs non-empty browser, PWA, social and wordmark assets', () => {
    for (const relative of requiredPublicAssets) {
      const url = new URL(relative, import.meta.url)
      expect(existsSync(url)).toBe(true)
      expect(statSync(url).size).toBeGreaterThan(100)
    }
  })

  it('links browser/PWA/social assets from the document head', () => {
    const html = read('../index.html')
    expect(html).toContain('href="/favicon.ico"')
    expect(html).toContain('href="/apple-touch-icon.png"')
    expect(html).toContain('href="/site.webmanifest"')
    expect(html).toContain('content="https://btlportfolio.co.uk/open-graph-1200x630.png"')
    expect(html).toContain('<title>BTL Portfolio</title>')
  })

  it('uses supplied light/dark wordmarks in app and authentication branding', () => {
    const brand = read('./BrandLogo.jsx')
    const app = read('./App.jsx')
    const auth = read('./AuthScreen.jsx')
    expect(brand).toContain('/brand/btlportfolio-logo-horizontal-1024w.png')
    expect(brand).toContain('/brand/btlportfolio-logo-horizontal-on-dark-1024w.png')
    expect(app).toContain('<BrandLogo surface="dark" className="sidebar-brand-wordmark" />')
    expect(auth).toContain('<BrandLogo surface="dark" />')
  })

  it('updates browser chrome theme colour when the app theme changes', () => {
    const app = read('./App.jsx')
    expect(app).toContain("document.querySelector('meta[name=\"theme-color\"]')")
    expect(app).toContain("theme === 'dark' ? '#091A1E' : '#f5f7f4'")
  })
})
