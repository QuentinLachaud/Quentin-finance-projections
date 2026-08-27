const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const MONEY_PERIOD_MONTHLY = 'monthly'
export const MONEY_PERIOD_ANNUAL = 'annual'
export const MONEY_PERIOD_PREFERENCES_VERSION = 1

const finite = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const moneyEntryPeriodFor = (preferences, key) => {
  const normalized = normalizeMoneyEntryPreferences(preferences)
  return normalized.fields[key] === MONEY_PERIOD_ANNUAL ? MONEY_PERIOD_ANNUAL : MONEY_PERIOD_MONTHLY
}

export const moneyEntryValueFromMonthly = (monthlyValue, period = MONEY_PERIOD_MONTHLY) => {
  const monthly = finite(monthlyValue)
  return period === MONEY_PERIOD_ANNUAL ? monthly * 12 : monthly
}

export const monthlyMoneyFromEntry = (entryValue, period = MONEY_PERIOD_MONTHLY) => {
  const entered = finite(entryValue)
  return period === MONEY_PERIOD_ANNUAL ? entered / 12 : entered
}

export const moneyEntryInputValue = (monthlyValue, period = MONEY_PERIOD_MONTHLY) =>
  Number(moneyEntryValueFromMonthly(monthlyValue, period).toFixed(2))

export const normalizeMoneyEntryPreferences = (value) => {
  const raw = isRecord(value) ? value : {}
  const rawFields = isRecord(raw.fields) ? raw.fields : {}
  const fields = {}

  for (const [key, period] of Object.entries(rawFields)) {
    if (!key || period !== MONEY_PERIOD_ANNUAL) continue
    fields[key] = MONEY_PERIOD_ANNUAL
  }

  return {
    version: MONEY_PERIOD_PREFERENCES_VERSION,
    fields,
  }
}

export const setMoneyEntryPeriod = (preferences, key, period) => {
  const normalized = normalizeMoneyEntryPreferences(preferences)
  const fields = { ...normalized.fields }

  if (!key) return normalized
  if (period === MONEY_PERIOD_ANNUAL) fields[key] = MONEY_PERIOD_ANNUAL
  else delete fields[key]

  return {
    version: MONEY_PERIOD_PREFERENCES_VERSION,
    fields,
  }
}
