import { describe, expect, it } from 'vitest'
import {
  bufferProgress,
  bufferVisualTarget,
  interpolateBufferVisual,
} from './bufferAnimation.js'

describe('Safety Cash Buffer animation', () => {
  it('recalculates wheel progress when the cash target changes', () => {
    expect(bufferProgress(12000, 12000)).toBe(100)
    expect(bufferProgress(12000, 24000)).toBe(50)
    expect(bufferProgress(12000, 48000)).toBe(25)
  })

  it('produces an intermediate frame instead of jumping directly to a new target', () => {
    const from = bufferVisualTarget(12000, 12000)
    const to = bufferVisualTarget(12000, 24000)
    const halfway = interpolateBufferVisual(from, to, 0.5)

    expect(halfway.progress).toBeLessThan(100)
    expect(halfway.progress).toBeGreaterThan(50)
    expect(halfway.progress).not.toBe(to.progress)
  })

  it('lands exactly on the new wheel progress and colour at the end of the animation', () => {
    const from = bufferVisualTarget(12000, 48000)
    const to = bufferVisualTarget(12000, 10000)
    expect(interpolateBufferVisual(from, to, 1)).toEqual(to)
  })

  it('interpolates threshold colour changes instead of switching colour instantly', () => {
    const from = bufferVisualTarget(2000, 10000)
    const to = bufferVisualTarget(12000, 10000)
    const halfway = interpolateBufferVisual(from, to, 0.5)

    expect(halfway.colour).not.toBe(from.colour)
    expect(halfway.colour).not.toBe(to.colour)
    expect(halfway.colour).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
