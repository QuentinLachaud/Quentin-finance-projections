import { json } from './_billing.js'
import { vapidConfigForEnv } from './_pushVapid.js'

export async function onRequestGet({ request, env }) {
  const config = await vapidConfigForEnv(env, request.url)
  if (!config) return json({ configured: false }, 503)
  return json({ configured: true, publicKey: config.publicKey })
}
