import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const stylesSource = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const accentStyleMarker = 'Brain Drain 2026-08-22 14:53 BST — user accent settings'

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

  it.each(['forest', 'teal', 'ocean', 'indigo', 'amber'])('defines a %s palette', (accent) => {
    expect(stylesSource).toContain(`[data-accent='${accent}']`)
  })

  it('provides dark-mode accent overrides without hijacking semantic orange', () => {
    expect(stylesSource).toContain(":root[data-theme='dark'][data-accent]")
    const accentBlock = stylesSource.split(accentStyleMarker)[1] || ''
    expect(accentBlock).not.toMatch(/--orange\s*:/)
    expect(accentBlock).not.toContain('.remortgage-scenario-rate-value')
  })
})
