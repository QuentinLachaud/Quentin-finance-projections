import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const push = readFileSync(new URL('./notificationPush.js', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./mobilePush.css', import.meta.url), 'utf8')

describe('mobile-only push settings', () => {
  it('gates all push subscription work to phone-sized touch devices', () => {
    expect(push).toContain("mobileMediaMatches('(max-width: 760px)')")
    expect(push).toContain("mobileMediaMatches('(pointer: coarse)')")
    expect(push).toContain("return { status: 'mobile-only' }")
    expect(push).toContain("fetch('/api/push-config'")
  })

  it('hides the existing push control on desktop and restores it only at the mobile breakpoint', () => {
    expect(styles).toContain(".settings-toggle-row:has(.settings-switch[aria-label='Push notifications'])")
    expect(styles).toContain('display: none;')
    expect(styles).toContain('@media (max-width: 760px)')
    expect(styles).toContain('display: flex;')
  })
})
