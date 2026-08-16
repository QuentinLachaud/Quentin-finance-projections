export const supportConfig = ({ enabled, url } = {}) => {
  const normalizedUrl = String(url || '').trim()
  const isBuyMeACoffee = /^https:\/\/(?:www\.)?buymeacoffee\.com\/[A-Za-z0-9_.-]+\/?$/i.test(normalizedUrl)
  return {
    enabled: enabled !== 'false' && isBuyMeACoffee,
    url: isBuyMeACoffee ? normalizedUrl : '',
  }
}
