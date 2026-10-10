import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import BrandLoadingScreen from './BrandLoadingScreen.jsx'

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')

describe('single mobile portfolio boot animation', () => {
  it('shows only the approved vertical mark and wordmark, without a second loading message', () => {
    const markup = renderToStaticMarkup(<BrandLoadingScreen />)
    expect(markup).toContain('role="status"')
    expect(markup).toContain('viewBox="0 0 840 445"')
    expect(markup).toContain('brand-loader-house')
    expect(markup).toContain('brand-loader-bar one')
    expect(markup).toContain('brand-loader-bar two')
    expect(markup).toContain('brand-loader-bar three')
    expect(markup).toContain('brand-loader-wordmark')
    expect(markup).not.toContain('Loading your private portfolio')
    expect(markup).not.toContain('Checking your session')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('<image')
  })

  it('finishes the house and all three bars before fading in stationary text', () => {
    const css = read('./BrandLoadingScreen.css')
    expect(css).toContain('34%, 100% { opacity: 1; stroke-dashoffset: 0; }')
    expect(css).toContain('50%, 100% { opacity: 1; transform: none; }')
    expect(css).toContain('0%, 57% { opacity: 0; }')
    expect(css).toContain('73%, 100% { opacity: 1; }')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).not.toMatch(/\.brand-loader-wordmark\s*\{[^}]*translate/s)
  })

  it('keeps one loader mounted across authentication and hydration, with errors still visible', () => {
    const app = read('./App.jsx')
    expect(app).toContain('import BrandLoadingScreen from')
    expect(app).toContain('if (!state) return null')
    expect(app).toContain('if (isPortfolioReady) onReady(user.id)')
    expect(app).toContain('portfolioReadyUserId !== session.user.id')
    expect(app).toContain('<BrandLoadingScreen />')
    expect(app).toContain('if (session === null) return <AuthScreen />')
    expect(app).toContain('We couldn’t load your portfolio')
    expect(app).not.toContain('Loading your private portfolio…')
    expect(app).not.toContain('Checking your session…')
  })
})
