import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const viewer = readFileSync(new URL('./DocumentViewer.jsx', import.meta.url), 'utf8')
const scrolling = styles.slice(styles.indexOf('/* Document viewer scroll containment */'))

describe('document viewer scroll containment', () => {
  it('uses one constrained flex preview area instead of relying on conditional grid rows', () => {
    expect(scrolling).toContain('.document-viewer-sheet.document-viewer-polished {')
    expect(scrolling).toContain('display: flex;')
    expect(scrolling).toContain('flex-direction: column;')
    expect(scrolling).toContain('.document-viewer-polished .document-viewer-stage {')
    expect(scrolling).toContain('flex: 1 1 0;')
    expect(scrolling).toContain('min-height: 0;')
  })

  it('makes PDF and image preview surfaces touch-scrollable while chrome remains outside them', () => {
    expect(scrolling).toContain('.document-viewer-stage.pdf {')
    expect(scrolling).toContain('overflow: auto;')
    expect(scrolling).toContain('-webkit-overflow-scrolling: touch;')
    expect(scrolling).toContain('touch-action: pan-x pan-y;')
    expect(scrolling).toContain('.document-viewer-image-scroll {')
    expect(scrolling).toContain('.document-viewer-pdf-page {')
    expect(scrolling).toContain('margin-inline: auto;')
  })

  it('keeps the mobile modal viewport-bounded and continues to use in-app PDF canvas pages', () => {
    expect(scrolling).toContain('height: calc(100dvh - max(env(safe-area-inset-top), 8px));')
    expect(scrolling).toContain('max-height: calc(100dvh - max(env(safe-area-inset-top), 8px));')
    expect(viewer).toContain('PdfCanvasPreview')
    expect(viewer).toContain('className="document-viewer-pdf-pages"')
    expect(viewer).not.toContain("kind === 'pdf' && <iframe")
  })
})
