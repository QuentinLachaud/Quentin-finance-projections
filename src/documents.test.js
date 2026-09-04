import { describe, expect, it } from 'vitest'
import { DOCUMENT_TYPES, documentsForContractor, normalizeDocumentMeta, titleFromFilename } from './documents.js'

describe('documents domain', () => {
  it('uses conservative filename-only title suggestions', () => {
    expect(titleFromFilename('gas_safety-invoice.pdf')).toBe('Gas Safety Invoice')
    expect(DOCUMENT_TYPES).toContain('Receipt / invoice')
  })
  it('normalizes associations/tags and finds contractor documents', () => {
    const entry = { id: '1', document: { title: 'Invoice', type: 'Receipt / invoice', contractorId: 'c1', tagIds: ['gas', 'gas'], association: { kind: 'property', id: 'p1', label: 'BTL1' }, storagePath: 'u/1/a.pdf' } }
    expect(normalizeDocumentMeta(entry.document).tagIds).toEqual(['gas'])
    expect(documentsForContractor([entry], 'c1')).toHaveLength(1)
  })
})
