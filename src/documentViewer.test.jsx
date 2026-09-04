import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./documentStorage.js', () => ({
  createStoredDocumentUrl: vi.fn(async () => 'https://example.test/signed'),
}))

import DocumentViewer, { documentPreviewKind, normalizeRenamedFileName } from './DocumentViewer.jsx'

describe('DocumentViewer', () => {
  it('classifies common inline preview formats', () => {
    expect(documentPreviewKind({ mimeType: 'image/jpeg' })).toBe('image')
    expect(documentPreviewKind({ mimeType: 'application/pdf' })).toBe('pdf')
    expect(documentPreviewKind({ mimeType: 'text/plain' })).toBe('text')
    expect(documentPreviewKind({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('file')
  })

  it('preserves a file extension during a friendly rename and sanitises path characters', () => {
    expect(normalizeRenamedFileName('Boiler certificate', 'IMG_1234.jpeg')).toBe('Boiler certificate.jpeg')
    expect(normalizeRenamedFileName('Gas / certificate?.png', 'old.png')).toBe('Gas - certificate-.png')
    expect(normalizeRenamedFileName('  ', 'old.pdf')).toBe('')
  })

  it('renders the image popup controls without an image new-tab action', () => {
    const html = renderToStaticMarkup(<DocumentViewer document={{ fileName: 'inspection.jpg', title: 'Inspection', type: 'Photo', mimeType: 'image/jpeg', storagePath: 'user/doc/photo.jpg' }} onRename={() => {}} onClose={() => {}} />)
    expect(html).toContain('document-viewer-polished')
    expect(html).toContain('inspection.jpg')
    expect(html).toContain('aria-label="Zoom out"')
    expect(html).toContain('aria-label="Zoom in"')
    expect(html).toContain('aria-label="Download file"')
    expect(html).toContain('aria-label="Rename file"')
    expect(html).toContain('aria-label="Close viewer"')
    expect(html).not.toContain('aria-label="Open original document"')
  })
})
