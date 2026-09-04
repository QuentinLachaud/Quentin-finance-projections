import { generateVapidKeys } from '@mmmike/web-push/vapid'

const { publicKey, privateKey } = await generateVapidKeys()
console.log('VITE_PUSH_VAPID_PUBLIC_KEY=' + publicKey)
console.log('PUSH_VAPID_PUBLIC_KEY=' + publicKey)
console.log('PUSH_VAPID_PRIVATE_KEY=' + privateKey)
