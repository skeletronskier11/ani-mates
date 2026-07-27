import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { getIdentity } from '../lib/identity.js'
import { useRoom } from '../hooks/useRoom.js'
import { computeCompatibility } from '../lib/compatibility.js'
import JoinGate from '../components/JoinGate.jsx'
import RoomHeader from '../components/RoomHeader.jsx'
import CompatBanner from '../components/CompatBanner.jsx'
import ParticipantTabs from '../components/ParticipantTabs.jsx'
import BoardGrid from '../components/BoardGrid.jsx'
import SearchModal from '../components/SearchModal.jsx'
import AddCategoryModal from '../components/AddCategoryModal.jsx'

export default function RoomPage() {
  const { roomId } = useParams()
  const [identity, setIdentity] = useState(() => getIdentity(roomId))
  const [selectedParticipantId, setSelectedParticipantId] = useState(identity?.participantId ?? null)
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [showAddCategory, setShowAddCategory] = useState(false)

  const { room, participants, categories, picks, onlineIds, loading, notFound, error } = useRoom(
    roomId,
    identity?.participantId,
    identity?.displayName
  )

  const myParticipantId = identity?.participantId ?? null
  const viewingParticipantId = selectedParticipantId ?? myParticipantId

  const picksByParticipant = useMemo(() => {
    const map = new Map()
    for (const pick of picks) {
      if (!map.has(pick.participant_id)) map.set(pick.participant_id, new Map())
      map.get(pick.participant_id).set(pick.category_id, pick)
    }
    return map
  }, [picks])

  const scoredCategoryCount = useMemo(() => categories.filter((c) => c.is_scored).length, [categories])

  const progressByParticipant = useMemo(() => {
    const map = new Map()
    for (const p of participants) {
      const done = categories.filter((c) => c.is_scored && picksByParticipant.get(p.id)?.has(c.id)).length
      map.set(p.id, { done, total: scoredCategoryCount })
    }
    return map
  }, [participants, categories, picksByParticipant, scoredCategoryCount])

  const compatibility = useMemo(
    () => computeCompatibility(participants, categories, picks),
    [participants, categories, picks]
  )

  if (loading) {
    return <div className="center-state">Loading room...</div>
  }

  if (notFound) {
    return (
      <div className="center-state">
        <div>
          <p>This room doesn't exist or the link is invalid.</p>
          <p style={{ marginTop: 12 }}>
            <Link to="/" className="btn">
              Back Home
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="center-state">Something went wrong: {error}</div>
  }

  if (!identity) {
    return (
      <JoinGate
        roomId={roomId}
        roomName={room?.name}
        onJoined={(newIdentity) => {
          setIdentity(newIdentity)
          setSelectedParticipantId(newIdentity.participantId)
        }}
      />
    )
  }

  const isHost = participants.find((p) => p.id === myParticipantId)?.is_host ?? false
  const isEditable = viewingParticipantId === myParticipantId
  const viewingPicks = picksByParticipant.get(viewingParticipantId) ?? new Map()
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null

  async function handleSelectAnime(pickFields) {
    const { error: upsertError } = await supabase.from('picks').upsert(
      {
        room_id: roomId,
        participant_id: myParticipantId,
        category_id: activeCategoryId,
        ...pickFields,
      },
      { onConflict: 'participant_id,category_id' }
    )
    setActiveCategoryId(null)
    if (upsertError) {
      // eslint-disable-next-line no-console
      console.error('Failed to save pick:', upsertError.message)
    }
  }

  async function handleAddCategory(name) {
    const { error: insertError } = await supabase.from('categories').insert({
      room_id: roomId,
      name,
      is_scored: false,
      sort_order: categories.length,
    })
    if (insertError) throw insertError
  }

  return (
    <div className="container">
      <RoomHeader room={room} participants={participants} onlineIds={onlineIds} myParticipantId={myParticipantId} />
      <CompatBanner compatibility={compatibility} />
      <ParticipantTabs
        participants={participants}
        selectedParticipantId={viewingParticipantId}
        onSelect={setSelectedParticipantId}
        onlineIds={onlineIds}
        myParticipantId={myParticipantId}
        progressByParticipant={progressByParticipant}
      />
      <BoardGrid
        categories={categories}
        picksByCategoryId={viewingPicks}
        isEditable={isEditable}
        onChangeSelection={setActiveCategoryId}
        isHost={isHost}
        onAddCategory={() => setShowAddCategory(true)}
      />

      {activeCategory && (
        <SearchModal
          categoryName={activeCategory.name}
          onClose={() => setActiveCategoryId(null)}
          onSelect={handleSelectAnime}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal onClose={() => setShowAddCategory(false)} onCreate={handleAddCategory} />
      )}
    </div>
  )
}
