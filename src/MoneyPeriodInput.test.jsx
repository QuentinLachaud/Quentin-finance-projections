import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MoneyPeriodInput from './MoneyPeriodInput.jsx'
import { MONEY_PERIOD_ANNUAL, MONEY_PERIOD_MONTHLY } from './moneyPeriods.js'

describe('MoneyPeriodInput', () => {
  it('renders explicit Monthly and Annual options', () => {
    const html = renderToStaticMarkup(<MoneyPeriodInput ariaLabel="Rent" monthlyValue={100} />)
    expect(html).toContain('Monthly')
    expect(html).toContain('Annual')
    expect(html).toContain('aria-label="Rent entry period"')
  })

  it('renders annual value and monthly equivalent when Annual is selected', () => {
    const html = renderToStaticMarkup(<MoneyPeriodInput ariaLabel="Rent" monthlyValue={100} period={MONEY_PERIOD_ANNUAL} />)
    expect(html).toContain('value="1200"')
    expect(html).toContain('£100.00 / month equivalent')
  })

  it('omits monthly-equivalent helper in Monthly mode', () => {
    const html = renderToStaticMarkup(<MoneyPeriodInput ariaLabel="Rent" monthlyValue={100} period={MONEY_PERIOD_MONTHLY} />)
    expect(html).not.toContain('month equivalent')
  })

  it('propagates disabled state to both number and cadence controls', () => {
    const html = renderToStaticMarkup(<MoneyPeriodInput ariaLabel="Rent" monthlyValue={100} disabled />)
    expect((html.match(/disabled=""/g) || []).length).toBe(2)
  })

  it('keeps financial and cadence handlers separate by contract', () => {
    const monthly = vi.fn()
    const period = vi.fn()
    renderToStaticMarkup(<MoneyPeriodInput ariaLabel="Rent" monthlyValue={100} onMonthlyChange={monthly} onPeriodChange={period} />)
    expect(monthly).not.toHaveBeenCalled()
    expect(period).not.toHaveBeenCalled()
  })
})
