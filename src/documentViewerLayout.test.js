import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const fixedLayout = styles.slice(styles.indexOf('/* Document viewer fixed grid placement */'))

describe('document viewer layout regression', () => {
  it('pins desktop viewer chrome and preview to stable rows when rename is closed', () => {
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-header { grid-row: 1; }')
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-rename-panel { grid-row: 2; }')
    expect(fixedLayout).toContain('grid-row: 3;\n  min-height: 0;\n  height: 100%;')
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-toolbar { grid-row: 4; }')
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-stage iframe {')
    expect(fixedLayout).toContain('height: 100%;\n  min-height: 0;')
  })

  it('keeps mobile chrome in deterministic rows and adds no desktop min-width media query', () => {
    expect(fixedLayout).not.toContain('@media (min-width:')
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-grabber { grid-row: 1; }')
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-header { grid-row: 2; }')
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-rename-panel { grid-row: 3; }')
    expect(fixedLayout).toContain('.document-viewer-polished .document-viewer-toolbar { grid-row: 5; }')
  })
})
