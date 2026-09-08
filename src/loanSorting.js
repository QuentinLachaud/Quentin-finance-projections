import { addMonths } from './calculations.js'
import { dateInputValue } from './dateUtils.js'
import { loanCostSummary } from './loans.js'

export const LOAN_SORT_OPTIONS = [
  { value: 'expiry-asc', label: 'Fixed ending first' },
  { value: 'expiry-desc', label: 'Fixed ending last' },
  { value: 'balance-desc', label: 'Balance: high to low' },
  { value: 'balance-asc', label: 'Balance: low to high' },
  { value: 'rate-asc', label: 'Rate: low to high' },
  { value: 'rate-desc', label: 'Rate: high to low' },
]

export function loanFixedExpiry(loan) {
  const months = Number(loan.fixedRateMonths)
  if (!loan.fixedStartDate || !Number.isFinite(months) || months <= 0) return null
  const date = addMonths(loan.fixedStartDate, months)
  return dateInputValue(date) || null
}

export function loanDisplayBalance(loan) {
  return loanCostSummary(loan).effectiveBalance
}

export function sortLoans(loans = [], sort = 'expiry-asc') {
  const valid = LOAN_SORT_OPTIONS.some((option) => option.value === sort) ? sort : 'expiry-asc'
  const [field, direction] = valid.split('-')
  const sign = direction === 'desc' ? -1 : 1
  return [...(Array.isArray(loans) ? loans : [])].sort((a, b) => {
    let difference = 0
    if (field === 'expiry') {
      const first = loanFixedExpiry(a)
      const second = loanFixedExpiry(b)
      if (first === null || second === null) {
        if (first !== second) return first === null ? 1 : -1
      } else difference = first.localeCompare(second) * sign
    } else {
      const value = field === 'balance' ? loanDisplayBalance : (loan) => {
        const rate = Number(loan.rate || 0)
        return Number.isFinite(rate) ? rate : 0
      }
      difference = (value(a) - value(b)) * sign
    }
    return difference || String(a.id || '').localeCompare(String(b.id || ''))
  })
}

export function groupLoans(loans = [], properties = [], sort = 'expiry-asc', grouped = true) {
  const ordered = sortLoans(loans, sort)
  if (!grouped) return [{ id: 'all', name: 'All loans', loans: ordered }]
  const groups = new Map((Array.isArray(properties) ? properties : []).map((property) => [property.id, {
    id: property.id, name: property.name || 'Unnamed BTL', loans: [],
  }]))
  const unlinked = { id: 'unlinked', name: 'Manual / unlinked loans', loans: [] }
  for (const loan of ordered) {
    const group = groups.get(loan.propertyId)
    ;(group || unlinked).loans.push(loan)
  }

  const populated = [...groups.values()].filter((group) => group.loans.length)
  const validSort = LOAN_SORT_OPTIONS.some((option) => option.value === sort) ? sort : 'expiry-asc'
  const [field, direction] = validSort.split('-')
  const sign = direction === 'desc' ? -1 : 1
  const groupMetric = (group) => {
    if (field === 'balance') return loanGroupTotals(group.loans).balance
    if (field === 'rate') {
      const weighted = group.loans.reduce((total, loan) => {
        const balance = Math.max(0, Number(loanDisplayBalance(loan)) || 0)
        const rate = Number(loan.rate)
        return { balance: total.balance + balance, interest: total.interest + balance * (Number.isFinite(rate) ? rate : 0) }
      }, { balance: 0, interest: 0 })
      if (weighted.balance > 0) return weighted.interest / weighted.balance
      const rates = group.loans.map((loan) => Number(loan.rate)).filter(Number.isFinite)
      return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
    }
    const dates = group.loans.map(loanFixedExpiry).filter(Boolean).sort()
    return dates.length ? (direction === 'desc' ? dates[dates.length - 1] : dates[0]) : null
  }
  populated.sort((a, b) => {
    const first = groupMetric(a)
    const second = groupMetric(b)
    if (field === 'expiry') {
      if (first === null || second === null) {
        if (first !== second) return first === null ? 1 : -1
      } else {
        const difference = first.localeCompare(second) * sign
        if (difference) return difference
      }
    } else {
      const difference = (first - second) * sign
      if (difference) return difference
    }
    return String(a.name).localeCompare(String(b.name), 'en', { numeric: true }) || String(a.id).localeCompare(String(b.id))
  })
  return populated.concat(unlinked.loans.length ? [unlinked] : [])
}

export function loanGroupTotals(loans = []) {
  return (Array.isArray(loans) ? loans : []).reduce((total, loan) => {
    const cost = loanCostSummary(loan)
    return {
      balance: total.balance + cost.effectiveBalance,
      monthlyPayment: total.monthlyPayment + cost.monthlyPayment,
      count: total.count + 1,
    }
  }, { balance: 0, monthlyPayment: 0, count: 0 })
}
