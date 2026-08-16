export const userAvatarUrl = (user) => user?.user_metadata?.avatar_url
  || user?.user_metadata?.picture
  || ''

export const initialTheme = (storedTheme, prefersDark = false) => storedTheme === 'dark' || storedTheme === 'light'
  ? storedTheme
  : prefersDark ? 'dark' : 'light'

