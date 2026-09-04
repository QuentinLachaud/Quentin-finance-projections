import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ContractorDocumentsSlot from './ContractorDocumentsSlot.jsx'

const source = readFileSync(new URL('./ContractorDocumentsSlot.jsx', import.meta.url), 'utf8')

describe('ContractorDocumentsSlot boundary', () => {
  it('is explicitly a presentation-only placeholder with no file input or persistence implementation', () => {
    expect(source).toContain('Presentation-only seam for the future shared Documents feature')
    expect(source).not.toMatch(/type=["']file["']/)
    expect(source).not.toContain('supabase')
    expect(source).not.toContain('navigator.mediaDevices')
    expect(source).not.toContain('capture=')
    expect(source).not.toContain('FormData')
  })

  it('renders the future integration affordance without pretending upload is enabled', () => {
    const html = renderToStaticMarkup(<ContractorDocumentsSlot contractorId="c1" propertyIds={['btl-1']} />)
    expect(html).toContain('Documents')
    expect(html).toContain('Add document')
    expect(html).toContain('shared Documents feature')
  })
})
