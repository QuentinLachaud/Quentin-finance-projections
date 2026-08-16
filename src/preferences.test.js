import { describe, expect, it } from 'vitest'
import { initialTheme, userAvatarUrl } from './preferences.js'

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
})
