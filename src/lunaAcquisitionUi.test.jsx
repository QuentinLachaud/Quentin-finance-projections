// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TimeToNextBtl from './TimeToNextBtl.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const syntheticProjection = Array.from({ length: 25 }, (_, month) => ({
  month,
  scenarios: [0, 1, 2].map(() => ({ cashPot: 12000 + month * 8000, cashflow: month * 8000 })),
}))

let root
let host

afterEach(() => {
  if (root) act(() => root.unmount())
  host?.remove()
  root = null
  host = null
})

describe('Luna acquisition scenario handoff', () => {
  it('prefills the existing planner and exposes its recalculated deterministic result', () => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    const onPreferencesChange = vi.fn()

    act(() => root.render(<TimeToNextBtl
      properties={[]}
      settings={{ accountType: 'company', cashHeld: 12000, taxJurisdiction: 'scotland' }}
      portfolio={{ cashHeld: 12000, fixedCosts: 600, variableCosts: 400 }}
      projectionPoints={syntheticProjection}
      now={new Date('2026-01-15T12:00:00')}
      scenarioRequest={{ id: 'luna-scenario-1', fields: { purchasePrice: 200000 } }}
      onPreferencesChange={onPreferencesChange}
    />))

    const price = host.querySelector('[aria-label="BTL price today"]')
    expect(price).not.toBeNull()
    expect(price.value).toBe('200000')
    expect(host.textContent).toContain('Manual target · £200,000')
    expect(host.textContent).toContain('ESTIMATED PURCHASE WINDOW')
    expect(host.querySelector('.next-btl-chart')).not.toBeNull()
    expect(onPreferencesChange).not.toHaveBeenCalled()
  })
})
