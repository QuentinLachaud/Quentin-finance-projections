import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const viewer = readFileSync(new URL('./DocumentViewer.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('mobile document viewer repair', () => {
  it('renders PDFs as in-app canvas pages instead of the fragile iOS PDF iframe', () => {
    expect(viewer).toContain("import('pdfjs-dist')")
    expect(viewer).toContain("import('pdfjs-dist/build/pdf.worker.min.mjs?url')")
    expect(viewer).toContain('<PdfCanvasPreview signedUrl={signedUrl} zoom={zoom}')
    expect(viewer).not.toContain("['pdf', 'text'].includes(kind)")
    expect(viewer).toContain("kind === 'text' && <iframe")
  })

  it('gives PDFs the same reachable zoom, download, rename and close UX as images', () => {
    expect(viewer).toContain("const zoomable = kind === 'image' || kind === 'pdf'")
    expect(viewer).toContain('aria-label="Close viewer"')
    expect(viewer).toContain('aria-label="Download file"')
    expect(viewer).toContain('aria-label="Rename file"')
    expect(styles).toContain('Mobile document viewer repair')
    expect(styles).toContain('height:calc(100dvh - max(env(safe-area-inset-top),8px))')
    expect(styles).toContain('.document-viewer-pdf-pages')
    expect(styles).toContain('env(safe-area-inset-bottom)')
  })
})
