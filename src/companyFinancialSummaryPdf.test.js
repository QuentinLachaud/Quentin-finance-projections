import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('Company Financial Summary PDF contract', () => {
  it('keeps the renderer explicitly portrait A4 and exactly one page', () => {
    const source = fs.readFileSync(new URL('./companyFinancialSummaryPdf.js', import.meta.url), 'utf8')
    expect(source).toContain("orientation: 'portrait'")
    expect(source).toContain("format: 'a4'")
    expect(source).toContain("getNumberOfPages() !== 1")
    expect(source).not.toMatch(/addPage\s*\(/)
  })
})
