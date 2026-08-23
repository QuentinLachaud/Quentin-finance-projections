import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import DeleteConfirmDialog from './DeleteConfirmDialog.jsx'

const acquisition = readFileSync(new URL('./AcquisitionSimulator.jsx', import.meta.url), 'utf8')
const remortgage = readFileSync(new URL('./RemortgageSimulator.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('iOS-native destructive confirmation', () => {
  it('renders accessible alert-dialog semantics and actions', () => {
    const html = renderToStaticMarkup(
      <DeleteConfirmDialog
        title="Delete BTL3?"
        message="This acquisition will be permanently removed."
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    )
    expect(html).toContain('role="alertdialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Delete BTL3?')
    expect(html).toContain('Cancel')
    expect(html).toContain('Delete')
  })

  it('replaces native browser confirmation in both simulators', () => {
    expect(acquisition).toContain("from './DeleteConfirmDialog.jsx'")
    expect(remortgage).toContain("from './DeleteConfirmDialog.jsx'")
    expect(acquisition).not.toContain('window.confirm(')
    expect(remortgage).not.toContain('window.confirm(')
  })

  it('requires explicit pending-delete confirmation before mutation', () => {
    expect(acquisition).toContain('pendingDelete')
    expect(acquisition).toContain('confirmRemove')
    expect(remortgage).toContain('pendingDelete')
    expect(remortgage).toContain('confirmRemoveComparison')
  })

  it('uses smooth iOS-style desktop/iPad alert and mobile sheet treatment', () => {
    expect(styles).toContain('iOS-native destructive confirmation')
    expect(styles).toContain('backdrop-filter: blur(12px)')
    expect(styles).toContain('@media (max-width: 680px)')
    expect(styles).toContain('delete-confirm-sheet-in')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
