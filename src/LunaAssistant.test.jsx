// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LunaAssistant from './LunaAssistant.jsx'
import { LUNA_GREETING, lunaConversationStorageKey } from './lunaConversation.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let host

const renderLuna = (props = {}) => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<LunaAssistant accessToken="token" userId="user-a" {...props} />))
  return host
}

const click = async (element) => {
  await act(async () => {
    element.click()
    await Promise.resolve()
  })
}

const type = (input, value) => {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => window.sessionStorage.clear())
afterEach(() => {
  if (root) act(() => root.unmount())
  host?.remove()
  root = null
  host = null
  vi.unstubAllGlobals()
})

describe('Luna current-conversation memory', () => {
  it('restores and persists only the signed-in user text transcript', async () => {
    const key = lunaConversationStorageKey('user-a')
    const otherKey = lunaConversationStorageKey('user-b')
    window.sessionStorage.setItem(key, JSON.stringify([
      { role: 'user', text: 'What rent is BTL 1 on?' },
      { role: 'assistant', text: 'BTL 1 is currently £1,500/month.' },
    ]))
    window.sessionStorage.setItem(otherKey, JSON.stringify([{ role: 'assistant', text: 'Other account' }]))
    const fetchMock = vi.fn(async (_url, options) => {
      const request = JSON.parse(options.body)
      expect(request.history).toEqual([
        { role: 'user', text: 'What rent is BTL 1 on?' },
        { role: 'assistant', text: 'BTL 1 is currently £1,500/month.' },
      ])
      return new Response(JSON.stringify({ message: 'Updated BTL 1 rent to £1,650/month.' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLuna()
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    expect(host.textContent).toContain('What rent is BTL 1 on?')
    expect(host.textContent).toContain('BTL 1 is currently £1,500/month.')
    expect(host.textContent).not.toContain('Other account')

    type(host.querySelector('[aria-label="Ask Luna"]'), 'Change that to £1,650.')
    await click(host.querySelector('.luna-input button[type="submit"]'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(window.sessionStorage.getItem(key))).toEqual([
      { role: 'user', text: 'What rent is BTL 1 on?' },
      { role: 'assistant', text: 'BTL 1 is currently £1,500/month.' },
      { role: 'user', text: 'Change that to £1,650.' },
      { role: 'assistant', text: 'Updated BTL 1 rent to £1,650/month.' },
    ])
  })

  it('starts a new conversation without touching another account or portfolio callbacks', async () => {
    const key = lunaConversationStorageKey('user-a')
    const otherKey = lunaConversationStorageKey('user-b')
    window.sessionStorage.setItem(key, JSON.stringify([{ role: 'user', text: 'Old chat' }]))
    window.sessionStorage.setItem(otherKey, JSON.stringify([{ role: 'user', text: 'Keep me' }]))
    const onPortfolioChange = vi.fn()

    renderLuna({ onPortfolioChange })
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    await click(host.querySelector('[aria-label="New conversation"]'))

    expect(host.textContent).toContain(LUNA_GREETING)
    expect(host.textContent).not.toContain('Old chat')
    expect(window.sessionStorage.getItem(key)).toBeNull()
    expect(JSON.parse(window.sessionStorage.getItem(otherKey))).toEqual([{ role: 'user', text: 'Keep me' }])
    expect(onPortfolioChange).not.toHaveBeenCalled()
  })

  it('does not persist or restore a pending destructive confirmation', async () => {
    const key = lunaConversationStorageKey('user-a')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      message: 'Confirm: delete BTL 1',
      confirmation: { name: 'portfolio_action', arguments: { operation: 'property.delete', target: 'BTL 1', data: null } },
    }), { status: 200 })))

    renderLuna()
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    type(host.querySelector('[aria-label="Ask Luna"]'), 'Delete BTL 1')
    await click(host.querySelector('.luna-input button[type="submit"]'))
    expect(host.querySelector('.luna-confirm')).not.toBeNull()
    expect(JSON.parse(window.sessionStorage.getItem(key))).toEqual([{ role: 'user', text: 'Delete BTL 1' }])

    act(() => root.unmount())
    host.remove()
    root = null
    host = null
    renderLuna()
    await click(host.querySelector('[aria-label="Ask Luna"]'))

    expect(host.querySelector('.luna-confirm')).toBeNull()
    expect(host.textContent).not.toContain('Confirm: delete BTL 1')
  })

  it('keeps a successful destructive confirmation result as ordinary context', async () => {
    const requests = []
    const responses = [
      {
        message: 'Confirm: delete BTL 1',
        confirmation: { name: 'portfolio_action', arguments: { operation: 'property.delete', target: 'BTL 1', data: null } },
      },
      { message: 'Deleted BTL 1.', changed: true, portfolio: { properties: [] } },
      { message: 'There are no properties now.' },
    ]
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      requests.push(JSON.parse(options.body))
      return new Response(JSON.stringify(responses.shift()), { status: 200 })
    }))

    renderLuna()
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    type(host.querySelector('[aria-label="Ask Luna"]'), 'Delete BTL 1')
    await click(host.querySelector('.luna-input button[type="submit"]'))
    await click(host.querySelector('.luna-confirm .primary-button'))
    expect(host.textContent).toContain('Deleted BTL 1.')

    type(host.querySelector('[aria-label="Ask Luna"]'), 'What remains?')
    await click(host.querySelector('.luna-input button[type="submit"]'))
    expect(requests[2].history).toEqual([
      { role: 'user', text: 'Delete BTL 1' },
      { role: 'assistant', text: 'Deleted BTL 1.' },
    ])
    expect(JSON.stringify(requests[2])).not.toContain('Confirm: delete BTL 1')
  })

  it('excludes a failed prompt and error from later history while keeping earlier successful context', async () => {
    const requests = []
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      requests.push(JSON.parse(options.body))
      callCount += 1
      if (callCount === 1) return new Response(JSON.stringify({ error: 'Property not found.' }), { status: 500 })
      return new Response(JSON.stringify({ message: 'BTL1 rent is £1,500.' }), { status: 200 })
    }))
    window.sessionStorage.setItem(lunaConversationStorageKey('user-a'), JSON.stringify([
      { role: 'user', text: 'Tell me about BTL1.' },
      { role: 'assistant', text: 'BTL1 is in your portfolio.' },
    ]))

    renderLuna()
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    type(host.querySelector('[aria-label="Ask Luna"]'), 'What loan does Missing House have?')
    await click(host.querySelector('.luna-input button[type="submit"]'))
    expect(host.textContent).toContain('Property not found.')

    type(host.querySelector('[aria-label="Ask Luna"]'), 'What is the rent?')
    await click(host.querySelector('.luna-input button[type="submit"]'))

    expect(requests[1].history).toEqual([
      { role: 'user', text: 'Tell me about BTL1.' },
      { role: 'assistant', text: 'BTL1 is in your portfolio.' },
    ])
    expect(JSON.stringify(requests[1])).not.toContain('Missing House')
    expect(JSON.stringify(requests[1])).not.toContain('Property not found')
  })

  it('renders restrained assistant formatting and keeps raw HTML inert', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      message: '**Bold** and __also bold__ with *emphasis*.\n\n- First\n- Second\n\n1. One\n2. Two\n\n<script>window.pwned = true</script>',
    }), { status: 200 })))

    renderLuna()
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    type(host.querySelector('[aria-label="Ask Luna"]'), 'Format this')
    await click(host.querySelector('.luna-input button[type="submit"]'))

    const assistant = [...host.querySelectorAll('.luna-message.assistant')].at(-1)
    expect(assistant.querySelectorAll('strong')).toHaveLength(2)
    expect(assistant.querySelector('em')?.textContent).toBe('emphasis')
    expect(assistant.querySelectorAll('ul li')).toHaveLength(2)
    expect(assistant.querySelectorAll('ol li')).toHaveLength(2)
    expect(assistant.querySelectorAll('p').length).toBeGreaterThanOrEqual(2)
    expect(assistant.textContent).not.toContain('**')
    expect(assistant.textContent).not.toContain('__')
    expect(assistant.querySelector('script')).toBeNull()
    expect(assistant.textContent).toContain('<script>window.pwned = true</script>')
    expect(window.pwned).toBeUndefined()
  })

  it('renders only valid action chips and dispatches their validated semantic sequence on tap', async () => {
    const onUiActions = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      message: 'BTL1 rent is £1,500.',
      chatActions: [
        {
          label: 'Open BTL1',
          actions: [
            { type: 'navigate', workspace: 'properties' },
            { type: 'open_entity', workspace: 'properties', entityType: 'property', entityId: 'property-1' },
          ],
        },
        { label: 'Run code', actions: [{ type: 'execute_javascript', code: 'alert(1)' }] },
      ],
    }), { status: 200 })))

    renderLuna({
      onUiActions,
      uiActionContext: { properties: [{ id: 'property-1', name: 'BTL1' }], accountType: 'company' },
    })
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    type(host.querySelector('[aria-label="Ask Luna"]'), 'What is rent for BTL1?')
    await click(host.querySelector('.luna-input button[type="submit"]'))

    const chips = host.querySelectorAll('.luna-chat-action')
    expect(chips).toHaveLength(1)
    expect(chips[0].textContent).toContain('Open BTL1')
    expect(chips[0].getAttribute('type')).toBe('button')
    await click(chips[0])
    expect(onUiActions).toHaveBeenCalledWith([
      { type: 'navigate', workspace: 'properties' },
      { type: 'open_entity', workspace: 'properties', entityType: 'property', entityId: 'property-1' },
    ])
    const stored = JSON.parse(window.sessionStorage.getItem(lunaConversationStorageKey('user-a')))
    expect(stored.at(-1).chatActions).toEqual([{
      label: 'Open BTL1',
      actions: [
        { type: 'navigate', workspace: 'properties' },
        { type: 'open_entity', workspace: 'properties', entityType: 'property', entityId: 'property-1' },
      ],
    }])
  })
})

describe('Luna panel structure', () => {
  it('keeps the header, confirmation, and composer outside the message scroller', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      message: 'Confirm this change',
      confirmation: { name: 'portfolio_action', arguments: { operation: 'property.delete', target: 'BTL 1', data: null } },
    }), { status: 200 })))

    renderLuna()
    await click(host.querySelector('[aria-label="Ask Luna"]'))
    type(host.querySelector('[aria-label="Ask Luna"]'), 'Delete BTL 1')
    await click(host.querySelector('.luna-input button[type="submit"]'))

    const panel = host.querySelector('.luna-panel')
    const messages = panel.querySelector('.luna-messages')
    expect(panel.querySelector('header').parentElement).toBe(panel)
    expect(panel.querySelector('[aria-label="Close Luna"]').closest('header')).toBe(panel.querySelector('header'))
    expect(panel.querySelector('.luna-confirm').parentElement).toBe(panel)
    expect(panel.querySelector('.luna-input').parentElement).toBe(panel)
    expect(messages.querySelector('.luna-confirm')).toBeNull()
    expect(messages.querySelector('.luna-input')).toBeNull()
  })
})
