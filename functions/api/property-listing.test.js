import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost, parseListingHtml, validateListingUrl } from './property-listing.js'

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
}

const request = (url, authenticated = true) => new Request('https://app.example/api/property-listing', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(authenticated ? { authorization: 'Bearer user-token' } : {}),
  },
  body: JSON.stringify({ url }),
})

afterEach(() => vi.unstubAllGlobals())

describe('property listing URL boundary', () => {
  it('accepts only Rightmove and Zoopla web URLs', () => {
    expect(validateListingUrl('https://www.rightmove.co.uk/properties/123').provider).toBe('Rightmove')
    expect(validateListingUrl('https://www.zoopla.co.uk/for-sale/details/123').provider).toBe('Zoopla')
    expect(validateListingUrl('https://example.com/property/123').error).toMatch(/Only Rightmove and Zoopla/)
    expect(validateListingUrl('file:///etc/passwd').error).toMatch(/Only web listing/)
  })

  it('rejects an unauthenticated proxy request before fetching the listing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({
      request: request('https://www.rightmove.co.uk/properties/123', false),
      env,
    })
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('property listing parsing', () => {
  it('extracts common Rightmove-like structured fields', () => {
    const html = `
      <meta property="og:title" content="2 bedroom flat for sale in 10 Test Street, Glasgow | Rightmove">
      <meta property="og:description" content="Potential rental income £1,400 pcm. EPC rating B.">
      <script type="application/ld+json">
        {
          "@type":"Apartment",
          "numberOfBedrooms":2,
          "floorSize":{"value":68,"unitCode":"MTK"},
          "address":{"streetAddress":"10 Test Street","addressLocality":"Glasgow","addressRegion":"Scotland","postalCode":"G3 8PP"},
          "offers":{"price":180000}
        }
      </script>`
    expect(parseListingHtml(html)).toMatchObject({
      purchasePrice: 180000,
      expectedMonthlyRent: 1400,
      bedrooms: 2,
      areaSqm: 68,
      propertyType: 'Flat',
      epc: 'B',
      postcode: 'G3 8PP',
      jurisdiction: 'scotland',
    })
  })

  it('extracts fallback Zoopla-like embedded fields', () => {
    const html = `
      <title>Property</title>
      <script>{"price":250000,"num_bedrooms":3,"postcode":"CF10 1AA","displayAddress":"1 Example Road, Cardiff, Wales","propertySubType":"Terraced house","floor_area":850,"floorAreaUnit":"sq ft","epcRating":"C"}</script>
      <p>Expected rent £1,250 per month · 79 sq m</p>`
    expect(parseListingHtml(html)).toMatchObject({
      purchasePrice: 250000,
      expectedMonthlyRent: 1250,
      bedrooms: 3,
      areaSqm: 79,
      propertyType: 'Terraced House',
      epc: 'C',
      postcode: 'CF10 1AA',
      jurisdiction: 'wales',
    })
  })

  it('authenticates first, fetches the allow-listed listing, and returns parsed data', async () => {
    const listingHtml = '<p>Guide price £175,000</p><p>2 bedrooms</p><p>EPC: D</p>'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(listingHtml, { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)
    const response = await onRequestPost({
      request: request('https://www.rightmove.co.uk/properties/123'),
      env,
    })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(body.provider).toBe('Rightmove')
    expect(body.listing).toMatchObject({ purchasePrice: 175000, bedrooms: 2, epc: 'D' })
  })
})
