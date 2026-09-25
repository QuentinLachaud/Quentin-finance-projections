import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchClientUiActions } from '../../src/lunaUiActions.js'
import { onRequestPost } from './luna.js'

const fixturePortfolio = {
  properties: [{ id: 'fixture-property-1', name: 'BTL1', address: '1 Fixture Road', active: true }],
  settings: { accountType: 'company', cashHeld: 10000 },
}

const messageResponse = (text) => ({
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
})

const functionResponse = (operation) => ({
  output: [{
    type: 'function_call',
    name: 'client_ui_action',
    call_id: 'call-ui-1',
    arguments: JSON.stringify(operation),
  }],
})

const runLuna = async (message, toolArgs, finalText) => {
  const modelResponses = [functionResponse(toolArgs), messageResponse(finalText)]
  const fetchMock = vi.fn(async (url) => {
    const href = String(url)
    if (href.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
    if (href.includes('/rest/v1/portfolio_states?')) return new Response(JSON.stringify([{ portfolio: fixturePortfolio }]), { status: 200 })
    if (href.endsWith('/responses')) return new Response(JSON.stringify(modelResponses.shift()), { status: 200 })
    throw new Error(`Unexpected request: ${href}`)
  })
  vi.stubGlobal('fetch', fetchMock)

  const response = await onRequestPost({
    request: new Request('https://portfolio.test/api/luna', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    }),
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_PUBLISHABLE_KEY: 'test-key',
      OPENAI_API_KEY: 'test-openai-key',
    },
  })
  return { response, body: await response.json(), fetchMock }
}

afterEach(() => vi.unstubAllGlobals())

describe('Luna UI action integration at the mocked model boundary', () => {
  it('routes “show me the performance of BTL 1” to Performance with the fixture property selected', async () => {
    const { response, body } = await runLuna('show me the performance of BTL 1', {
      operation: 'property.open', workspace: 'performance', target: 'BTL 1', data: null,
    }, 'I opened BTL1 performance.')

    expect(response.status).toBe(200)
    expect(body.message).toBe('I opened BTL1 performance.')
    expect(body.portfolio).toBeNull()
    expect(body.uiActions).toEqual([
      { type: 'navigate', workspace: 'performance' },
      { type: 'open_entity', workspace: 'performance', entityType: 'property', entityId: 'fixture-property-1' },
    ])

    const navigated = []
    const selected = []
    const dispatched = dispatchClientUiActions(body.uiActions, fixturePortfolio, {
      navigateWorkspace: (workspace) => navigated.push(workspace),
      openEntity: (action) => selected.push(action.entityId),
    })
    expect(dispatched.rejected).toEqual([])
    expect(navigated).toEqual(['performance'])
    expect(selected).toEqual(['fixture-property-1'])
  })

  it('routes “how long until I can buy a £200,000 flat?” and runs the existing acquisition simulation', async () => {
    const { response, body, fetchMock } = await runLuna('how long until I can buy a £200,000 flat?', {
      operation: 'acquisition.simulate', workspace: 'acquisition', target: null, data: { purchasePrice: 200000 },
    }, 'I opened the £200,000 acquisition scenario.')

    expect(response.status).toBe(200)
    expect(body.portfolio).toBeNull()
    expect(body.uiActions).toEqual([
      { type: 'navigate', workspace: 'acquisition' },
      { type: 'set_form_fields', form: 'acquisition_simulator', fields: { purchasePrice: 200000 } },
      { type: 'run_existing_simulation', simulator: 'acquisition' },
    ])

    const runSimulation = vi.fn()
    dispatchClientUiActions(body.uiActions, fixturePortfolio, { runSimulation })
    expect(runSimulation).toHaveBeenCalledWith('acquisition', { purchasePrice: 200000 })
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).includes('/rest/v1/portfolio_states') && options?.method === 'POST')).toBe(false)
  })
})
