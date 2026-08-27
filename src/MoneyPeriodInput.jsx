import React from 'react'
import { currency } from './calculations.js'
import {
  MONEY_PERIOD_ANNUAL,
  MONEY_PERIOD_MONTHLY,
  moneyEntryInputValue,
  monthlyMoneyFromEntry,
} from './moneyPeriods.js'

export default function MoneyPeriodInput({
  ariaLabel,
  monthlyValue,
  period = MONEY_PERIOD_MONTHLY,
  onMonthlyChange,
  onPeriodChange,
  disabled = false,
  min = 0,
  step = '0.01',
}) {
  const normalizedPeriod = period === MONEY_PERIOD_ANNUAL ? MONEY_PERIOD_ANNUAL : MONEY_PERIOD_MONTHLY
  const inputValue = moneyEntryInputValue(monthlyValue, normalizedPeriod)

  return <div className={`money-period-control ${normalizedPeriod}`}>
    <div className="money-input money-period-input">
      <i aria-hidden="true">£</i>
      <input
        aria-label={ariaLabel}
        disabled={disabled}
        type="number"
        min={min}
        step={step}
        value={inputValue}
        onChange={(event) => onMonthlyChange?.(monthlyMoneyFromEntry(event.target.value, normalizedPeriod))}
      />
      <select
        aria-label={`${ariaLabel} entry period`}
        disabled={disabled}
        value={normalizedPeriod}
        onChange={(event) => onPeriodChange?.(event.target.value)}
      >
        <option value={MONEY_PERIOD_MONTHLY}>Monthly</option>
        <option value={MONEY_PERIOD_ANNUAL}>Annual</option>
      </select>
    </div>
    {normalizedPeriod === MONEY_PERIOD_ANNUAL && <small className="money-monthly-equivalent">{currency(monthlyValue, 2)} / month equivalent</small>}
  </div>
}
