import { supabase } from './supabaseClient.js'

const ANILIST_URL = 'https://graphql.anilist.co'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // anime metadata rarely changes

const SEARCH_QUERY = `
  query ($search: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
        }
        coverImage {
          large
        }
        format
        seasonYear
        genres
      }
    }
  }
`

const FORMAT_LABELS = {
  TV: 'TV',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeQuery(query) {
  return query.trim().toLowerCase()
}

export function formatLabel(format) {
  return FORMAT_LABELS[format] ?? format ?? null
}

async function readCache(normalizedQuery) {
  const { data } = await supabase
    .from('anime_search_cache')
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
    .from('anime_search_cache')
    .upsert({ query: normalizedQuery, results, fetched_at: new Date().toISOString() }, { onConflict: 'query' })
    .then(() => {})
}

async function runSearch(query, signal) {
  return fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query, perPage: 6 } }),
    signal,
  })
}

export async function searchAnime(query, { signal } = {}) {
  const normalized = normalizeQuery(query)

  const cached = await readCache(normalized)
  if (cached) return cached

  let res = await runSearch(query, signal)

  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get('retry-after')) || 1
    await sleep(retryAfterSec * 1000)
    res = await runSearch(query, signal)
  }

  if (!res.ok) {
    throw new Error(`AniList search failed (${res.status})`)
  }

  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'AniList search failed')
  }

  const results = json.data?.Page?.media ?? []

  writeCache(normalized, results)

  return results
}

export function toPickFields(anime) {
  return {
    anilist_id: anime.id,
    title: anime.title?.english || anime.title?.romaji || 'Untitled',
    image_url: anime.coverImage?.large ?? null,
    anime_type: formatLabel(anime.format),
    year: anime.seasonYear ?? null,
    genres: anime.genres ?? [],
  }
}
