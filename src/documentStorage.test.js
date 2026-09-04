import { describe, expect, it } from 'vitest'
import { MAX_DOCUMENT_BYTES, validateDocumentFile } from './documentStorage.js'

describe('document upload validation', () => {
  it('allows supported private-document formats and rejects risky/oversized files', () => {
    expect(validateDocumentFile({ name: 'x.pdf', type: 'application/pdf', size: 1000 })).toBe('')
    expect(validateDocumentFile({ name: 'x.jpg', type: 'image/jpeg', size: 1000 })).toBe('')
    expect(validateDocumentFile({ name: 'x.zip', type: 'application/zip', size: 1000 })).toMatch(/PDF/)
    expect(validateDocumentFile({ name: 'x.pdf', type: 'application/pdf', size: MAX_DOCUMENT_BYTES + 1 })).toMatch(/20 MB/)
  })
})
