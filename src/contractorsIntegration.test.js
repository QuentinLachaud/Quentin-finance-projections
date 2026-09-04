import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('./ContractorsWorkspace.jsx', import.meta.url), 'utf8')
const slot = readFileSync(new URL('./ContractorDocumentsSlot.jsx', import.meta.url), 'utf8')
const domain = readFileSync(new URL('./contractors.js', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Contractors workspace integration', () => {
  it('wires navigation, portfolio-state hydration, mutation actions and workspace rendering', () => {
    expect(app).toContain("import ContractorsWorkspace from './ContractorsWorkspace.jsx'")
    expect(app).toContain("['Contractors', 'Contractors', Wrench, 'PORTFOLIO']")
    expect(app).toContain("Contractors: {")
    expect(app).toContain('const migratedContractorTags = normalizeContractorTags(portfolioState.contractorTags)')
    expect(app).toContain('const migratedContractors = normalizeContractors(portfolioState.contractors, migratedProperties, migratedContractorTags)')
    expect(app).toContain('contractors: migratedContractors,')
    expect(app).toContain('contractorTags: migratedContractorTags,')
    expect(app).toContain('const saveContractor =')
    expect(app).toContain('const removeContractor =')
    expect(app).toContain("section === 'Contractors'")
  })

  it('keeps the future Documents feature compartmentalised behind one contractor slot', () => {
    expect(workspace).toContain("import ContractorDocumentsSlot from './ContractorDocumentsSlot.jsx'")
    expect(workspace).toContain('<ContractorDocumentsSlot contractorId={draft.id} propertyIds={draft.propertyIds} />')
    expect(slot).not.toMatch(/type=["']file["']/)
    expect(slot).not.toContain("from './supabase.js'")
    expect(domain).not.toContain('document')
    expect(app).not.toContain('contractorDocuments')
  })

  it('uses native selects for trade and month/year and responsive contractor card styling', () => {
    expect(workspace).toContain('<select value={draft.trade}')
    expect(workspace).toContain('<select value={draft.lastJobMonth')
    expect(workspace).toContain('<select value={draft.lastJobYear')
    expect(styles).toContain('Brain Drain 2026-09-04 16:15 BST — Contractors workspace')
    expect(styles).toContain('.contractor-card-grid')
    expect(styles).toContain('.contractor-document-photo')
  })
})
