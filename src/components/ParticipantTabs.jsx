export default function ParticipantTabs({
  participants,
  selectedParticipantId,
  onSelect,
  onlineIds,
  myParticipantId,
  progressByParticipant,
}) {
  const ordered = [...participants].sort((a, b) => {
    if (a.id === myParticipantId) return -1
    if (b.id === myParticipantId) return 1
    return 0
  })

  return (
    <div className="participant-tabs">
      {ordered.map((p) => {
        const isOnline = onlineIds.has(p.id)
        const isSelected = p.id === selectedParticipantId
        const progress = progressByParticipant.get(p.id)
        return (
          <button
            key={p.id}
            type="button"
            className={`participant-tab${isSelected ? ' active' : ''}${isOnline ? ' online' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <span className="dot" />
            {p.id === myParticipantId ? 'You' : p.display_name}
            {progress && (
              <span className="progress">
                {progress.done}/{progress.total}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
