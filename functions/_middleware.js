const CANONICAL_HOST = 'btlportfolio.co.uk'
const REDIRECT_HOSTS = new Set([
  'www.btlportfolio.co.uk',
  'quentin-finance-projections.pages.dev',
])

export async function onRequest(context) {
  const url = new URL(context.request.url)

  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.protocol = 'https:'
    url.hostname = CANONICAL_HOST
    url.port = ''
    return Response.redirect(url.toString(), 301)
  }

  return context.next()
}
