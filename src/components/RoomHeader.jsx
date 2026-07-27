import { useState } from 'react'

export default function RoomHeader({ room, participants, onlineIds, myParticipantId }) {
  const [copied, setCopied] = useState(false)

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable; nothing we can do silently
    }
  }

  return (
    <header className="room-header">
      <div className="room-info">
        <div className="status-dot" title="Connected" />
        <strong>{room?.name || 'Ani-Mates Room'}</strong>
        <div className="users-list">
          {participants.map((p) => {
            const isOnline = onlineIds.has(p.id)
            const isYou = p.id === myParticipantId
            return (
              <span
                key={p.id}
                className={`user-badge${isOnline ? ' online' : ''}${isYou ? ' is-you' : ''}`}
              >
                <span className="dot" />
                {p.display_name}
                {isYou ? ' (You)' : ''}
              </span>
            )
          })}
        </div>
      </div>
      <button type="button" className="btn btn-outline" onClick={handleCopyLink}>
        {copied ? 'Link Copied!' : 'Copy Invite Link'}
      </button>
    </header>
  )
}
