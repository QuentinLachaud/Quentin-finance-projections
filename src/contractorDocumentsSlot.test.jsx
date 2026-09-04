import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ContractorDocumentsSlot from './ContractorDocumentsSlot.jsx'

const source = readFileSync(new URL('./ContractorDocumentsSlot.jsx', import.meta.url), 'utf8')
const documents = [
  { id: 'd1', date: '2026-09-01', description: 'Gas certificate', document: { title: 'Gas certificate', type: 'Compliance certificate', contractorId: 'c1', storagePath: 'u/d1.pdf' } },
  { id: 'd2', date: '2026-09-02', description: 'Other', document: { title: 'Other', type: 'Receipt / invoice', contractorId: 'c2', storagePath: 'u/d2.pdf' } },
]

describe('ContractorDocumentsSlot shared boundary', () => {
  it('uses the shared document model without duplicating file or storage implementation', () => {
    expect(source).toContain("from './documents.js'")
    expect(source).toContain('documentsForContractor')
    expect(source).not.toMatch(/type=[\"']file[\"']/)
    expect(source).not.toContain('supabase')
    expect(source).not.toContain('navigator.mediaDevices')
  })

  it('renders associated documents and the shared Add document affordance', () => {
    const html = renderToStaticMarkup(<ContractorDocumentsSlot contractorId="c1" propertyIds={['btl-1']} documents={documents} onOpenDocuments={() => {}} />)
    expect(html).toContain('Associated documents')
    expect(html).toContain('Gas certificate')
    expect(html).not.toContain('Other')
    expect(html).toContain('Add document')
  })
})
