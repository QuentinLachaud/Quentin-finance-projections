export const serverVersionIsNewer = (remoteUpdatedAt, localUpdatedAt) => {
  const remote = Date.parse(remoteUpdatedAt || '')
  const local = Date.parse(localUpdatedAt || '')
  if (!Number.isFinite(remote)) return false
  if (!Number.isFinite(local)) return true
  return remote > local
}

export const mergeRemotePortfolio = (current, remote) => {
  if (!remote || typeof remote !== 'object') return current
  if (!current || typeof current !== 'object') return remote
  return {
    ...current,
    ...remote,
    settings: { ...(current.settings || {}), ...(remote.settings || {}) },
  }
}
