import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

function upsertById(list, row) {
  const idx = list.findIndex((r) => r.id === row.id)
  if (idx === -1) return [...list, row]
  const copy = list.slice()
  copy[idx] = row
  return copy
}

function removeById(list, id) {
  return list.filter((r) => r.id !== id)
}

export function useRoom(roomId, myParticipantId, myDisplayName) {
  const [room, setRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [categories, setCategories] = useState([])
  const [picks, setPicks] = useState([])
  const [onlineIds, setOnlineIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    const { data: roomRow, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle()

    if (roomErr) {
      setError(roomErr.message)
      setLoading(false)
      return
    }
    if (!roomRow) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setRoom(roomRow)

    const [participantsRes, categoriesRes, picksRes] = await Promise.all([
      supabase.from('participants').select('*').eq('room_id', roomId).order('joined_at'),
      supabase.from('categories').select('*').eq('room_id', roomId).order('sort_order'),
      supabase.from('picks').select('*').eq('room_id', roomId),
    ])

    const firstError = participantsRes.error || categoriesRes.error || picksRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    setParticipants(participantsRes.data ?? [])
    setCategories(categoriesRes.data ?? [])
    setPicks(picksRes.data ?? [])
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!myParticipantId) return undefined

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: myParticipantId } },
    })

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setParticipants((p) => removeById(p, payload.old.id))
          else setParticipants((p) => upsertById(p, payload.new))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setCategories((c) => removeById(c, payload.old.id))
          else setCategories((c) => upsertById(c, payload.new))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'picks', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') setPicks((p) => removeById(p, payload.old.id))
          else setPicks((p) => upsertById(p, payload.new))
        }
      )
      .on('presence', { event: 'sync' }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ display_name: myDisplayName })
          // Catches up on anything written between the initial fetch and this
          // subscription going live -- notably our own just-inserted participant
          // row, which predates the channel and so never arrives as an event.
          fetchAll()
        }
      })

    const handleFocus = () => fetchAll()
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
      supabase.removeChannel(channel)
    }
  }, [roomId, myParticipantId, myDisplayName, fetchAll])

  return { room, participants, categories, picks, onlineIds, loading, notFound, error, refetch: fetchAll }
}
