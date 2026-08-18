const clean = (value) => String(value ?? '').trim()

const createId = () => globalThis.crypto?.randomUUID?.()
  || `credential-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const createCredential = (overrides = {}) => ({
  id: overrides.id || createId(),
  label: clean(overrides.label),
  value: String(overrides.value ?? ''),
  notes: String(overrides.notes ?? ''),
  sensitive: overrides.sensitive !== false,
  archived: Boolean(overrides.archived),
})

export const normalizeCredentials = (items) =>
  (Array.isArray(items) ? items : []).map((item) => createCredential(item))

export const moveCredential = (items, sourceId, targetId) => {
  if (!Array.isArray(items) || !sourceId || !targetId || sourceId === targetId) return Array.isArray(items) ? items : []

  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return items

  const next = [...items]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

export const filterCredentials = (items, query = '', archived = false) => {
  const needle = clean(query).toLowerCase()
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (Boolean(item.archived) !== Boolean(archived)) return false
    if (!needle) return true
    return `${item.label || ''} ${item.value || ''} ${item.notes || ''}`.toLowerCase().includes(needle)
  })
}
