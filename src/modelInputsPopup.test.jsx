import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync('src/App.jsx', 'utf8')
const styles = readFileSync('src/styles.css', 'utf8')

describe('corrected Model Inputs popup', () => {
  it('moves touch Model Inputs out of the inline tray form', () => {
    expect(app).toContain('sidebar-model-inputs-desktop')
    expect(app).toContain('model-inputs-popup-trigger')
    expect(app).toContain('modelInputsPopupOpen && <ModelInputsPopup')
    expect(app).toContain('setMobileNavOpen(false)')
  })

  it('preserves all current input groups including private landlord inputs', () => {
    expect(app).toContain('<ModelInputFields settings={settings}')
    expect(app).toContain('<ModelControls settings={settings}')
    expect(app).toContain('<PrivateLandlordInputs')
  })

  it('provides modal semantics and dismiss behavior', () => {
    expect(app).toContain('role="dialog"')
    expect(app).toContain('aria-modal="true"')
    expect(app).toContain("event.key === 'Escape'")
    expect(app).toContain('Changes save automatically.')
  })

  it('renders as phone sheet and touch-iPad popover', () => {
    expect(styles).toContain('corrected iOS Model Inputs popup')
    expect(styles).toContain('border-radius: 24px 24px 0 0')
    expect(styles).toContain('@media (hover: none) and (pointer: coarse) and (min-width: 761px) and (max-width: 1366px)')
    expect(styles).toContain('width: min(600px, calc(100vw - 48px))')
  })
})
