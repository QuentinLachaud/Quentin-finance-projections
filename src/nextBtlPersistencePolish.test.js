import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const simulator = readFileSync(new URL('./AcquisitionSimulator.jsx', import.meta.url), 'utf8')
const planner = readFileSync(new URL('./TimeToNextBtl.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('persistent polished acquisition planner', () => {
  it('persists normalized planner inputs through the existing portfolio-state save path', () => {
    expect(app).toContain("import { normalizeNextBtlPreferences } from './nextBtlPreferences.js'")
    expect(app).toContain('nextBtlPreferences: normalizeNextBtlPreferences(portfolioState.nextBtlPreferences)')
    expect(app).toContain('const updateNextBtlPreferences =')
    expect(app).toContain('plannerPreferences={state.nextBtlPreferences}')
    expect(app).toContain('onPlannerPreferencesChange={updateNextBtlPreferences}')
    expect(simulator).toContain('plannerPreferences = {}')
    expect(simulator).toContain('onPlannerPreferencesChange = null')
    expect(simulator).toContain('preferences={plannerPreferences}')
    expect(simulator).toContain('onPreferencesChange={onPlannerPreferencesChange}')
  })

  it('hydrates choices and emits inputs only, without storing derived projection outputs', () => {
    expect(planner).toContain("import { normalizeNextBtlPreferences } from './nextBtlPreferences.js'")
    expect(planner).toContain('const initialPreferences = useRef(normalizeNextBtlPreferences(preferences)).current')
    expect(planner).toContain('onPreferencesChangeRef')
    for (const key of [
      'targetSource',
      'selectedAcquisitionId',
      'targetPrice',
      'scenarioIndex',
      'preserveBuffer',
      'includeExtraction',
      'appreciationPercent',
      'assumptions',
      'equityReleaseOptions',
    ]) expect(planner).toContain(key)
    for (const derived of ['crossingMonth:', 'buyingPower:', 'cashRequired:', 'startingSurplus: result']) {
      expect(planner).not.toContain(derived)
    }
  })

  it('keeps the planner readable at desktop, tablet and phone sizes', () => {
    expect(styles).toContain('persistent polished acquisition planner')
    expect(styles).toMatch(/\.next-btl-segmented button[\s\S]*?font-size:\s*13\.5px/)
    expect(styles).toMatch(/\.next-btl-source-segmented button[\s\S]*?font-size:\s*13\.5px/)
    expect(styles).toMatch(/\.next-btl-advanced-toggle b[\s\S]*?font-size:\s*15\.5px/)
    expect(styles).toMatch(/\.next-btl-advanced-note[\s\S]*?font-size:\s*12\.25px/)
    expect(styles).toMatch(/\.next-btl-equity-name b[\s\S]*?font-size:\s*14\.5px/)
    expect(styles).toMatch(/\.next-btl-equity-name small[\s\S]*?font-size:\s*11\.5px/)
    expect(styles).not.toContain('.next-btl-equity-property:not(.included) { opacity: .78; }')
    expect(styles).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.next-btl-segmented button[\s\S]*?font-size:\s*13px/)
    expect(styles).toMatch(/@media \(max-width: 420px\)[\s\S]*?\.next-btl-equity-ltv/)
  })
})
