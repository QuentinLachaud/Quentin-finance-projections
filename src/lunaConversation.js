export const LUNA_GREETING = 'Ask me about the portfolio, or tell me what you want changed.'
export const LUNA_HISTORY_MESSAGE_LIMIT = 16
export const LUNA_HISTORY_CHARACTER_LIMIT = 32000
export const LUNA_HISTORY_PER_MESSAGE_LIMIT = 3000

export const lunaConversationStorageKey = (userId) => `btl-luna-conversation:${String(userId || '')}`

const isSafeTurn = (message) => (
  message
  && (message.role === 'user' || message.role === 'assistant')
  && typeof message.text === 'string'
  && message.text.length > 0
  && message.text.length <= LUNA_HISTORY_PER_MESSAGE_LIMIT
  && message.persist !== false
)

export const boundedLunaTurns = (messages) => {
  if (!Array.isArray(messages)) return []
  const newest = []
  let characters = 0

  for (let index = messages.length - 1; index >= 0 && newest.length < LUNA_HISTORY_MESSAGE_LIMIT; index -= 1) {
    const message = messages[index]
    if (!isSafeTurn(message)) continue
    if (characters + message.text.length > LUNA_HISTORY_CHARACTER_LIMIT) break
    newest.push({ role: message.role, text: message.text })
    characters += message.text.length
  }

  return newest.reverse()
}

export const restoreLunaTurns = (storage, userId) => {
  try {
    const raw = storage?.getItem(lunaConversationStorageKey(userId))
    return boundedLunaTurns(raw ? JSON.parse(raw) : [])
  } catch {
    return []
  }
}

export const persistLunaTurns = (storage, userId, messages) => {
  const key = lunaConversationStorageKey(userId)
  const turns = boundedLunaTurns(messages)
  try {
    if (turns.length) storage?.setItem(key, JSON.stringify(turns))
    else storage?.removeItem(key)
  } catch {
    // Luna remains usable when session storage is unavailable or full.
  }
  return turns
}
