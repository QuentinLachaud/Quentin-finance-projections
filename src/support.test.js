import { describe, expect, it } from 'vitest'
import { supportConfig } from './support.js'

describe('support link configuration', () => {
  it('activates only for a configured Buy Me a Coffee creator page', () => {
    expect(supportConfig({ enabled: 'true', url: 'https://buymeacoffee.com/btlportfolio' })).toEqual({ enabled: true, url: 'https://buymeacoffee.com/btlportfolio' })
    expect(supportConfig({ enabled: 'false', url: 'https://buymeacoffee.com/btlportfolio' }).enabled).toBe(false)
    expect(supportConfig({ enabled: 'true', url: 'https://example.com/pay' })).toEqual({ enabled: false, url: '' })
  })
})
