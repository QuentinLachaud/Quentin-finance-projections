import { describe, expect, it } from 'vitest'
import { parseTideCsv, parseTideStatementText } from './bankStatementImport.js'

const properties = [
  { id: 'p1', name: 'BTL1', postcode: 'G1 1AA', lender: 'Paragon' },
  { id: 'p2', name: 'BTL2', postcode: 'G2 2BB', lender: 'The Mortgage Works' },
]
const actualHeaders = [
  'Date', 'Transaction ID', 'Transaction description', 'Reference', 'From', 'To',
  'Paid in', 'Paid out', 'Category name', 'Transaction type', 'Status', 'Initiated by', 'Tag 1',
].join(',')

describe('Tide statement import', () => {
  it('parses the current Tide export schema with stable Tide IDs, signed amounts and no invented balance', () => {
    const csv = [
      actualHeaders,
      "2026-08-16 02:42:23,'rent-id,Joaquim de Faria ref:,,Joaquim de Faria,,1100.00,,Income,FasterPaymentIn,Cleared,,",
      "2026-08-28 04:12:11,'mortgage-id,PARAGON BANK PLC ref: 005276550 10133920,005276550 10133920,,PARAGON BANK PLC,,732.40,Bank interest paid,DirectDebit,Cleared,,",
    ].join('\n')
    const result = parseTideCsv(csv, properties)
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({ transactionKey: 'tide:rent-id', amount: 1100, category: 'rent', balanceAfter: null })
    expect(result.transactions[1]).toMatchObject({ transactionKey: 'tide:mortgage-id', amount: -732.4, category: 'mortgage', propertyId: 'p1' })
    expect(result.closingBalance).toBeNull()
    expect(result.statementFrom).toBe('2026-08-16')
    expect(result.statementTo).toBe('2026-08-28')
  })

  it('treats only evidenced Current Account to Savings FundsTransferOut rows as internal transfers', () => {
    const csv = [
      actualHeaders,
      "2026-08-06 13:28:39,'saving-id,Savings account ref:,,,Savings account,,1000.00,Transfers,FundsTransferOut,Cleared,Owner,",
      "2025-10-06 20:13:51,'external-id,SafeDeposits Scotland ref: DAN1211284,DAN1211284,,SafeDeposits Scotland,,1000.00,Transfers,FasterPaymentOut,Cleared,Owner,",
    ].join('\n')
    const result = parseTideCsv(csv)
    expect(result.transactions[0]).toMatchObject({ category: 'transfer', isTransfer: true, amount: -1000 })
    expect(result.transactions[1]).toMatchObject({ category: 'other', isTransfer: false, amount: -1000 })
  })

  it('separates DLA funding and preserves the original Tide audit metadata', () => {
    const csv = [
      actualHeaders,
      "2025-08-27 14:02:03,'dla-id,QUENTIN LACHAUD ref: DLA DEPOSIT,DLA DEPOSIT,QUENTIN LACHAUD,,25000.00,,Director's Loan,FasterPaymentIn,Cleared,,",
    ].join('\n')
    const result = parseTideCsv(csv)
    expect(result.transactions[0]).toMatchObject({ category: 'dla_injected', amount: 25000 })
    expect(result.transactions[0].sourceMetadata).toMatchObject({
      tideTransactionId: 'dla-id',
      reference: 'DLA DEPOSIT',
      categoryName: "Director's Loan",
      transactionType: 'FasterPaymentIn',
    })
  })

  it('keeps the older generic Tide CSV/PDF compatibility path', () => {
    const csv = [
      'Date,Description,Money in,Money out,Balance',
      '01/09/2026,Monthly rent BTL1,1650.00,,12650.00',
      '02/09/2026,PARAGON mortgage,,732.00,11918.00',
    ].join('\n')
    const result = parseTideCsv(csv, properties)
    expect(result.transactions[0]).toMatchObject({ amount: 1650, category: 'rent', propertyId: 'p1' })
    expect(result.closingBalance).toBe(11918)

    const text = [
      '01 Sep 2026 Monthly rent BTL2 +£1,100.00 £12,000.00',
      '02 Sep 2026 The Mortgage Works -£397.00 £11,603.00',
      '03 Sep 2026 Mystery shop £20.00 £11,583.00',
    ].join('\n')
    const pdf = parseTideStatementText(text, properties)
    expect(pdf.transactions).toHaveLength(2)
    expect(pdf.transactions[1]).toMatchObject({ amount: -397, category: 'mortgage', propertyId: 'p2' })
  })
})
