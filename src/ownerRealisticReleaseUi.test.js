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
})
