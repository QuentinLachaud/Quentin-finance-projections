export const userAvatarUrl = (user) => user?.user_metadata?.avatar_url
  || user?.user_metadata?.picture
  || ''

export const accentOptions = [
  { id: 'forest', label: 'Forest', description: 'Grounded & established', swatch: '#1c6b50' },
  { id: 'teal', label: 'Teal', description: 'Modern & calm', swatch: '#0f766e' },
  { id: 'ocean', label: 'Ocean', description: 'Clear & financial', swatch: '#2563eb' },
  { id: 'indigo', label: 'Indigo', description: 'Premium & focused', swatch: '#5b4bc4' },
  { id: 'amber', label: 'Amber', description: 'Warm & property-led', swatch: '#a85f08' },
  { id: 'monochrome', label: 'Monochrome', description: 'Cool & serious', swatch: '#34383b' },
]

export const accentStorageKey = (userId) => `btl-accent:${userId}`

export const initialAccent = (storedAccent) => accentOptions.some((option) => option.id === storedAccent)
  ? storedAccent
  : 'forest'

export const initialTheme = (storedTheme, prefersDark = false) => storedTheme === 'dark' || storedTheme === 'light'
  ? storedTheme
  : prefersDark ? 'dark' : 'light'

