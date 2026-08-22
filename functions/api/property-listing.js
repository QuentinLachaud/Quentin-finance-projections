const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
  },
})

const authenticateUser = async (request, env) => {
  const authorization = request.headers.get('authorization')
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !supabaseKey) return false
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: supabaseKey },
  })
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
  try {
    parsed = new URL(String(value || '').trim())
  } catch {
    return { error: 'Enter a valid Rightmove or Zoopla URL.' }
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return { error: 'Only web listing URLs are supported.' }
  }

  const provider = allowedProvider(parsed.hostname)
  if (!provider) return { error: 'Only Rightmove and Zoopla listing URLs are supported.' }
  return { url: parsed, provider }
}

const decodeHtml = (value) => String(value || '')
  .replace(/&pound;/gi, '£')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

const compact = (value) => decodeHtml(value).replace(/\s+/g, ' ').trim()

const firstMatch = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return compact(match[1])
  }
  return ''
}

const numberFromText = (value) => {
  const cleaned = String(value || '').replace(/[£,\s]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : ''
}

const metaContent = (html, key) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return firstMatch(html, [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ])
}

const jsonLdObjects = (html) => {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const output = []

  const collect = (value) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach(collect)
      return
    }
    if (typeof value !== 'object') return
    output.push(value)
    Object.values(value).forEach((child) => {
      if (child && typeof child === 'object') collect(child)
    })
  }

  blocks.forEach((match) => {
    try {
      collect(JSON.parse(match[1]))
    } catch {
      // Listing pages occasionally include malformed or escaped analytics JSON-LD.
    }
  })
  return output
}

const objectValue = (objects, keys) => {
  for (const object of objects) {
    for (const key of keys) {
      const value = object?.[key]
      if (value !== undefined && value !== null && value !== '') return value
    }
  }
  return ''
}

const structuredAddress = (objects) => {
  for (const object of objects) {
    const address = object?.address
    if (!address || typeof address !== 'object') continue
    const text = [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
    ].filter(Boolean).join(', ')
    if (text) {
      return {
        address: compact(text),
        postcode: compact(address.postalCode || ''),
        region: compact(address.addressRegion || ''),
      }
    }
  }
  return { address: '', postcode: '', region: '' }
}

const inferJurisdiction = (region, pageText) => {
  const value = `${region || ''} ${pageText || ''}`.toLowerCase()
  if (/\bscotland\b/.test(value)) return 'scotland'
  if (/\bwales\b|\bcymru\b/.test(value)) return 'wales'
  if (/\bnorthern ireland\b/.test(value)) return 'england-ni'
  return ''
}

export const parseListingHtml = (html, sourceUrl = '') => {
  const source = String(html || '')
  const text = compact(source.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
  const objects = jsonLdObjects(source)
  const structured = structuredAddress(objects)

  const structuredPrice = objectValue(objects, ['price'])
    || objects.map((object) => object?.offers?.price).find((value) => value !== undefined && value !== null)
  const price = numberFromText(structuredPrice) || numberFromText(firstMatch(source, [
    /"price"\s*:\s*\{\s*"amount"\s*:\s*(\d{4,9})/i,
    /"price"\s*:\s*(\d{4,9})/i,
    /(?:guide price|offers over|fixed price|asking price|price)[^£]{0,40}£\s*([\d,]{5,})/i,
  ])) || numberFromText(firstMatch(text, [
    /£\s*([\d,]{5,})/,
  ]))

  const bedroomsRaw = objectValue(objects, ['numberOfBedrooms', 'numberOfRooms'])
    || firstMatch(source, [
      /"bedrooms"\s*:\s*(\d{1,2})/i,
      /"num_bedrooms"\s*:\s*(\d{1,2})/i,
    ])
    || firstMatch(text, [/\b(\d{1,2})\s+bed(?:room)?s?\b/i])
  const bedrooms = numberFromText(bedroomsRaw)

  const postcode = structured.postcode || firstMatch(source, [
    /"postcode"\s*:\s*"([^"]+)"/i,
    /"postalCode"\s*:\s*"([^"]+)"/i,
  ]) || firstMatch(text, [/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i])

  const title = metaContent(source, 'og:title') || metaContent(source, 'twitter:title')
  const description = metaContent(source, 'og:description') || metaContent(source, 'description')
  const rawAddress = structured.address
    || firstMatch(source, [
      /"displayAddress"\s*:\s*"([^"]+)"/i,
      /"address"\s*:\s*"([^"]{5,160})"/i,
    ])
    || title.replace(/\s*[|–-]\s*(Rightmove|Zoopla).*$/i, '').replace(/^.*?for sale\s+(?:at|in)\s+/i, '')

  const epc = firstMatch(`${source} ${text}`, [
    /\bEPC(?:\s+rating)?\s*[:\-]?\s*([A-G])\b/i,
    /\benergy efficiency(?:\s+rating)?\s*[:\-]?\s*([A-G])\b/i,
    /"epcRating"\s*:\s*"([A-G])"/i,
  ]).toUpperCase()

  const rentRaw = firstMatch(`${description} ${text}`, [
    /(?:expected|estimated|potential|current)?\s*(?:rental income|rent)[^£]{0,45}£\s*([\d,]{3,})\s*(?:pcm|per month|pm)\b/i,
    /£\s*([\d,]{3,})\s*(?:pcm|per month|pm)\b/i,
  ])
  const expectedMonthlyRent = numberFromText(rentRaw)

  const region = structured.region || firstMatch(source, [/"addressRegion"\s*:\s*"([^"]+)"/i])
  const jurisdiction = inferJurisdiction(region, `${rawAddress} ${description}`)

  return {
    sourceUrl,
    purchasePrice: price,
    expectedMonthlyRent,
    address: compact(rawAddress),
    postcode: compact(postcode).toUpperCase(),
    bedrooms,
    epc,
    jurisdiction,
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!await authenticateUser(request, env)) {
      return json({ error: 'Your session could not be verified.' }, 401)
    }

    const body = await request.json().catch(() => ({}))
    const validation = validateListingUrl(body.url)
    if (validation.error) return json({ error: validation.error }, 400)

    const response = await fetch(validation.url.toString(), {
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 (compatible; BTLPortfolio/1.0; +https://btlportfolio.co.uk)',
      },
    })

    if (!response.ok) {
      return json({
        error: `${validation.provider} did not allow this listing to be read automatically. You can still enter it manually.`,
        code: 'listing_unavailable',
      }, 502)
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > 5_000_000) {
      return json({ error: 'This listing page is too large to import safely.' }, 413)
    }

    const html = await response.text()
    const parsed = parseListingHtml(html, validation.url.toString())
    const fieldsFound = [
      parsed.purchasePrice,
      parsed.address,
      parsed.postcode,
      parsed.bedrooms,
      parsed.epc,
      parsed.expectedMonthlyRent,
    ].filter((value) => value !== '' && value !== null && value !== undefined).length

    return json({
      provider: validation.provider,
      listing: parsed,
      fieldsFound,
      warning: fieldsFound < 2
        ? 'The listing did not expose much structured data. Check the imported fields and fill in anything missing.'
        : '',
    })
  } catch (error) {
    return json({
      error: error?.message || 'The listing could not be imported. You can still enter it manually.',
    }, 502)
  }
}
