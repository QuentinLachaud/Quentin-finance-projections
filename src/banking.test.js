import { describe, expect, it } from 'vitest'
import {
  aggregateCashFlow, BANK_CATEGORIES, calculateBankMetrics, cashHeldFromAccounts, classifyTransaction,
  detectInternalTransfers, normalizeGoCardlessTransaction, reconstructBalanceSeries, reportingAccountIds,
  suggestTransactionAssignment, transactionsToCsv,
} from './banking.js'

const tx = (accountId, bookedAt, amount, extra = {}) => ({
  accountId, bookedAt, amount, currency: 'GBP', status: 'booked', isTransfer: false, ...extra,
})

describe('bank transaction normalisation and classification', () => {
  it.each([
    ['Monthly rent Flat 2', 'rent'], ['THE MORTGAGE WORKS', 'mortgage'], ['HMRC corporation tax', 'tax_property_duties'],
    ['PAYROLL SALARY', 'payroll'], ['Newton Property Factors', 'factors'],
    ['Emergency plumber repair', 'repairs'], ['Octopus Energy', 'utilities'], ['Landlord insurance premium', 'insurance'],
    ['SafeDeposits Scotland ref DAN1211284', 'tenant_deposit'], ['LBTT Additional Dwelling Supplement', 'property_acquisition'],
    ['Solicitor legal fee', 'legal_professional'], ['Capital improvement refurbishment', 'capital_improvement'],
    ['Bank account fee', 'bank_admin_fees'], ['Internal transfer to savings', 'transfer'], ['Unrecognised shop', 'other'],
  ])('classifies %s as %s', (description, expected) => expect(classifyTransaction({ description })).toBe(expected))

  it('uses a compact landlord-relevant category set with no directional DLA duplicates', () => {
    expect(BANK_CATEGORIES.map(([value]) => value)).toEqual([
      'rent', 'other_property_income', 'mortgage', 'repairs', 'capital_improvement', 'factors', 'insurance', 'utilities',
      'legal_professional', 'tax_property_duties', 'property_acquisition', 'tenant_deposit', 'payroll', 'bank_admin_fees',
      'owner_funding', 'cash_extraction', 'transfer', 'other',
    ])
  })

  it('uses one owner-funding category regardless of DLA direction', () => {
    expect(classifyTransaction({ amount: 25000, description: 'DLA deposit' })).toBe('owner_funding')
    expect(classifyTransaction({ amount: -3000, description: 'Directors loan repayment' })).toBe('owner_funding')
  })

  it('infers rent/property only when tenant or rent evidence is uniquely strong', () => {
    const properties = [
      { id: 'p1', name: 'BTL1', rent: 1650 },
      { id: 'p2', name: 'BTL2', rent: 1100 },
    ]
    const tenants = [
      { id: 't1', propertyId: 'p1', name: 'Alice Tenant', moveIn: '2026-01-01' },
      { id: 't2', propertyId: 'p2', name: 'Joaquim de Faria', moveIn: '2026-02-01' },
    ]
    expect(suggestTransactionAssignment({ amount: 1100, bookedAt: '2026-08-16', category: 'other', counterparty: 'Joaquim de Faria' }, properties, tenants)).toMatchObject({ category: 'rent', propertyId: 'p2', reason: 'Tenant + rent match' })
    expect(suggestTransactionAssignment({ amount: 1650, bookedAt: '2026-08-16', category: 'other', counterparty: '' }, properties, tenants)).toMatchObject({ category: 'rent', propertyId: 'p1', reason: 'Expected rent match' })
    const ambiguous = [{ ...properties[0], rent: 1100 }, properties[1]]
    expect(suggestTransactionAssignment({ amount: 1100, bookedAt: '2026-08-16', category: 'other' }, ambiguous, tenants).propertyId).toBe('')
  })

  it('prefers a recorded move-in deposit over rent and can infer SafeDeposits property by deposit value', () => {
    const properties = [{ id: 'p1', name: 'BTL1', rent: 1100 }]
    const tenants = [{ id: 't1', propertyId: 'p1', name: 'Jane Smith', moveIn: '2026-08-01', depositHeld: '£1,100' }]
    expect(suggestTransactionAssignment({ amount: 1100, bookedAt: '2026-08-01', category: 'other', counterparty: 'Jane Smith' }, properties, tenants)).toMatchObject({ category: 'tenant_deposit', propertyId: 'p1' })
    expect(suggestTransactionAssignment({ amount: -1100, bookedAt: '2026-08-03', category: 'tenant_deposit', counterparty: 'SafeDeposits Scotland' }, properties, tenants)).toMatchObject({ category: 'tenant_deposit', propertyId: 'p1' })
  })

  it('normalises signed amounts and creates a stable fallback identity', () => {
    const raw = {
      bookingDate: '2026-07-04', transactionAmount: { amount: '-125.40', currency: 'GBP' },
      creditorName: 'Newton Factors', remittanceInformationUnstructured: 'Property management fee',
    }
    const first = normalizeGoCardlessTransaction(raw, 'account-1')
    const second = normalizeGoCardlessTransaction(raw, 'account-1')
    expect(first).toMatchObject({ amount: -125.4, counterparty: 'Newton Factors', category: 'factors', status: 'booked' })
    expect(first.transactionKey).toBe(second.transactionKey)
  })
})

describe('transfer detection', () => {
  it('marks equal and opposite cross-account entries within two days', () => {
    const result = detectInternalTransfers([
      tx('current', '2026-06-01', -500), tx('savings', '2026-06-02', 500), tx('current', '2026-06-02', -30),
    ])
    expect(result.slice(0, 2).every((row) => row.isTransfer && row.category === 'transfer')).toBe(true)
    expect(result[2].isTransfer).toBe(false)
  })

  it('does not pair entries from the same account, different currencies or outside two days', () => {
    const result = detectInternalTransfers([
      tx('a', '2026-06-01', -500), tx('a', '2026-06-01', 500),
      tx('b', '2026-06-10', 500), tx('c', '2026-06-01', 500, { currency: 'EUR' }),
    ])
    expect(result.every((row) => !row.isTransfer)).toBe(true)
  })
})

describe('cash-flow aggregation', () => {
  const transactions = detectInternalTransfers([
    tx('a', '2026-01-05', 1000), tx('a', '2026-01-20', -400),
    tx('a', '2026-02-01', -200), tx('a', '2026-02-10', -300), tx('b', '2026-02-10', 300),
    tx('b', '2026-02-11', 700), tx('b', '2026-02-12', -50, { status: 'pending' }),
  ])

  it('uses positive inflow, absolute outflow and excludes transfers and pending entries by default', () => {
    expect(aggregateCashFlow(transactions)).toEqual([
      { period: '2026-01', inflow: 1000, outflow: 400, net: 600, count: 2 },
      { period: '2026-02', inflow: 700, outflow: 200, net: 500, count: 2 },
    ])
  })

  it('includes both sides of transfers without changing their combined net', () => {
    expect(aggregateCashFlow(transactions, { includeTransfers: true })[1]).toMatchObject({ inflow: 1000, outflow: 500, net: 500, count: 4 })
  })

  it('filters multiple selected accounts and can group by year', () => {
    expect(aggregateCashFlow(transactions, { period: 'year', accountIds: ['a'] })).toEqual([
      { period: '2026', inflow: 1000, outflow: 600, net: 400, count: 3 },
    ])
  })
})

describe('balance reconstruction and metrics', () => {
  const accounts = [
    { id: 'a', currency: 'GBP', currentBalance: 1600, balanceUpdatedAt: '2026-03-31', includeInCash: true },
    { id: 'b', currency: 'GBP', currentBalance: 400, balanceUpdatedAt: '2026-03-31', includeInCash: true },
  ]
  const transactions = [tx('a', '2026-01-10', 1000), tx('a', '2026-02-10', -400), tx('b', '2026-03-10', 200)]

  it('reconstructs each account backwards from its authoritative current balance then aggregates by date', () => {
    expect(reconstructBalanceSeries(accounts, transactions, { asOf: '2026-03-31' })).toEqual([
      { date: '2026-01-10', balance: 2200 },
      { date: '2026-02-10', balance: 1800 },
      { date: '2026-03-10', balance: 2000 },
      { date: '2026-03-31', balance: 2000 },
    ])
  })

  it('reconstructs analytical balance without excluded or hidden DLA movements while preserving the real current endpoint', () => {
    const account = [{ id: 'a', currency: 'GBP', currentBalance: 1000, balanceUpdatedAt: '2026-03-31', includeInCash: true }]
    const rows = [
      tx('a', '2026-01-10', 20000, { category: 'owner_funding' }),
      tx('a', '2026-01-20', -15000, { category: 'property_acquisition', propertyId: 'p1', excludeFromPerformance: true }),
      tx('a', '2026-02-10', 1000, { category: 'rent', propertyId: 'p1' }),
    ]
    expect(reconstructBalanceSeries(account, rows, { asOf: '2026-03-31', includeExcluded: false, includeOwnerFunding: false })).toEqual([
      { date: '2026-02-10', balance: 1000 },
      { date: '2026-03-31', balance: 1000 },
    ])
    const withDla = reconstructBalanceSeries(account, rows, { asOf: '2026-03-31', includeExcluded: false, includeOwnerFunding: true })
    expect(withDla.map((point) => point.date)).toEqual(['2026-01-10', '2026-02-10', '2026-03-31'])
    expect(withDla.at(-1).balance).toBe(1000)
  })

  it('calculates cash held only from opted-in GBP accounts', () => {
    expect(cashHeldFromAccounts([...accounts, { id: 'c', currency: 'EUR', currentBalance: 900 }, { id: 'd', currency: 'GBP', currentBalance: 800, includeInCash: false }])).toBe(2000)
  })


  it('limits aggregate reporting to selected accounts in the reporting currency', () => {
    const mixed = [...accounts, { id: 'eur', currency: 'EUR', currentBalance: 1000 }, { id: 'usd', currency: 'USD', currentBalance: 1000 }]
    expect(reportingAccountIds(mixed, ['a', 'eur', 'usd'], 'GBP')).toEqual(['a'])
  })

  it('uses available calendar history, including zero-transaction months, without pretending missing history is zero cash flow', () => {
    const metrics = calculateBankMetrics([
      tx('a', '2026-01-10', 1200), tx('a', '2026-01-12', -300),
      tx('a', '2026-03-10', 600), tx('a', '2026-03-12', -150),
    ], [{ balance: 700 }, { balance: 2100 }, { balance: 1300 }], { asOf: '2026-03-31', includeTransfers: false })
    expect(metrics.averages.threeMonth).toEqual({ inflow: 600, outflow: 150, net: 450 })
    expect(metrics.historyMonths).toBe(3)
    expect(metrics.averages.sixMonth).toEqual({ inflow: 600, outflow: 150, net: 450 })
    expect(metrics.averages.twelveMonth).toEqual({ inflow: 600, outflow: 150, net: 450 })
    expect(metrics).toMatchObject({ inflow: 1800, outflow: 450, netCashFlow: 1350, lowestBalance: 700, highestBalance: 2100 })
  })


  it('keeps trailing averages independent of the selected display range', () => {
    const transactions = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0')
      return tx('a', `2026-${month}-10`, 1000)
    })
    const metrics = calculateBankMetrics(transactions, [], {
      asOf: '2026-12-31',
      from: '2026-10-01',
      accountIds: ['a'],
    })
    expect(metrics.inflow).toBe(3000)
    expect(metrics.averages.threeMonth.inflow).toBe(1000)
    expect(metrics.averages.twelveMonth.inflow).toBe(1000)
    expect(metrics.historyMonths).toBe(12)
  })
})

describe('exports', () => {
  it('escapes CSV values and preserves signed pence', () => {
    const csv = transactionsToCsv([{ ...tx('a', '2026-01-01', -12.3), description: 'Repair, "urgent"', category: 'repairs', counterparty: 'Trades Ltd' }])
    expect(csv).toContain('"Repair, ""urgent"""')
    expect(csv).toContain('"-12.30"')
  })
})

describe('banking defensive-input audit', () => {
  it('ignores malformed balance points instead of treating them as a real £0 low', () => {
    const metrics = calculateBankMetrics([], [{ balance: 'not-a-number' }, { balance: 450 }, { balance: 900 }], { asOf: '2026-08-18' })
    expect(metrics.lowestBalance).toBe(450)
    expect(metrics.highestBalance).toBe(900)
  })

  it('counts GBP balances regardless of currency-code casing', () => {
    expect(cashHeldFromAccounts([
      { currency: 'gbp', currentBalance: 100, includeInCash: true },
      { currency: 'GBP', currentBalance: 200, includeInCash: true },
      { currency: 'EUR', currentBalance: 500, includeInCash: true },
    ])).toBe(300)
  })

  it('never detects pending entries as internal-transfer pairs', () => {
    const result = detectInternalTransfers([
      tx('a', '2026-08-01', -500, { status: 'pending' }),
      tx('b', '2026-08-01', 500),
    ])
    expect(result.every((row) => !row.isTransfer)).toBe(true)
  })
})
