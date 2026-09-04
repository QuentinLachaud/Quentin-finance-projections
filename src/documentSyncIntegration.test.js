import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('document sync and viewer integration', () => {
  it('refreshes newer portfolio state when the app resumes or regains focus', () => {
    const app = fs.readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
    expect(app).toContain("select('portfolio, updated_at')")
    expect(app).toContain("window.addEventListener('focus', onFocus)")
    expect(app).toContain("document.addEventListener('visibilitychange', onVisibilityChange)")
    expect(app).toContain('serverVersionIsNewer')
    expect(app).toContain('remoteApplying.current = true')
  })

  it('surfaces recent files and mounts the in-app viewer', () => {
    const workspace = fs.readFileSync(new URL('./ExpensesWorkspace.jsx', import.meta.url), 'utf8')
    expect(workspace).toContain('RECENT DOCUMENTS')
    expect(workspace).toContain('<DocumentViewer')
    expect(workspace).toContain('expense-document-open')
    expect(workspace).not.toContain('await openStoredDocument')
  })
})
