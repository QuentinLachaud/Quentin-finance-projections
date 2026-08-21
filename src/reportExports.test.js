import { describe, expect, it } from 'vitest'
import { buildXlsx, tabularCsv } from './reportExports.js'

describe('report exports', () => {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'amount', label: 'Amount' },
  ]
  const rows = [{ name: 'Example, "quoted"', amount: -12.5 }]

  it('creates valid escaped CSV rows', () => {
    const csv = tabularCsv(columns, rows)
    expect(csv).toContain('Example,')
    expect(csv).toContain('quoted')
    expect(csv).toContain('"-12.5"')
  })

  it('creates an XLSX zip container without external spreadsheet dependencies', () => {
    const bytes = buildXlsx({
      title: 'Example report',
      columns,
      rows,
      summary: [['Entries', 1]],
    })
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    expect(bytes.length).toBeGreaterThan(500)
  })

  it('protects spreadsheet formulas in CSV text cells', () => {
    const csv = tabularCsv(columns, [{ name: '=HYPERLINK("bad")', amount: 1 }])
    expect(csv).toContain(`"'=HYPERLINK(""bad"")"`)
  })
})
