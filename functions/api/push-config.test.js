import { describe, expect, it } from 'vitest'
import { deriveVapidKeyPair, vapidConfigForEnv } from './_pushVapid.js'
import { onRequestGet } from './push-config.js'

describe('runtime push configuration', () => {
  it('derives a stable VAPID key pair from an existing server-only secret', async () => {
    const first = await deriveVapidKeyPair('server-secret')
    const second = await deriveVapidKeyPair('server-secret')
    expect(first).toEqual(second)
    expect(first.publicKey).toMatch(/^B/)
    expect(first.publicKey).toHaveLength(87)
    expect(first.privateKey).toHaveLength(43)
  })

  it('prefers explicit VAPID keys and otherwise derives them from the Supabase service secret', async () => {
    expect(await vapidConfigForEnv({ PUSH_VAPID_PUBLIC_KEY: 'public', PUSH_VAPID_PRIVATE_KEY: 'private' }, 'https://app.example/api/push-config')).toEqual({ publicKey: 'public', privateKey: 'private', subject: 'https://app.example' })
    const derived = await vapidConfigForEnv({ SUPABASE_SERVICE_ROLE_KEY: 'service-secret' }, 'https://app.example/api/push-config')
    expect(derived.publicKey).toBeTruthy()
    expect(derived.privateKey).toBeTruthy()
    expect(derived.subject).toBe('https://app.example')
  })

  it('returns only the public key to the client', async () => {
    const response = await onRequestGet({ request: new Request('https://app.example/api/push-config'), env: { SUPABASE_SERVICE_ROLE_KEY: 'service-secret' } })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.configured).toBe(true)
    expect(body.publicKey).toBeTruthy()
    expect(JSON.stringify(body)).not.toContain('service-secret')
    expect(JSON.stringify(body)).not.toContain('privateKey')
  })
})
