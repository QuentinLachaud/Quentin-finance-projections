import { describe, expect, it } from 'vitest'
import { mergeRemotePortfolio, serverVersionIsNewer } from './portfolioSync.js'

describe('cross-device portfolio sync', () => {
  it('only accepts genuinely newer server versions', () => {
    expect(serverVersionIsNewer('2026-09-04T20:10:00Z', '2026-09-04T20:00:00Z')).toBe(true)
    expect(serverVersionIsNewer('2026-09-04T19:59:00Z', '2026-09-04T20:00:00Z')).toBe(false)
    expect(serverVersionIsNewer('2026-09-04T20:00:00Z', '2026-09-04T20:00:00Z')).toBe(false)
  })

  it('takes remote collections while retaining local default settings not present remotely', () => {
    const merged = mergeRemotePortfolio(
      { expenses: [{ id: 'old' }], settings: { theme: 'light', bufferMonths: 6 } },
      { expenses: [{ id: 'mobile-document' }], settings: { bufferMonths: 8 } },
    )
    expect(merged.expenses).toEqual([{ id: 'mobile-document' }])
    expect(merged.settings).toEqual({ theme: 'light', bufferMonths: 8 })
  })
})
