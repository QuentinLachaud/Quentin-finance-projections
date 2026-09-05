import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const viewer = readFileSync(new URL('./DocumentViewer.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const scrollStyles = styles.slice(styles.indexOf('/* Document viewer explicit inner scroll viewport */'))

describe('document viewer explicit scroll viewport', () => {
  it('renders a dedicated focusable scroll region inside the constrained stage', () => {
    expect(viewer).toContain('document-viewer-scroll-region')
    expect(viewer).toContain('aria-label="Document preview"')
    expect(viewer).toContain('tabIndex={0}')
    expect(viewer.indexOf('document-viewer-scroll-region')).toBeGreaterThan(viewer.indexOf('document-viewer-stage'))
    expect(viewer.indexOf('PdfCanvasPreview signedUrl')).toBeGreaterThan(viewer.indexOf('document-viewer-scroll-region'))
  })

  it('clips the flex stage and makes the inner viewport the actual overflow owner', () => {
    expect(scrollStyles).toContain('.document-viewer-polished .document-viewer-stage {')
    expect(scrollStyles).toContain('position: relative;')
    expect(scrollStyles).toContain('overflow: hidden !important;')
    expect(scrollStyles).toContain('.document-viewer-scroll-region {')
    expect(scrollStyles).toContain('position: absolute;')
    expect(scrollStyles).toContain('inset: 0;')
    expect(scrollStyles).toContain('overflow: auto;')
    expect(scrollStyles).toContain('touch-action: pan-x pan-y;')
  })

  it('keeps PDF pages in vertical flow and allows canvas overflow when zoomed', () => {
    expect(scrollStyles).toContain('.document-viewer-scroll-region.pdf .document-viewer-pdf-pages {')
    expect(scrollStyles).toContain('min-height: max-content;')
    expect(scrollStyles).toContain('align-items: center;')
    expect(scrollStyles).toContain('.document-viewer-scroll-region.pdf .document-viewer-pdf-page {')
    expect(scrollStyles).toContain('overflow: visible;')
  })
})
