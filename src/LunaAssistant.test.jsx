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
})
