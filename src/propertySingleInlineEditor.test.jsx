import React from 'react'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PropertyLoansEditor from './PropertyLoansEditor.jsx'
import { createBlankProperty } from './data.js'
import { createBlankLoan } from './loans.js'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('single BTL inline editor', () => {
  it('adds one inline Properties view alongside Compare and Timeline', () => {
    expect(app).toContain('Single property</button>')
    expect(app).toContain("propertyWorkspaceView === 'single' ? <div className=\"property-single-workspace\"")
    expect(app).toContain('aria-label="Select property to edit"')
    expect(app).toContain('key={singleProperty.id} inline property={singleProperty}')
    expect(app).toContain("propertyWorkspaceView === 'timeline' ? <PropertyTimeline")
    expect(app).toContain('property-comparison-table')
  })

  it('reuses canonical property fields and the existing property/loan save pathway', () => {
    expect(app).toContain('editableFieldsFor(PROPERTY_EDITOR_CORE_KEYS)')
    expect(app).toContain('PROPERTY_EDITOR_OPTIONAL_SECTIONS.map')
    expect(app).toContain('open={inline || undefined}')
    expect(app).toContain('expandAll={inline}')
    expect(app).toContain('onSave={saveProperty}')
    expect(app).toContain('const synced = syncPropertyTenant(normalizePropertyRecord(draft), current.tenants)')
    expect(app).toContain('const next = savePropertyLoans(current, synced.property, intendedLoans, removedLoanIds)')
    expect(app).toContain('...propertyChangeEvents(previousProperty, effectiveProperty)')
    expect(app).toContain('className="panel property-single-editor"')
  })

  it('protects uncommitted changes while switching views or selected BTL', () => {
    expect(app).toContain("window.confirm('Discard unsaved property changes?')")
    expect(app).toContain('disabled={inline && !dirty}')
    expect(app).toContain('onDirtyChange={setSinglePropertyDirty}')
    expect(app).toContain('setDirty(false)')
  })

  it('renders every existing loan editor immediately in inline mode', () => {
    const property = createBlankProperty('BTL1')
    const loan = { ...createBlankLoan(), propertyId: property.id, lender: 'Demo lender' }
    const markup = renderToStaticMarkup(<PropertyLoansEditor property={property} loans={[loan]} onChange={() => {}} onRemove={() => {}} expandAll />)
    expect(markup).toContain('Demo lender')
    expect(markup).toContain('property-loan-heading-static')
    expect(markup).toContain('loan-editor-field')
    expect(markup).not.toContain('aria-expanded="false"')
  })

  it('keeps the inline form scrollable and makes its selector visible on mobile', () => {
    expect(styles).toContain('.property-single-editor .drawer-body { overflow: visible; max-height: none;')
    expect(styles).toContain('.properties-controls-bar.property-single-controls { display: flex;')
    expect(styles).toContain('.property-single-editor .property-editor-disclosure > summary { cursor: default; pointer-events: none; }')
  })
})
