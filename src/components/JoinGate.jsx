import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { generateId, saveIdentity } from '../lib/identity.js'

export default function JoinGate({ roomId, roomName, onJoined }) {
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const name = displayName.trim()
    if (!name) {
      setError('Enter a display name.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const participantId = generateId()
      const { error: insertError } = await supabase.from('participants').insert({
        id: participantId,
        room_id: roomId,
        display_name: name,
        is_host: false,
      })
      if (insertError) throw insertError

      const identity = { participantId, displayName: name }
      saveIdentity(roomId, identity)
      onJoined(identity)
    } catch (err) {
      setError(err.message || 'Could not join the room.')
      setBusy(false)
    }
  }

  return (
    <div className="home-shell">
      <div className="home-card">
        <h1>Join {roomName || 'the room'}</h1>
        <p className="subtitle">Enter a name so the group knows it's you.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="joinName">Your name</label>
            <input
              id="joinName"
              className="text-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sam"
              maxLength={40}
              autoFocus
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  )
}
