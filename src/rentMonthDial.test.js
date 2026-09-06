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

  it('uses actual month length, green circumference bands and a rotating current-day hand', () => {
    expect(dial).toContain('pathLength={schedule.daysInMonth}')
    expect(dial).toContain('strokeDashoffset={-(group.dueDay - 1)}')
    expect(dial).toContain('transform="rotate(-90 60 60)"')
    expect(dial).toContain('handAngle')
    expect(dial).toContain('rent-month-dial-hand')
    expect(styles).toContain('.rent-month-dial-band')
    expect(styles).toContain('var(--positive')
  })

  it('exposes tenant rent payment day as a required 1-31 control', () => {
    expect(app).toContain("['rentPaymentDay', 'Rent payment day', 'rent-day']")
    expect(app).toContain('Array.from({ length: 31 }, (_, index) => index + 1)')
    expect(app).toContain('type === \'rent-day\'')
    expect(app).toContain('required value={draft[key] ?? \'\'}')
  })
})
