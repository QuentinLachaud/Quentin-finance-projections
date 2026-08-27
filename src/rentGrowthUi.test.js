import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')

describe('rent growth model controls', () => {
  it('exposes the 2% portfolio model input and projections toggle', () => {
    const data = read('data.js')
    const app = read('App.jsx')
    expect(data).toContain('rentGrowthRate: 0.02')
    expect(app).toContain("['rentGrowthRate', 'Annual rent growth'")
    expect(app).toContain('includeRentGrowth')
    expect(app).toContain('Rent growth')
    expect(app).toContain('rentGrowthRate: includeRentGrowth ? Number(settings.rentGrowthRate || 0) : 0')
  })

  it('wires and persists acquisition purchase-timing rent growth independently', () => {
    const planner = read('TimeToNextBtl.jsx')
    const preferences = read('nextBtlPreferences.js')
    expect(planner).toContain('Apply rent growth')
    expect(planner).toContain('includeRentGrowth')
    expect(planner).toContain('settings: plannerSettings')
    expect(preferences).toContain("typeof raw.includeRentGrowth === 'boolean'")
  })
})
