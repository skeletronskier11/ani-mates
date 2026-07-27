import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { DEFAULT_CATEGORIES } from '../lib/categories.js'
import { generateId, saveIdentity } from '../lib/identity.js'

function extractRoomId(input) {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/room\/([^/]+)/)
    if (match) return match[1]
  } catch {
    // not a URL, fall through to treating it as a raw room id
  }
  return trimmed
}

export default function HomePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('create')
  const [displayName, setDisplayName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    const name = displayName.trim()
    if (!name) {
      setError('Enter a display name.')
      return
    }

    setBusy(true)
    try {
      const roomId = generateId()
      const participantId = generateId()

      const { error: roomError } = await supabase
        .from('rooms')
        .insert({ id: roomId, name: roomName.trim() || null })
      if (roomError) throw roomError

      const categoryRows = DEFAULT_CATEGORIES.map((catName, idx) => ({
        room_id: roomId,
        name: catName,
        is_scored: true,
        sort_order: idx,
      }))
      const { error: catError } = await supabase.from('categories').insert(categoryRows)
      if (catError) throw catError

      const { error: participantError } = await supabase.from('participants').insert({
        id: participantId,
        room_id: roomId,
        display_name: name,
        is_host: true,
      })
      if (participantError) throw participantError

      saveIdentity(roomId, { participantId, displayName: name })
      navigate(`/room/${roomId}`)
    } catch (err) {
      setError(err.message || 'Something went wrong creating the room.')
    } finally {
      setBusy(false)
    }
  }

  function handleJoin(e) {
    e.preventDefault()
    setError(null)
    const roomId = extractRoomId(joinInput)
    if (!roomId) {
      setError('Paste a room link or room code.')
      return
    }
    navigate(`/room/${roomId}`)
  }

  return (
    <div className="home-shell">
      <div className="home-card">
        <h1>Ani-Mates</h1>
        <p className="subtitle">Pick your favorites, see how compatible your group really is.</p>

        <div className="home-tabs">
          <button
            type="button"
            className={mode === 'create' ? 'active' : ''}
            onClick={() => setMode('create')}
          >
            Create Room
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'active' : ''}
            onClick={() => setMode('join')}
          >
            Join Room
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="displayName">Your name</label>
              <input
                id="displayName"
                className="text-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={40}
              />
            </div>
            <div className="field">
              <label htmlFor="roomName">Room name (optional)</label>
              <input
                id="roomName"
                className="text-input"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Friday Anime Night"
                maxLength={60}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn btn-block" disabled={busy}>
              {busy ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <div className="field">
              <label htmlFor="joinInput">Room link or code</label>
              <input
                id="joinInput"
                className="text-input"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="Paste the link someone shared with you"
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn btn-block">
              Continue
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
