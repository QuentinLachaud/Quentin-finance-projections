const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const easeOutCubic = (progress) => {
  const t = clamp(Number(progress) || 0, 0, 1)
  return 1 - ((1 - t) ** 3)
}

export const bufferProgress = (cashHeld, targetCash) => {
  const cash = Math.max(0, Number(cashHeld || 0))
  const target = Number(targetCash || 0)
  if (!Number.isFinite(target) || target <= 0) return 100
  return clamp((cash / target) * 100, 0, 100)
}

export const bufferColour = (cashHeld, targetCash) => {
  const target = Number(targetCash || 0)
  if (!Number.isFinite(target) || target <= 0) return '#27795c'
  const coverage = Math.max(0, Number(cashHeld || 0)) / target
  if (coverage >= 1) return '#27795c'
  if (coverage >= 0.5) return '#c7a23e'
  return '#b35c54'
}

const hexToRgb = (hex) => {
  const value = String(hex || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return { r: 39, g: 121, b: 92 }
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

const rgbToHex = ({ r, g, b }) => `#${[r, g, b]
  .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
  .join('')}`

export const interpolateHex = (from, to, progress) => {
  const t = clamp(Number(progress) || 0, 0, 1)
  const start = hexToRgb(from)
  const end = hexToRgb(to)
  return rgbToHex({
    r: start.r + ((end.r - start.r) * t),
    g: start.g + ((end.g - start.g) * t),
    b: start.b + ((end.b - start.b) * t),
  })
}

export const bufferVisualTarget = (cashHeld, targetCash) => ({
  progress: bufferProgress(cashHeld, targetCash),
  colour: bufferColour(cashHeld, targetCash),
})

export const bufferStrokeOffset = (progress) => 100 - clamp(Number(progress) || 0, 0, 100)

export const interpolateBufferVisual = (from, to, rawProgress) => {
  const eased = easeOutCubic(rawProgress)
  return {
    progress: Number(from.progress || 0) + ((Number(to.progress || 0) - Number(from.progress || 0)) * eased),
    colour: interpolateHex(from.colour, to.colour, eased),
  }
}
