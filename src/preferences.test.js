import { describe, expect, it } from 'vitest'
import { accentOptions, accentStorageKey, initialAccent, initialTheme, userAvatarUrl } from './preferences.js'

describe('display preferences', () => {
  it('uses the Google avatar metadata with a compatible picture fallback', () => {
    expect(userAvatarUrl({ user_metadata: { avatar_url: 'https://example.com/google.jpg', picture: 'fallback.jpg' } })).toBe('https://example.com/google.jpg')
    expect(userAvatarUrl({ user_metadata: { picture: 'https://example.com/picture.jpg' } })).toBe('https://example.com/picture.jpg')
    expect(userAvatarUrl({ user_metadata: {} })).toBe('')
  })

  it('restores an explicit theme and otherwise follows the device preference', () => {
    expect(initialTheme('light', true)).toBe('light')
    expect(initialTheme('dark', false)).toBe('dark')
    expect(initialTheme(null, true)).toBe('dark')
  })

  it('offers exactly six curated, well-formed accent palettes and safely falls back to Forest', () => {
    expect(accentOptions.map((option) => option.id)).toEqual(['forest', 'teal', 'ocean', 'indigo', 'amber', 'monochrome'])
    expect(accentOptions.map((option) => option.label)).toEqual(['Forest', 'Teal', 'Ocean', 'Indigo', 'Amber', 'Monochrome'])
    expect(new Set(accentOptions.map((option) => option.id)).size).toBe(6)
    accentOptions.forEach((option) => expect(option.swatch).toMatch(/^#[0-9a-f]{6}$/i))
    expect(initialAccent('ocean')).toBe('ocean')
    expect(initialAccent('monochrome')).toBe('monochrome')
    expect(initialAccent('not-a-theme')).toBe('forest')
    expect(initialAccent(null)).toBe('forest')
  })

  it('uses a separate local-storage key for each signed-in user', () => {
    expect(accentStorageKey('user-a')).toBe('btl-accent:user-a')
    expect(accentStorageKey('user-b')).toBe('btl-accent:user-b')
    expect(accentStorageKey('user-a')).not.toBe(accentStorageKey('user-b'))
  })
})
