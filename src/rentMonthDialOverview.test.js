import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const component = readFileSync(fileURLToPath(new URL('./RentMonthDial.jsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-09-16 21:23 BST — refined cash-flow rent schedule */'
const start = styles.indexOf(marker)
const next = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
const block = start >= 0 ? styles.slice(start, next >= 0 ? next : undefined) : ''

describe('refined Overview cash-flow rent schedule', () => {
  it('keeps the existing rent schedule calculation authoritative', () => {
    expect(component).toContain("import { formatOrdinalDay, rentScheduleForMonth } from './rentSchedule.js'")
    expect(component).toContain('rentScheduleForMonth(tenants, properties, today)')
    expect(component).toContain('schedule.scheduledRent')
    expect(component).toContain('schedule.missingTenants')
  })

  it('uses a clear monthly summary, useful next/today callout and readable agenda', () => {
    expect(component).toContain('className="rent-schedule-card"')
    expect(component).toContain('Expected rent from active tenancies')
    expect(component).toContain('scheduled this month')
    expect(component).toContain("dueToday ? 'DUE TODAY' : nextDue ? 'NEXT DUE'")
    expect(component).toContain('className="rent-schedule-agenda"')
    expect(component).toContain('className="rent-schedule-date"')
    expect(component).toContain('className="rent-schedule-amount"')
  })

  it('never implies historical dates were paid without payment-state data', () => {
    expect(component).toContain("return dueDay < currentDay ? 'Earlier this month' : 'Upcoming'")
    expect(component).not.toContain("return dueDay < currentDay ? 'Paid'")
  })

  it('keeps the dial as supporting context with today and payment-day markers', () => {
    expect(component).toContain('className="rent-schedule-hand"')
    expect(component).toContain("className={`rent-schedule-band ${group.dueDay === currentDay ? 'today' : ''}`}")
    expect(component).toContain('<small>Today</small><strong>{currentDay}</strong>')
  })

  it('adds larger Apple-native responsive styling without decorative gradients', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif')
    expect(block).toMatch(/\.rent-schedule-total strong\s*\{[\s\S]*?font-size:\s*clamp\(36px, 3vw, 48px\)/)
    expect(block).toContain('.rent-schedule-row')
    expect(block).toContain('@media (max-width: 1080px)')
    expect(block).toContain('@media (max-width: 700px)')
    expect(block).not.toContain('linear-gradient')
  })
})
