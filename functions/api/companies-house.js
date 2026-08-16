const API_ROOT = 'https://api.company-information.service.gov.uk'

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

const companiesHouseFetch = async (path, apiKey, optional = false) => {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { authorization: `Basic ${btoa(`${apiKey}:`)}`, accept: 'application/json' },
  })
  if (optional && response.status === 404) return null
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Companies House API authentication failed.' : 'Companies House could not complete this request.')
    error.status = response.status
    throw error
  }
  return response.json()
}

export async function onRequestGet({ request, env }) {
  try {
    if (!await authenticateUser(request, env)) return json({ error: 'Your session could not be verified.' }, 401)
    if (!env.COMPANIES_HOUSE_API_KEY) return json({ error: 'Companies House is not configured yet.', code: 'not_configured' }, 503)

    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')
    if (mode === 'search') {
      const query = url.searchParams.get('q')?.trim()
      if (!query || query.length < 2) return json({ error: 'Enter at least two characters.' }, 400)
      const results = await companiesHouseFetch(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=8`, env.COMPANIES_HOUSE_API_KEY)
      return json({ items: results.items || [] })
    }

    if (mode === 'company') {
      const companyNumber = (url.searchParams.get('number') || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (!companyNumber) return json({ error: 'A company number is required.' }, 400)
      const base = `/company/${encodeURIComponent(companyNumber)}`
      const [profile, filings, officers, psc, charges] = await Promise.all([
        companiesHouseFetch(base, env.COMPANIES_HOUSE_API_KEY),
        companiesHouseFetch(`${base}/filing-history?items_per_page=12`, env.COMPANIES_HOUSE_API_KEY, true),
        companiesHouseFetch(`${base}/officers?items_per_page=50`, env.COMPANIES_HOUSE_API_KEY, true),
        companiesHouseFetch(`${base}/persons-with-significant-control?items_per_page=50`, env.COMPANIES_HOUSE_API_KEY, true),
        companiesHouseFetch(`${base}/charges?items_per_page=50`, env.COMPANIES_HOUSE_API_KEY, true),
      ])
      return json({ profile, filings, officers, psc, charges, fetchedAt: new Date().toISOString() })
    }

    return json({ error: 'Unknown Companies House request.' }, 400)
  } catch (error) {
    return json({ error: error.message || 'Companies House is temporarily unavailable.' }, error.status >= 400 && error.status < 600 ? error.status : 502)
  }
}
