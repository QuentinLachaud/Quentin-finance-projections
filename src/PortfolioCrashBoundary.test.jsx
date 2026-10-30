// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PortfolioCrashBoundary from './PortfolioCrashBoundary.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Crash() {
  throw new Error('Synthetic desktop render failure')
}

function StartupHarness() {
  const [ready, setReady] = useState(false)
  return <>
    <PortfolioCrashBoundary onError={() => setReady(true)}>
      <Crash />
    </PortfolioCrashBoundary>
    {!ready && <div role="status">Animated logo</div>}
  </>
}

afterEach(() => { vi.restoreAllMocks() })

describe('portfolio startup crash recovery', () => {
  it('unmasks the recovery screen if an authenticated portfolio crashes while the logo is shown', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => { root.render(<StartupHarness />) })
      expect(container.querySelector('[role="status"]')).toBeNull()
      const error = container.querySelector('[role="alert"]')
      expect(error).not.toBeNull()
      expect(error.textContent).toContain('We couldn’t display your portfolio')
      expect(error.textContent).toContain('Synthetic desktop render failure')
      expect(error.textContent).toContain('Try again')
      expect(consoleError).toHaveBeenCalled()
    } finally {
      await act(async () => { root.unmount() })
      container.remove()
    }
  })
})
