import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const dial = readFileSync(new URL('./RentMonthDial.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Overview rent month dial integration', () => {
  it('renders the dial exactly once in Overview and keeps it out of Projections', () => {
    expect((app.match(/<RentMonthDial/g) || [])).toHaveLength(1)
    const overviewStart = app.indexOf("{section === 'Overview' && <>")
    const dialAt = app.indexOf('<RentMonthDial', overviewStart)
    const projectionsAt = app.indexOf("section === 'Projections'", overviewStart)
    expect(overviewStart).toBeGreaterThanOrEqual(0)
    expect(dialAt).toBeGreaterThan(overviewStart)
    if (projectionsAt >= 0) expect(dialAt).toBeLessThan(projectionsAt)
  })

  it('shows a ring ending at today and the rent-to-rent date range', () => {
    expect(dial).toContain('rentCycleForDate(tenants, properties, today)')
    expect(dial).toContain('strokeDasharray={[cycle.progress * circumference, circumference].join')
    expect(dial).toContain('className="rent-progress-marker"')
    expect(dial).toContain('formatRentCycleDate(cycle.previousDueDate)')
    expect(dial).toContain('formatRentCycleDate(cycle.nextDueDate)')
    expect(dial).toContain('rent-progress-range')
    expect(dial).not.toContain('rent-schedule-hand')
    expect(dial).not.toContain('rent-schedule-band')
  })

  it('exposes tenant rent payment day as a required 1-31 control', () => {
    expect(app).toContain("['rentPaymentDay', 'Rent payment day', 'rent-day']")
    expect(app).toContain('Array.from({ length: 31 }, (_, index) => index + 1)')
    expect(app).toContain('type === \'rent-day\'')
    expect(app).toContain('required value={draft[key] ?? \'\'}')
  })

  it('shows the same rentPaymentDay on tenant cards that feeds the Overview wheel', () => {
    expect(app).toContain("import { formatOrdinalDay } from './rentSchedule.js'")
    expect(app).toContain('<dt>Rent payment date</dt><dd>{formatOrdinalDay(tenant.rentPaymentDay)} monthly</dd>')
    expect(app).toContain('<RentMonthDial tenants={state.tenants} properties={state.properties} />')
  })
})
