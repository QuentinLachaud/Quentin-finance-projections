import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('touch-device page zoom lock', () => {
  it('locks the mobile viewport scale', () => {
    expect(index).toContain(
      'content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"'
    )
  })

  it('blocks Safari gesture zoom only on coarse touch devices', () => {
    expect(main).toContain("window.matchMedia('(hover: none) and (pointer: coarse)')")
    expect(main).toContain("document.addEventListener('gesturestart'")
    expect(main).toContain("document.addEventListener('gesturechange'")
    expect(main).toContain("document.addEventListener('gestureend'")
    expect(main).toContain("document.addEventListener('touchmove'")
    expect(main).toContain('if (event.touches?.length > 1) event.preventDefault()')
  })

  it('preserves ordinary touch panning while excluding pinch zoom', () => {
    expect(styles).toContain('disable page zoom on touch devices')
    expect(styles).toMatch(
      /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?touch-action:\s*pan-x pan-y/
    )
    expect(styles).toMatch(/touch-action:\s*manipulation/)
  })
})
