import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('desktop property editor prefilled values', () => {
  it('opens the editor from the stored raw property rather than a blank property', () => {
    expect(app).toContain(
      "const editing = pendingProperty || state.properties.find((p) => p.id === editingId)"
    )
    expect(app).toContain("function EditDrawer({ property, onSave, onClose, onDelete, isNew, focusField = '' })")
    expect(app).toContain('const [draft, setDraft] = useState(property)')
    expect(app).toContain('useEffect(() => setDraft(property), [property])')
  })

  it('binds each desktop editor field to the current draft value', () => {
    expect(app).toContain(
      "value={type === 'percent' ? percentInputValue(draft[key]) : type === 'date' ? dateInputValue(draft[key]) : draft[key] ?? ''}"
    )
  })

  it('explicitly renders bound field values in desktop light and dark themes', () => {
    expect(styles).toContain('desktop property editor visible prefill')
    expect(styles).toMatch(
      /@media \(min-width: 761px\)[\s\S]*?\.drawer \.form-grid input\s*\{[\s\S]*?color:\s*var\(--ui-text\)[\s\S]*?-webkit-text-fill-color:\s*var\(--ui-text\)/
    )
    expect(styles).toMatch(
      /:root\[data-theme='dark'\] \.drawer \.form-grid input\s*\{[\s\S]*?color-scheme:\s*dark/
    )
  })

  it('keeps the correction desktop-only so the working mobile editor is untouched', () => {
    const marker = styles.indexOf(
      '/* Brain Drain 2026-08-23 12:40 BST — desktop property editor visible prefill */'
    )
    const nextMarker = marker >= 0 ? styles.indexOf('/* Brain Drain ', marker + 1) : -1
    const block = marker >= 0
      ? styles.slice(marker, nextMarker >= 0 ? nextMarker : styles.length)
      : ''
    expect(block).toContain('@media (min-width: 761px)')
    expect(block).not.toContain('@media (max-width:')
  })
})
