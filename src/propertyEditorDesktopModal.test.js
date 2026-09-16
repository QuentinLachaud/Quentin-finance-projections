import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const marker = '/* Brain Drain 2026-09-16 20:44 BST — centred desktop property editor modal */'
const editorStart = app.indexOf('function EditDrawer(')
const editorEnd = app.indexOf('\nfunction ModelInputsPopup', editorStart)
const editor = editorStart >= 0 && editorEnd > editorStart ? app.slice(editorStart, editorEnd) : ''
const markerAt = styles.indexOf(marker)
const nextMarkerAt = markerAt >= 0 ? styles.indexOf('/* Brain Drain ', markerAt + marker.length) : -1
const modalStyles = markerAt >= 0 ? styles.slice(markerAt, nextMarkerAt >= 0 ? nextMarkerAt : styles.length) : ''

describe('desktop property editor modal', () => {
  it('exposes EditDrawer as a proper modal and locks background scrolling', () => {
    expect(editor).not.toBe('')
    expect(editor).toContain('className="drawer" role="dialog" aria-modal="true" aria-labelledby="property-editor-title"')
    expect(editor).toContain('id="property-editor-title"')
    expect(editor).toContain("const onKeyDown = (event) => event.key === 'Escape' && onClose()")
    expect(editor).toContain("document.body.style.overflow = 'hidden'")
    expect(editor).toContain('document.body.style.overflow = previousOverflow')
  })

  it('centres and bounds the property editor at desktop widths only', () => {
    expect(markerAt).toBeGreaterThanOrEqual(0)
    expect(modalStyles).toContain('@media (min-width: 761px)')
    expect(modalStyles).not.toContain('@media (max-width:')
    expect(modalStyles).toMatch(/\.drawer-layer\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/)
    expect(modalStyles).toMatch(/\.drawer\s*\{[\s\S]*?width:\s*min\(820px, calc\(100vw - 64px\)\);[\s\S]*?max-height:\s*calc\(100dvh - 64px\);[\s\S]*?border-radius:\s*22px;/)
  })

  it('keeps long forms scrolling inside the modal with a separate action bar', () => {
    expect(modalStyles).toMatch(/\.drawer-body\s*\{[\s\S]*?overflow-y:\s*auto;/)
    expect(modalStyles).toMatch(/\.drawer > footer\s*\{[\s\S]*?border-top:\s*1px solid var\(--ui-line\);/)
    expect(modalStyles).toContain('prefers-reduced-motion: no-preference')
  })
})
