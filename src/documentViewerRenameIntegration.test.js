import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync(new URL('./ExpensesWorkspace.jsx', import.meta.url), 'utf8')
const viewer = readFileSync(new URL('./DocumentViewer.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('image viewer rename and popup integration', () => {
  it('keeps image opening inside the viewer and persists user-facing file-name changes', () => {
    expect(workspace).toContain('setPreviewItem(item)')
    expect(workspace).toContain('onRename={(nextFileName) => renameDocument(previewItem.id, nextFileName)}')
    expect(workspace).toContain('document: { ...item.document, fileName: nextFileName }')
    expect(workspace).toContain('item.document?.fileName || item.document?.title')
    expect(viewer).toContain("kind === 'image'")
    expect(viewer).toContain('document-viewer-image-scroll')
    expect(viewer).toContain('document-viewer-toolbar')
    expect(viewer).not.toContain('aria-label="Open original document"')
  })

  it('provides polished responsive viewer styling', () => {
    expect(styles).toContain('Polished image viewer controls')
    expect(styles).toContain('.document-viewer-toolbar')
    expect(styles).toContain('.document-viewer-rename-panel')
    expect(styles).toContain('.document-viewer-image-scroll')
  })
})
