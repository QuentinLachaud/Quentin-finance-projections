import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_FILE_ACCEPT,
  DOCUMENT_IMAGE_ACCEPT,
  DOCUMENT_MIME_BY_EXTENSION,
  MAX_DOCUMENT_BYTES,
  documentPathBelongsToUser,
  SUPPORTED_DOCUMENT_MIME_TYPES,
  resolveDocumentMimeType,
  validateDocumentFile,
} from './documentStorage.js'

const supportedFiles = [
  ['lease.pdf', 'application/pdf'],
  ['invoice.doc', 'application/msword'],
  ['invoice.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['costs.xls', 'application/vnd.ms-excel'],
  ['costs.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['pack.ppt', 'application/vnd.ms-powerpoint'],
  ['pack.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['notes.rtf', 'application/rtf'],
  ['notes.rtf', 'text/rtf'],
  ['lease.odt', 'application/vnd.oasis.opendocument.text'],
  ['costs.ods', 'application/vnd.oasis.opendocument.spreadsheet'],
  ['ledger.csv', 'text/csv'],
  ['notes.txt', 'text/plain'],
  ['photo.jpg', 'image/jpeg'],
  ['photo.png', 'image/png'],
  ['photo.webp', 'image/webp'],
  ['photo.heic', 'image/heic'],
  ['photo.heif', 'image/heif'],
  ['scan.tiff', 'image/tiff'],
  ['photo.avif', 'image/avif'],
  ['photo.gif', 'image/gif'],
  ['scan.bmp', 'image/bmp'],
]

describe('document storage ownership', () => {
  it('requires the authenticated user id as the first storage folder', () => {
    expect(documentPathBelongsToUser('user-1/doc-1/photo.jpg', 'user-1')).toBe(true)
    expect(documentPathBelongsToUser('user-2/doc-1/photo.jpg', 'user-1')).toBe(false)
    expect(documentPathBelongsToUser('../user-1/photo.jpg', 'user-1')).toBe(false)
    expect(documentPathBelongsToUser('', 'user-1')).toBe(false)
  })
})

describe('document upload validation', () => {
  it.each(supportedFiles)('allows %s with %s', (name, type) => {
    expect(validateDocumentFile({ name, type, size: 1000 })).toBe('')
    expect(resolveDocumentMimeType({ name, type })).toBe(type)
  })

  it('falls back to safe extension MIME when browsers omit or genericise MIME', () => {
    expect(resolveDocumentMimeType({ name: 'gas-safety.pdf', type: '' })).toBe('application/pdf')
    expect(resolveDocumentMimeType({ name: 'invoice.DOCX', type: 'application/octet-stream' })).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(resolveDocumentMimeType({ name: 'inspection.PNG', type: '' })).toBe('image/png')
    expect(validateDocumentFile({ name: 'notes.txt', type: '', size: 1000 })).toBe('')
  })

  it('rejects SVG, archives, executables and oversized files', () => {
    expect(validateDocumentFile({ name: 'x.svg', type: 'image/svg+xml', size: 1000 })).toMatch(/supported/)
    expect(validateDocumentFile({ name: 'x.zip', type: 'application/zip', size: 1000 })).toMatch(/supported/)
    expect(validateDocumentFile({ name: 'x.exe', type: 'application/octet-stream', size: 1000 })).toMatch(/supported/)
    expect(validateDocumentFile({ name: 'x.pdf', type: 'application/pdf', size: MAX_DOCUMENT_BYTES + 1 })).toMatch(/20 MB/)
  })

  it('keeps picker contracts aligned and excludes SVG', () => {
    for (const extension of Object.keys(DOCUMENT_MIME_BY_EXTENSION)) expect(DOCUMENT_FILE_ACCEPT).toContain(extension)
    expect(DOCUMENT_FILE_ACCEPT).not.toContain('.svg')
    expect(DOCUMENT_IMAGE_ACCEPT).toContain('image/png')
    expect(DOCUMENT_IMAGE_ACCEPT).toContain('image/heic')
    expect(DOCUMENT_IMAGE_ACCEPT).not.toContain('image/svg+xml')
  })

  it('keeps Supabase bucket MIME whitelist aligned with client support', () => {
    const sql = fs.readFileSync(new URL('../supabase/migrations/20260904_document_format_alignment.sql', import.meta.url), 'utf8')
    for (const mime of SUPPORTED_DOCUMENT_MIME_TYPES) expect(sql).toContain(`'${mime}'`)
    expect(sql).toContain('public = false')
    expect(sql).toContain('file_size_limit = 20971520')
    expect(sql).not.toContain("'image/svg+xml'")
    expect(sql).not.toContain("'application/octet-stream'")
  })
})
