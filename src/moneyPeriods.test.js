import { describe, expect, it } from 'vitest'
import {
  MONEY_PERIOD_ANNUAL,
  MONEY_PERIOD_MONTHLY,
  MONEY_PERIOD_PREFERENCES_VERSION,
  moneyEntryInputValue,
  moneyEntryPeriodFor,
  moneyEntryValueFromMonthly,
  monthlyMoneyFromEntry,
  normalizeMoneyEntryPreferences,
  setMoneyEntryPeriod,
} from './moneyPeriods.js'

describe('monthly / annual money-entry conversion', () => {
  it('leaves monthly display/input values unchanged', () => {
    expect(moneyEntryValueFromMonthly(123.45, MONEY_PERIOD_MONTHLY)).toBe(123.45)
    expect(monthlyMoneyFromEntry(123.45, MONEY_PERIOD_MONTHLY)).toBe(123.45)
  })

  it('shows annual as monthly x 12 and converts annual entry back to canonical monthly', () => {
    expect(moneyEntryValueFromMonthly(100, MONEY_PERIOD_ANNUAL)).toBe(1200)
    expect(monthlyMoneyFromEntry(1200, MONEY_PERIOD_ANNUAL)).toBe(100)
  })

  it('does not round the canonical monthly value after annual entry', () => {
    expect(monthlyMoneyFromEntry(1000, MONEY_PERIOD_ANNUAL)).toBe(1000 / 12)
    expect(monthlyMoneyFromEntry(1000, MONEY_PERIOD_ANNUAL)).not.toBe(83.33)
  })

  it('rounds only the visible input value to two decimals', () => {
    expect(moneyEntryInputValue(1000 / 12, MONEY_PERIOD_MONTHLY)).toBe(83.33)
    expect(moneyEntryInputValue(1000 / 12, MONEY_PERIOD_ANNUAL)).toBe(1000)
  })

  it('keeps current numeric-input safety for invalid values', () => {
    expect(monthlyMoneyFromEntry('', MONEY_PERIOD_ANNUAL)).toBe(0)
    expect(monthlyMoneyFromEntry('bad', MONEY_PERIOD_MONTHLY)).toBe(0)
  })
})

describe('per-field money-entry period preferences', () => {
  it('defaults safely to Monthly', () => {
    expect(normalizeMoneyEntryPreferences(null)).toEqual({ version: MONEY_PERIOD_PREFERENCES_VERSION, fields: {} })
    expect(moneyEntryPeriodFor({}, 'property:p1:rent')).toBe(MONEY_PERIOD_MONTHLY)
  })

  it('persists Annual and returns to implicit Monthly without carrying noise', () => {
    const annual = setMoneyEntryPeriod({}, 'property:p1:rent', MONEY_PERIOD_ANNUAL)
    expect(annual.fields).toEqual({ 'property:p1:rent': MONEY_PERIOD_ANNUAL })
    expect(moneyEntryPeriodFor(annual, 'property:p1:rent')).toBe(MONEY_PERIOD_ANNUAL)

    const monthly = setMoneyEntryPeriod(annual, 'property:p1:rent', MONEY_PERIOD_MONTHLY)
    expect(monthly.fields).toEqual({})
    expect(moneyEntryPeriodFor(monthly, 'property:p1:rent')).toBe(MONEY_PERIOD_MONTHLY)
  })

  it('drops malformed, unknown and explicit-monthly persisted entries', () => {
    expect(normalizeMoneyEntryPreferences({
      version: 999,
      fields: {
        annual: 'annual',
        monthly: 'monthly',
        nonsense: 'weekly',
      },
      derivedTotal: 123,
    })).toEqual({
      version: MONEY_PERIOD_PREFERENCES_VERSION,
      fields: { annual: 'annual' },
    })
  })
})
