import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const expenses = readFileSync(new URL('./ExpensesWorkspace.jsx', import.meta.url), 'utf8')
const capture = readFileSync(new URL('./DocumentCaptureSheet.jsx', import.meta.url), 'utf8')
const slot = readFileSync(new URL('./ContractorDocumentsSlot.jsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260904_documents_storage.sql', import.meta.url), 'utf8')

describe('Documents & Expenses integration', () => {
  it('renames the workspace and wires shared contractor/document context', () => {
    expect(app).toContain("['Documents & Expenses', 'Documents', FileText, 'PORTFOLIO']")
    expect(app).toContain("section === 'Documents & Expenses'")
    expect(app).toContain('documentCaptureRequest')
    expect(slot).toContain('Associated documents')
    expect(slot).toContain('documentsForContractor')
  })
  it('offers file/image/mobile-photo capture without OCR or silent parsing', () => {
    expect(expenses).toContain('Upload file')
    expect(expenses).toContain('Upload image')
    expect(expenses).toContain('Take photo')
    expect(expenses).toContain('capture="environment"')
    expect(capture).toContain('Nothing is read or inferred from the file.')
    expect(capture).not.toMatch(/tesseract|vision api|ocr\s*\(/i)
  })
  it('uses private user-scoped Supabase storage policies', () => {
    expect(migration).toContain("'documents'")
    expect(migration).toContain('auth.uid()::text')
    expect(migration).toContain('public = excluded.public')
  })
})
