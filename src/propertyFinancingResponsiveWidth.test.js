import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-08-26 17:59 BST — responsive financing reading width */'
const start = styles.indexOf(marker)
const next = start >= 0 ? styles.indexOf('/* Brain Drain ', start + marker.length) : -1
const block = start >= 0 ? styles.slice(start, next >= 0 ? next : undefined) : ''
const newMarker = '/* Brain Drain 2026-08-26 22:02 BST — purpose-built Overview property views */'
const newStart = styles.indexOf(newMarker)
const newBlock = newStart >= 0 ? styles.slice(newStart) : ''

describe('responsive Overview Row financing reading width', () => {
  it('caps and centers the expanded Row financing cluster on desktop', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    const desktop = block.match(/@media \(min-width: 1181px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(desktop).toContain('.overview-property-row-inner > .property-financing-row')
    expect(desktop).toContain('width: min(640px, calc(100% - 116px))')
    expect(desktop).toContain('max-width: 640px')
    expect(desktop).toContain('margin-inline: auto')
  })

  it('uses the narrower centered financing cluster on iPad/tablet', () => {
    const tablet = block.match(/@media \(min-width: 761px\) and \(max-width: 1180px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(tablet).toContain('.overview-property-row-inner > .property-financing-row')
    expect(tablet).toContain('width: min(560px, calc(100% - 64px))')
    expect(tablet).toContain('max-width: 560px')
  })

  it('uses grouped-list insets for detailed financing on phones', () => {
    const phone = block.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(phone).toContain('width: calc(100% - 28px)')
    expect(phone).toContain('max-width: none')
    expect(phone).toContain('margin-inline: 14px')
  })

  it('aligns the new lender and Open-property detail rows to the same reading cluster', () => {
    expect(newStart).toBeGreaterThanOrEqual(0)
    expect(newBlock).toMatch(/\.overview-property-row-lender,\s*\.overview-property-row-open-action\s*\{[\s\S]*?width:\s*min\(640px, calc\(100% - 116px\)\)[\s\S]*?max-width:\s*640px/)
    expect(newBlock).toMatch(/@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?width:\s*min\(560px, calc\(100% - 64px\)\)/)
    expect(newBlock).toMatch(/@media \(max-width: 760px\)[\s\S]*?width:\s*calc\(100% - 28px\)[\s\S]*?margin-inline:\s*14px/)
  })

  it('keeps the detailed Row financing bar compact', () => {
    expect(styles).toContain('compact iOS-native property financing')
    expect(styles).toMatch(/\.property-financing-row \.property-financing-track\s*\{[\s\S]*?height:\s*9px !important/)
  })
})
