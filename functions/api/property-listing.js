const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
})

const authenticateUser = async (request, env) => {
  const authorization = request.headers.get('authorization')
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !supabaseKey) return false
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { authorization, apikey: supabaseKey } })
  return response.ok
}

const allowedProvider = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '')
  if (host === 'rightmove.co.uk' || host.endsWith('.rightmove.co.uk')) return 'Rightmove'
  if (host === 'zoopla.co.uk' || host.endsWith('.zoopla.co.uk')) return 'Zoopla'
  return ''
}

export const validateListingUrl = (value) => {
  let parsed
  try { parsed = new URL(String(value || '').trim()) } catch { return { error: 'Enter a valid Rightmove or Zoopla URL.' } }
  if (!['https:', 'http:'].includes(parsed.protocol)) return { error: 'Only web listing URLs are supported.' }
  const provider = allowedProvider(parsed.hostname)
  if (!provider) return { error: 'Only Rightmove and Zoopla listing URLs are supported.' }
  return { url: parsed, provider }
}

const numberFromText = (value) => {
  const parsed = Number(String(value || '').replace(/[£,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : ''
}

const structuredObjects = (html) => {
  const output = []
  const collect = (value) => {
    if (!value) return
    if (Array.isArray(value)) return value.forEach(collect)
    if (typeof value !== 'object') return
    output.push(value)
    Object.values(value).forEach((child) => child && typeof child === 'object' && collect(child))
  }
  for (const match of String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collect(JSON.parse(match[1])) } catch { /* fallback below */ }
  }
  return output
}

export const parseListingHtml = (html, sourceUrl = '') => {
  const source = String(html || '')
  const structured = structuredObjects(source)
    .map((object) => object?.price ?? object?.offers?.price ?? object?.priceSpecification?.price)
    .find((value) => value !== undefined && value !== null && value !== '')
  const embedded = source.match(/"price"\s*:\s*\{\s*"amount"\s*:\s*(\d{4,9})/i)
    || source.match(/"(?:price|displayPrice|askingPrice)"\s*:\s*(\d{4,9})/i)
  const visibleText = source.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&pound;/gi,'£').replace(/\s+/g,' ')
  const visible = visibleText.match(/(?:guide price|offers over|fixed price|asking price|offers in excess of|price)?[^£]{0,30}£\s*([\d,]{5,})/i)
  return {
    sourceUrl,
    purchasePrice: numberFromText(structured) || numberFromText(embedded?.[1]) || numberFromText(visible?.[1]),
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!await authenticateUser(request, env)) return json({ error: 'Your session could not be verified.' }, 401)
    const body = await request.json().catch(() => ({}))
    const validation = validateListingUrl(body.url)
    if (validation.error) return json({ error: validation.error }, 400)
    const response = await fetch(validation.url.toString(), {
      redirect: 'follow',
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Mozilla/5.0 (compatible; BTLPortfolio/1.0; +https://btlportfolio.co.uk)' },
    })
    if (!response.ok) return json({ error: `${validation.provider} did not allow this listing to be read automatically. Enter the price manually.`, code: 'listing_unavailable' }, 502)
    if (Number(response.headers.get('content-length') || 0) > 5_000_000) return json({ error: 'This listing page is too large to import safely.' }, 413)
    const listing = parseListingHtml(await response.text(), validation.url.toString())
    return json({
      provider: validation.provider,
      listing,
      warning: listing.purchasePrice ? '' : 'The purchase price could not be read from this listing. Enter it manually before confirming.',
    })
  } catch (error) {
    return json({ error: error?.message || 'The listing could not be imported. Enter the price manually.' }, 502)
  }
}
