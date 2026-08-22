import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost, parseListingHtml, validateListingUrl } from './property-listing.js'
const env = { VITE_SUPABASE_URL:'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY:'publishable-key' }
const request = (url, authenticated=true) => new Request('https://app.example/api/property-listing', { method:'POST', headers:{'content-type':'application/json', ...(authenticated ? {authorization:'Bearer user-token'} : {})}, body:JSON.stringify({url}) })
afterEach(() => vi.unstubAllGlobals())

describe('Listing boundary', () => {
  it('only allows Rightmove/Zoopla', () => { expect(validateListingUrl('https://www.rightmove.co.uk/properties/1').provider).toBe('Rightmove'); expect(validateListingUrl('https://www.zoopla.co.uk/for-sale/details/1').provider).toBe('Zoopla'); expect(validateListingUrl('https://example.com').error).toMatch(/Only Rightmove and Zoopla/) })
  it('requires authentication', async () => { const f=vi.fn(); vi.stubGlobal('fetch',f); const response=await onRequestPost({request:request('https://www.rightmove.co.uk/properties/1',false),env}); expect(response.status).toBe(401); expect(f).not.toHaveBeenCalled() })
})

describe('Price-only listing import', () => {
  it('returns no rent or property metadata even when present', () => {
    const html='<script type="application/ld+json">{"numberOfBedrooms":2,"address":{"postalCode":"G3 8PP"},"offers":{"price":180000}}</script><p>Rent £1,400 pcm EPC B</p>'
    expect(parseListingHtml(html,'https://www.rightmove.co.uk/properties/1')).toEqual({sourceUrl:'https://www.rightmove.co.uk/properties/1',purchasePrice:180000})
  })
  it('reads an embedded price shape', () => expect(parseListingHtml('<script>{"price":{"amount":250000},"bedrooms":3}</script>')).toEqual({sourceUrl:'',purchasePrice:250000}))
  it('returns a price-only API payload', async () => {
    const f=vi.fn().mockResolvedValueOnce(new Response('{}',{status:200})).mockResolvedValueOnce(new Response('<p>Guide price £175,000</p><p>2 bedrooms</p>',{status:200})); vi.stubGlobal('fetch',f)
    const response=await onRequestPost({request:request('https://www.rightmove.co.uk/properties/1'),env}); const body=await response.json(); expect(response.status).toBe(200); expect(body.listing).toEqual({sourceUrl:'https://www.rightmove.co.uk/properties/1',purchasePrice:175000})
  })
})
