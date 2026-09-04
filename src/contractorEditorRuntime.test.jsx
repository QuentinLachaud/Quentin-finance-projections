import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ContractorEditor } from './ContractorsWorkspace.jsx'
import { normalizeContractorTags } from './contractors.js'

describe('ContractorEditor runtime regression', () => {
  it('renders with shared document props instead of throwing a white-screen ReferenceError', () => {
    const html = renderToStaticMarkup(<ContractorEditor
      contractor={{ id: 'c1', name: 'Sam Smith', companyName: 'Smith Gas', phone: '07700 900123', email: '', trade: 'Gas Engineer', tagIds: ['gas'], propertyIds: ['btl-1'], lastJobMonth: 8, lastJobYear: 2026, notes: '' }}
      properties={[{ id: 'btl-1', name: 'BTL1', postcode: 'G1 1AA' }]}
      tags={normalizeContractorTags([])}
      documents={[{ id: 'd1', document: { title: 'Gas certificate', type: 'Compliance certificate', contractorId: 'c1' } }]}
      onOpenDocuments={() => {}}
      onSave={() => {}}
      onCancel={() => {}}
    />)
    expect(html).toContain('Name')
    expect(html).toContain('Company')
    expect(html).toContain('Associated documents')
    expect(html).toContain('contractor-property-select')
    expect(html).toContain('BTL1')
    expect(html).not.toContain('Custom tag name')
  })
})
