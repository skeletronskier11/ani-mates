const storageKey = (roomId) => `ani-mates:room:${roomId}`

export function generateId() {
  return crypto.randomUUID()
}

export function getIdentity(roomId) {
  const raw = localStorage.getItem(storageKey(roomId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.participantId && parsed?.displayName) return parsed
    return null
  } catch {
    return null
  }
}

export function saveIdentity(roomId, identity) {
  localStorage.setItem(storageKey(roomId), JSON.stringify(identity))
}
