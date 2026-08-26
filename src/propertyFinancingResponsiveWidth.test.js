import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8')
const marker = '/* Brain Drain 2026-08-26 17:59 BST — responsive financing reading width */'
const start = styles.indexOf(marker)
const block = start >= 0 ? styles.slice(start) : ''

describe('responsive Overview financing reading width', () => {
  it('keeps Cards and Mini local to their own card width', () => {
    expect(start).toBeGreaterThanOrEqual(0)
    expect(block).toMatch(/\.property-financing-card,\s*\.property-financing-mini\s*\{[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*none/)
  })

  it('caps and centers the expanded Row reading cluster on desktop', () => {
    const desktop = block.match(/@media \(min-width: 1181px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(desktop).toContain('.overview-property-row-inner > .property-financing-row')
    expect(desktop).toContain('.overview-property-row-inner > .overview-property-row-metrics')
    expect(desktop).toContain('.overview-property-row-inner > .overview-property-row-actions')
    expect(desktop).toContain('width: min(640px, calc(100% - 116px))')
    expect(desktop).toContain('max-width: 640px')
    expect(desktop).toContain('margin-inline: auto')
  })

  it('uses a narrower centered reading cluster on iPad/tablet', () => {
    const tablet = block.match(/@media \(min-width: 761px\) and \(max-width: 1180px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(tablet).toContain('.overview-property-row-inner > .property-financing-row')
    expect(tablet).toContain('width: min(560px, calc(100% - 64px))')
    expect(tablet).toContain('max-width: 560px')
    expect(tablet).toContain('margin-inline: auto')
  })

  it('uses normal grouped-list side insets on phones without a desktop cap', () => {
    const phone = block.match(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(phone).toContain('width: calc(100% - 28px)')
    expect(phone).toContain('max-width: none')
    expect(phone).toContain('margin-inline: 14px')
  })

  it('lets the responsive column control width rather than old wide internal padding', () => {
    expect(block).toMatch(/\.overview-property-row-inner > \.property-financing-row\s*\{[\s\S]*?padding-inline:\s*0[\s\S]*?border-bottom:\s*0/)
  })

  it('preserves the existing compact iOS-native sizing treatment', () => {
    expect(styles).toContain('compact iOS-native property financing')
    expect(styles).toMatch(/\.property-financing-card \.property-financing-track\s*\{[\s\S]*?height:\s*10px !important/)
    expect(styles).toMatch(/\.property-financing-row \.property-financing-track\s*\{[\s\S]*?height:\s*9px !important/)
    expect(styles).toMatch(/\.property-financing-mini \.property-financing-track\s*\{[\s\S]*?height:\s*8px !important/)
  })
})

