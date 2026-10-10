import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import RentMonthDial from './RentMonthDial.jsx'

const component = readFileSync(new URL('./RentMonthDial.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./RentMonthDial.css', import.meta.url), 'utf8')
const properties = [
  { id: 'one', name: 'BTL 1', active: true, rent: 1500 },
  { id: 'two', name: 'BTL 2', active: true, rent: 1100 },
]
const tenants = [
  { id: 't1', propertyId: 'one', rentPaymentDay: 6, moveIn: '2025-01-01' },
  { id: 't2', propertyId: 'two', rentPaymentDay: 16, moveIn: '2025-01-01' },
]

function renderOnOctoberTenth(props = { properties, tenants }) {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date(2026, 9, 10, 12))
    return renderToStaticMarkup(<RentMonthDial {...props} />)
  } finally {
    vi.useRealTimers()
  }
}

describe('compact Overview rent clock', () => {
  it('retains the precise progress ring and shows the last/next date and expected amount', () => {
    const html = renderOnOctoberTenth()
    expect(html).toContain('rent-progress-wheel')
    expect(html).toContain('rent-progress-fill')
    expect(html).toContain('rent-progress-marker')
    expect(html).toContain('>Last rent<')
    expect(html).toContain('>Next rent<')
    expect(html).toContain('>6 Oct</strong><b>£1,500</b>')
    expect(html).toContain('>16 Oct</strong><b>£1,100</b>')
    expect(html).toContain('6 days')
    expect(html).toContain('Last scheduled rent 6 Oct, expected £1,500')
    expect(html).toContain('Next scheduled rent 16 Oct, expected £1,100')
  })

  it('removes the summary, total, due callout and payment agenda entirely', () => {
    const html = renderOnOctoberTenth()
    for (const removed of [
      'Expected rent from active tenancies', 'scheduled this month',
      'rent-schedule-summary', 'rent-schedule-total', 'rent-schedule-focus',
      'rent-schedule-agenda', 'Payment dates', 'Expected rent',
      'rent-schedule-list', 'payment-count',
    ]) {
      expect(html).not.toContain(removed)
      expect(component).not.toContain(removed)
    }
  })

  it('uses clear missing-state placeholders instead of inventing zero-value rents', () => {
    const html = renderOnOctoberTenth({ tenants: [], properties: [] })
    expect(html).toContain('No rent scheduled')
    expect(html).toContain('>Last rent<')
    expect(html).toContain('>Next rent<')
    expect(html).not.toContain('£0')
    expect(html).not.toContain('rent-progress-fill')
  })

  it('centres a smaller desktop dial and places an even smaller wheel left of stacked rent details on mobile', () => {
    expect(styles).toMatch(/\.rent-schedule-card\.rent-progress-layout\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center;/)
    expect(styles).toContain('width: 188px;')
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    const mobile = styles.slice(styles.indexOf('@media (max-width: 700px)'))
    expect(mobile).toContain('flex-direction: row;')
    expect(mobile).toContain('width: clamp(110px, 32vw, 134px);')
    expect(mobile).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(mobile).toContain('border-top: 1px solid')
    expect(styles).not.toContain('linear-gradient')
  })

  it('leaves tenant date and rent information in the canonical rent scheduling functions', () => {
    expect(component).toContain('rentCycleForDate(tenants, properties, today)')
    expect(component).toContain('scheduledRentAmountForDate(tenants, properties, cycle.previousDueDate)')
    expect(component).toContain('scheduledRentAmountForDate(tenants, properties, cycle.nextDueDate)')
  })
})
