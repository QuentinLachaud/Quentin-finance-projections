const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn
const A = P - 3n
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
const GX = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n
const GY = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n

const mod = (value) => {
  const result = value % P
  return result >= 0n ? result : result + P
}

const invert = (value) => {
  let low = mod(value)
  if (low === 0n) throw new Error('Invalid P-256 point inversion.')
  let high = P
  let lm = 1n
  let hm = 0n
  while (low > 1n) {
    const ratio = high / low
    ;[lm, hm] = [hm - lm * ratio, lm]
    ;[low, high] = [high - low * ratio, low]
  }
  return mod(lm)
}

const doublePoint = (point) => {
  if (!point || point.y === 0n) return null
  const slope = mod((3n * point.x * point.x + A) * invert(2n * point.y))
  const x = mod(slope * slope - 2n * point.x)
  const y = mod(slope * (point.x - x) - point.y)
  return { x, y }
}

const addPoints = (left, right) => {
  if (!left) return right
  if (!right) return left
  if (left.x === right.x) {
    if (mod(left.y + right.y) === 0n) return null
    return doublePoint(left)
  }
  const slope = mod((right.y - left.y) * invert(right.x - left.x))
  const x = mod(slope * slope - left.x - right.x)
  const y = mod(slope * (left.x - x) - left.y)
  return { x, y }
}

const multiplyBasePoint = (scalar) => {
  let n = scalar
  let result = null
  let addend = { x: GX, y: GY }
  while (n > 0n) {
    if (n & 1n) result = addPoints(result, addend)
    addend = doublePoint(addend)
    n >>= 1n
  }
  if (!result) throw new Error('Invalid derived P-256 key.')
  return result
}

const bytesToBigInt = (bytes) => bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
const bigIntToBytes = (value, length) => {
  const bytes = new Uint8Array(length)
  let remaining = value
  for (let index = length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  return bytes
}
const urlBase64 = (bytes) => {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export const deriveVapidKeyPair = async (secret) => {
  const material = new TextEncoder().encode(`btlportfolio:web-push:v1:${secret}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', material))
  const scalar = (bytesToBigInt(digest) % (N - 1n)) + 1n
  const point = multiplyBasePoint(scalar)
  const privateBytes = bigIntToBytes(scalar, 32)
  const publicBytes = new Uint8Array(65)
  publicBytes[0] = 4
  publicBytes.set(bigIntToBytes(point.x, 32), 1)
  publicBytes.set(bigIntToBytes(point.y, 32), 33)
  return { publicKey: urlBase64(publicBytes), privateKey: urlBase64(privateBytes) }
}

let cachedSecret = ''
let cachedPair = null

export const vapidConfigForEnv = async (env = {}, requestUrl = '') => {
  const explicitPublic = String(env.PUSH_VAPID_PUBLIC_KEY || env.VITE_PUSH_VAPID_PUBLIC_KEY || '').trim()
  const explicitPrivate = String(env.PUSH_VAPID_PRIVATE_KEY || '').trim()
  const subject = String(env.PUSH_VAPID_SUBJECT || env.PUBLIC_SITE_URL || (requestUrl ? new URL(requestUrl).origin : '') || 'https://btlportfolio.co.uk').trim()
  if (explicitPublic && explicitPrivate) return { publicKey: explicitPublic, privateKey: explicitPrivate, subject }

  const serviceSecret = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!serviceSecret) return null
  if (!cachedPair || cachedSecret !== serviceSecret) {
    cachedPair = await deriveVapidKeyPair(serviceSecret)
    cachedSecret = serviceSecret
  }
  return { ...cachedPair, subject }
}
