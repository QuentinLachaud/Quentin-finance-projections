import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Remortgage Simulator small-screen card layout', () => {
  it('stacks expanded comparison cards before they become squeezed', () => {
    expect(styles).toMatch(
      /@media \(max-width: 920px\)[\s\S]*?\.remortgage-comparison-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
    )
    expect(styles).toMatch(
      /@media \(max-width: 920px\)[\s\S]*?\.remortgage-arrow\s*\{[\s\S]*?transform:\s*rotate\(90deg\)/
    )
  })

  it('does not reserve a permanent right-side action rail on phones', () => {
    expect(styles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.remortgage-summary-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
    )
    expect(styles).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.remortgage-summary-actions\s*\{[\s\S]*?border-top:\s*1px solid var\(--ui-line\)/
    )
  })

  it('uses an intentional two-row saved-card summary on very narrow phones', () => {
    expect(styles).toMatch(
      /@media \(max-width: 420px\)[\s\S]*?grid-template-areas:[\s\S]*?"name cash"[\s\S]*?"rates rates"/
    )
  })
})
