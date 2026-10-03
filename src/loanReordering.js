export function reorderList(items = [], fromIndex, toIndex) {
  const source = Array.isArray(items) ? [...items] : []
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= source.length
    || toIndex >= source.length
  ) return source
  const [moved] = source.splice(fromIndex, 1)
  source.splice(toIndex, 0, moved)
  return source
}

export function reorderVisibleLoans(allLoans = [], visibleLoans = [], fromIndex, toIndex) {
  const all = Array.isArray(allLoans) ? [...allLoans] : []
  const visible = Array.isArray(visibleLoans) ? visibleLoans : []
  if (visible.length < 2 || fromIndex === toIndex) return all

  const reordered = reorderList(visible, fromIndex, toIndex)
  if (reordered.length !== visible.length) return all

  const ids = new Set(visible.map((loan) => String(loan?.id || '')))
  if (ids.size !== visible.length || ids.has('')) return all

  let visibleIndex = 0
  return all.map((loan) => {
    if (!ids.has(String(loan?.id || ''))) return loan
    const replacement = reordered[visibleIndex]
    visibleIndex += 1
    return replacement
  })
}
