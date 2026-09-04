import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./documentStorage.js', () => ({
  createStoredDocumentUrl: vi.fn(async () => 'https://example.test/signed'),
}))

import DocumentViewer, { documentPreviewKind } from './DocumentViewer.jsx'

describe('DocumentViewer', () => {
  it('classifies common inline preview formats', () => {
    expect(documentPreviewKind({ mimeType: 'image/jpeg' })).toBe('image')
    expect(documentPreviewKind({ mimeType: 'application/pdf' })).toBe('pdf')
    expect(documentPreviewKind({ mimeType: 'text/plain' })).toBe('text')
    expect(documentPreviewKind({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('file')
  })

  it('renders a native-feeling secure viewer shell without requiring a popup', () => {
    const html = renderToStaticMarkup(<DocumentViewer document={{ title: 'Gas certificate', type: 'Gas', mimeType: 'image/jpeg', storagePath: 'user/doc/photo.jpg' }} onClose={() => {}} />)
    expect(html).toContain('document-viewer-sheet')
    expect(html).toContain('Gas certificate')
    expect(html).toContain('Opening document')
  })
})
