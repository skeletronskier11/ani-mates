import { supabase } from './supabaseClient.js'

const JIKAN_BASE = 'https://api.jikan.moe/v4'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // anime metadata rarely changes

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeQuery(query) {
  return query.trim().toLowerCase()
}

async function readCache(normalizedQuery) {
  const { data } = await supabase
    .from('jikan_search_cache')
    .select('results, fetched_at')
    .eq('query', normalizedQuery)
    .maybeSingle()

  if (!data) return null
  const age = Date.now() - new Date(data.fetched_at).getTime()
  if (age > CACHE_TTL_MS) return null
  return data.results
}

function writeCache(normalizedQuery, results) {
  // Fire-and-forget: caching is an optimization, never something a search should fail on.
  supabase
    .from('jikan_search_cache')
    .upsert({ query: normalizedQuery, results, fetched_at: new Date().toISOString() }, { onConflict: 'query' })
    .then(() => {})
}

export async function searchAnime(query, { signal } = {}) {
  const normalized = normalizeQuery(query)

  const cached = await readCache(normalized)
  if (cached) return cached

  const url = `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=6`
  let res = await fetch(url, { signal })

  if (res.status === 429) {
    await sleep(500)
    res = await fetch(url, { signal })
  }

  if (!res.ok) {
    throw new Error(`Jikan search failed (${res.status})`)
  }

  const json = await res.json()
  const results = json.data ?? []

  writeCache(normalized, results)

  return results
}

export function toPickFields(anime) {
  return {
    mal_id: anime.mal_id,
    title: anime.title_english || anime.title,
    image_url: anime.images?.jpg?.image_url ?? null,
    anime_type: anime.type ?? null,
    year: anime.year ?? anime.aired?.prop?.from?.year ?? null,
    genres: (anime.genres ?? []).map((g) => g.name),
  }
}
