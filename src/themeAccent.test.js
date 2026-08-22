import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')
const appSource = read('./App.jsx')
const mainSource = read('./main.jsx')
const stylesSource = read('./styles.css')
const themeSource = read('./theme.css')
const remortgageSource = read('./RemortgageSimulator.jsx')
const inventorySource = read('../docs/theme-colour-inventory.md')

describe('appearance settings integration', () => {
  it('places an accessible settings control immediately before sign out', () => {
    const settingsIndex = appSource.indexOf('className="sidebar-settings"')
    const signOutIndex = appSource.indexOf('className="sidebar-signout"')

    expect(settingsIndex).toBeGreaterThan(-1)
    expect(signOutIndex).toBeGreaterThan(settingsIndex)
    expect(appSource.slice(settingsIndex, signOutIndex)).toContain('aria-label="Open settings"')
    expect(appSource).toContain('role="dialog"')
    expect(appSource).toContain('role="radiogroup"')
    expect(appSource).toContain('aria-checked={selected}')
  })

  it('applies and persists the selected accent with a per-user storage key', () => {
    expect(appSource).toContain('const accentKey = accentStorageKey(user.id)')
    expect(appSource).toContain('document.documentElement.dataset.accent = accentHue')
    expect(appSource).toContain('window.localStorage.setItem(accentKey, accentHue)')
  })

  it('loads the authoritative theme layer after the base stylesheet', () => {
    const baseIndex = mainSource.indexOf("import './styles.css'")
    const themeIndex = mainSource.indexOf("import './theme.css'")
    expect(baseIndex).toBeGreaterThan(-1)
    expect(themeIndex).toBeGreaterThan(baseIndex)
    expect(stylesSource).not.toContain('Brain Drain 2026-08-22 14:53 BST — user accent settings')
  })

  it.each(['forest', 'teal', 'ocean', 'indigo', 'amber', 'monochrome'])('defines a %s palette', (accent) => {
    expect(themeSource).toContain(`[data-accent='${accent}']`)
  })

  it('themes environment, surfaces, navigation and non-semantic bars', () => {
    for (const token of [
      '--theme-canvas',
      '--theme-surface',
      '--theme-sidebar',
      '--theme-sidebar-active',
      '--theme-accent-soft',
      '--theme-bar-strong',
      '--theme-bar-soft',
    ]) {
      expect(themeSource).toContain(token)
    }

    for (const selector of [
      '.topbar',
      '.sidebar',
      '.panel',
      '.property-card',
      '.metric-card',
      '.asset-value-bar',
      '.asset-loan-bar',
      '.equity-bar i',
      '.advanced-metric-label',
    ]) {
      expect(themeSource).toContain(selector)
    }
  })

  it('keeps financial sign colours semantic and independent from accent hue', () => {
    expect(themeSource).toContain('--semantic-positive: #27795c')
    expect(themeSource).toContain('--semantic-negative: #b54b41')
    expect(themeSource).toContain('--green: var(--semantic-positive)')
    expect(themeSource).not.toMatch(/--green:\s*var\(--theme-accent/)
    expect(themeSource).toContain('.data-table td.money-positive')
    expect(themeSource).toContain('.data-table td.money-negative')
    expect(themeSource).toContain('.remortgage-scenario-cashflow-metric > b.positive')
    expect(themeSource).toContain('.remortgage-scenario-cashflow-metric > b.negative')
  })

  it('marks absolute remortgage cash-flow figures by sign instead of theme accent', () => {
    expect(remortgageSource).toContain("className={animatedCashFlow >= 0 ? 'positive' : 'negative'}")
    expect(remortgageSource).toContain("className={animatedLeftCashFlow >= 0 ? 'positive' : 'negative'}")
    expect(remortgageSource).toContain("className={animatedRightCashFlow >= 0 ? 'positive' : 'negative'}")
  })

  it('does not hijack remortgage rate orange, scenario colours or buffer colours', () => {
    expect(stylesSource).toContain('--remortgage-rate-accent: #bd5a1d')
    expect(stylesSource).toContain('var(--remortgage-rate-accent)')
    expect(themeSource).not.toContain('--remortgage-rate-accent:')
    expect(themeSource).not.toContain('--scenario:')
    expect(themeSource).not.toContain('--buffer-colour:')
  })

  it('keeps the Monochrome environment deliberately neutral while preserving semantic colours', () => {
    expect(themeSource).toContain(":root[data-accent='monochrome']:not([data-theme='dark'])")
    expect(themeSource).toContain(":root[data-theme='dark'][data-accent='monochrome']")
    expect(themeSource).toContain('--theme-canvas: #f3f3f2')
    expect(themeSource).toContain('--theme-sidebar: #151617')
    expect(themeSource).toContain('--theme-canvas: #0f1011')
    expect(themeSource).toContain('--theme-sidebar: #0b0c0d')
    expect(themeSource).toContain('--semantic-positive: #27795c')
    expect(themeSource).toContain('--semantic-negative: #b54b41')
  })

  it('maintains a detailed colour-bearing component inventory', () => {
    expect(inventorySource).toContain('# BTL Portfolio colour inventory')
    expect(inventorySource).toContain('## Curated component policy')
    expect(inventorySource).toContain('## Fixed semantic colour contract')
    expect(inventorySource).toContain('## Automatically captured colour-bearing selectors')
    expect(inventorySource).toContain('.asset-loan-bar')
    expect(inventorySource).toContain('.property-card')
    expect(inventorySource).toContain('.positive')
  })
})
