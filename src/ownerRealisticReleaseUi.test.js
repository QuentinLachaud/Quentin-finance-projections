import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeNextBtlPreferences } from './nextBtlPreferences.js'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const simulator = readFileSync(new URL('./AcquisitionSimulator.jsx', import.meta.url), 'utf8')
const planner = readFileSync(new URL('./TimeToNextBtl.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('owner-only realistic equity release UI', () => {
  it('threads the existing owner entitlement rather than a hard-coded email', () => {
    expect(app).toContain('allowRealisticRelease={effectiveEntitlement.isOwner}')
    expect(simulator).toContain('allowRealisticRelease = false')
    expect(simulator).toContain('allowRealisticRelease={allowRealisticRelease}')
    expect(planner).toContain('allowRealisticRelease = false')
    expect(app).not.toContain('quentin.lachaud@gmail.com')
  })

  it('forces Smooth for non-owner and conditionally renders the owner control', () => {
    expect(planner).toContain("allowRealisticRelease && releaseMode === 'realistic' ? 'realistic' : 'smooth'")
    expect(planner).toContain('{allowRealisticRelease && <section className="next-btl-release-mode-owner" aria-label="Owner release timing model">')
    expect(planner).toContain('Smooth')
    expect(planner).toContain('Realistic')
    expect(planner).toContain('Release timing')
  })

  it('persists only a valid release mode preference', () => {
    expect(normalizeNextBtlPreferences({ releaseMode: 'realistic' }).releaseMode).toBe('realistic')
    expect(normalizeNextBtlPreferences({ releaseMode: 'smooth' }).releaseMode).toBe('smooth')
    expect(normalizeNextBtlPreferences({ releaseMode: 'anything' })).not.toHaveProperty('releaseMode')
  })

  it('adds labeled graph events only from realistic result events', () => {
    expect(planner).toContain("result.equityReleaseMode === 'realistic'")
    expect(planner).toContain('next-btl-release-marker')
    expect(planner).toContain('event.propertyName')
    expect(planner).toContain('<title>')
  })

  it('styles the owner timing selector and release markers responsively', () => {
    expect(styles).toContain('owner realistic remortgage-gated equity release')
    expect(styles).toContain('.next-btl-release-mode-owner')
    expect(styles).toContain('.next-btl-release-mode-segmented')
    expect(styles).toContain('.next-btl-release-marker')
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.next-btl-release-mode-segmented/)
  })

  it('makes the selected release timing mode explicit while retaining aria-pressed semantics', () => {
    expect(planner).toContain("aria-pressed={effectiveReleaseMode === 'smooth'}")
    expect(planner).toContain("aria-pressed={effectiveReleaseMode === 'realistic'}")
    const marker = '/* Brain Drain 2026-08-28 13:58 BST — compact equity release controls recovery */'
    const compactStart = styles.indexOf(marker)
    expect(compactStart).toBeGreaterThan(-1)
    const compactStyles = styles.slice(compactStart)
    const selectedModeRule = compactStyles.match(/\.next-btl-release-mode-segmented button\[aria-pressed='true'\]\s*\{[\s\S]*?\}/)?.[0] || ''
    expect(selectedModeRule).toContain('color: #fff;')
    expect(selectedModeRule).toContain('background: var(--accent);')
    expect(compactStyles).toMatch(/\.next-btl-release-mode-segmented button\[aria-pressed='true'\]::before\s*\{[\s\S]*?content:\s*'✓'/)
    expect(compactStyles).toMatch(/\.next-btl-release-mode-segmented button:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--accent\)/)
  })

  it('uses compact desktop timing controls and responsive equity-release mini-cards', () => {
    const marker = '/* Brain Drain 2026-08-28 13:58 BST — compact equity release controls recovery */'
    const compactStart = styles.indexOf(marker)
    expect(compactStart).toBeGreaterThan(-1)
    const compactStyles = styles.slice(compactStart)
    const desktop = compactStyles.match(/@media \(min-width: 761px\)\s*\{[\s\S]*?(?=\n@media \(max-width: 760px\))/)?.[0] || ''
    expect(desktop).toContain("'release-heading release-mode'")
    expect(desktop).toContain("'release-copy release-copy'")
    expect(desktop).toContain('grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));')
    expect(desktop).toContain("'equity-switch equity-name'")
    expect(desktop).toContain("'equity-switch equity-now'")
    expect(desktop).toMatch(/\.next-btl-equity-ltv\s*\{[\s\S]*?margin:\s*0;[\s\S]*?padding-top:\s*7px;/)
    expect(compactStyles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.next-btl-release-mode-owner/)
  })
})
