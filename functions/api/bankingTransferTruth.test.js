import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './banking.js'

const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable',
  GOCARDLESS_SECRET_ID: '',
  GOCARDLESS_SECRET_KEY: '',
}
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const request = () => new Request('https://app.test/api/banking', {
  method: 'POST',
  headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'reconcile-transfers' }),
})

afterEach(() => vi.unstubAllGlobals())

describe('Tide persisted transfer truth repair', () => {
  it('repairs an exact provider-ID pair even when both imports share one legacy account and the Saver leg was manually called rent', async () => {
    const providerId = 'abc123abc123abc123abc123abc123ab'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ id: 'user-1' }))
      .mockResolvedValueOnce(response([
        {
          id: 'current-out', account_id: 'legacy', booked_at: '2026-01-10', amount: -1000, currency: 'GBP',
          description: 'Savings account ref:', counterparty: 'Savings account', status: 'booked', is_transfer: true,
          category: 'transfer', category_overridden: false, source_type: 'tide_statement', import_id: 'current-import',
          property_id: null, performance_treatment: 'auto', exclude_from_performance: false,
          source_metadata: { tideTransactionId: providerId, transactionType: 'FundsTransferOut', to: 'Savings account' },
        },
        {
          id: 'saver-in', account_id: 'legacy', booked_at: '2026-01-10', amount: 1000, currency: 'GBP',
          description: `'${providerId}`, counterparty: null, status: 'booked', is_transfer: false,
          category: 'rent', category_overridden: true, source_type: 'tide_statement', import_id: 'saver-import',
          property_id: 'p2', performance_treatment: 'auto', exclude_from_performance: false, source_metadata: {},
        },
      ]))
      .mockResolvedValueOnce(response({}))
    vi.stubGlobal('fetch', fetchMock)
    const result = await onRequestPost({ request: request(), env })
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ reconciled: 1 })
    const patchCall = fetchMock.mock.calls.find(([url, options]) => String(url).includes('bank_transactions?id=eq.saver-in') && options?.method === 'PATCH')
    expect(JSON.parse(patchCall[1].body)).toEqual({
      is_transfer: true, category: 'transfer', category_overridden: false, property_id: null, performance_treatment: 'auto',
    })
  })
})
