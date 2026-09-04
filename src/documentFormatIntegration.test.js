import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Documents & Expenses format integration', () => {
  it('uses shared document and image picker contracts', () => {
    const workspace = fs.readFileSync(new URL('./ExpensesWorkspace.jsx', import.meta.url), 'utf8')
    expect(workspace).toContain('accept={DOCUMENT_FILE_ACCEPT}')
    expect(workspace).toContain('accept={DOCUMENT_IMAGE_ACCEPT}')
    expect(workspace).not.toContain('accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"')
  })
})
