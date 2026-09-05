import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.jsx', 'utf8')
const timeline = readFileSync('src/propertyTimeline.js', 'utf8')
const ui = readFileSync('src/PropertyTimeline.jsx', 'utf8')
const moneyInput = readFileSync('src/MoneyPeriodInput.jsx', 'utf8')

describe('property timeline integration', () => {
  it('lives inside Properties rather than adding another global workspace', () => {
    expect(app).toContain("const [propertyWorkspaceView, setPropertyWorkspaceView] = useState('compare')")
    expect(app).toContain("propertyWorkspaceView === 'timeline' ? <PropertyTimeline")
    expect(app).toContain('Compare')
    expect(app).toContain('Timeline')
    expect(app).not.toContain("['Timeline', 'Timeline'")
  })

  it('persists only stored manual/change events in the existing portfolio JSON state', () => {
    expect(app).toContain('propertyTimelineEvents: normalizePropertyTimelineEvents(portfolioState.propertyTimelineEvents, migratedProperties)')
    expect(app).toContain('propertyTimelineEvents: [...(current.propertyTimelineEvents || []), ...timelineChanges]')
    expect(timeline).toContain('complianceDiaryItems([{ ...property, active: true }])')
    expect(timeline).toContain('normalizeDocumentMeta(entry.document)')
    expect(timeline).toContain("title: 'Property purchased'")
    expect(app).not.toContain("from('property_timeline")
  })

  it('captures overwrite-prone changes at save/commit boundaries rather than per keystroke', () => {
    expect(app).toContain('propertyChangeEvents(previousProperty, effectiveProperty)')
    expect(app).toContain('loanChangeEvents(previousLoan, nextLoan, draft.id)')
    expect(app).toContain('const commitPropertyTimelineField =')
    expect(app).toContain("onPropertyCommit={commitPropertyTimelineField}")
    expect(moneyInput).toContain('onCommit')
    expect(moneyInput).toContain('editStartValue.current')
  })

  it('reuses existing workspaces for source records and the shared document capture flow', () => {
    expect(app).toContain("if (['document', 'expense'].includes(event.sourceType)) setSection('Documents & Expenses')")
    expect(app).toContain("if (['loan', 'loan-change'].includes(event.sourceType)) setSection('Loans')")
    expect(app).toContain("if (event.sourceType === 'tenant') setSection('Tenants')")
    expect(app).toContain('setDocumentCaptureRequest({ propertyId, nonce: Date.now() })')
    expect(ui).toContain('Add document')
  })

  it('keeps contractor/property associations consistent for manual events and removes stored history with deleted properties', () => {
    expect(app).toContain('const savePropertyTimelineEvent =')
    expect(app).toContain('propertyIds: [...new Set([...(contractor.propertyIds || []), normalized.propertyId])]')
    expect(app).toContain('propertyTimelineEvents: (current.propertyTimelineEvents || []).filter((event) => event.propertyId !== id)')
  })
})
