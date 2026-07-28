import { useEffect, useRef, useState } from 'react'
import { searchAnime, toPickFields, formatLabel } from '../lib/anilist.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'

export default function SearchModal({ categoryName, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const debouncedQuery = useDebouncedValue(query, 400)
  const abortRef = useRef(null)

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearching(true)
    setError(null)
    setResults([])
    searchAnime(trimmed, { signal: controller.signal })
      .then((data) => {
        setResults(data)
        setSearching(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError('Search failed. Try again in a moment.')
        setSearching(false)
      })

    return () => controller.abort()
  }, [debouncedQuery])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Select for: {categoryName}</h3>
        <input
          type="text"
          className="search-input"
          placeholder="Search AniList..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="results-list">
          {searching && <div className="results-hint">Searching...</div>}
          {error && <div className="error-text">{error}</div>}
          {!searching && !error && query.trim().length >= 2 && results.length === 0 && (
            <div className="results-hint">No results found.</div>
          )}
          {results.map((anime) => (
            <button
              key={anime.id}
              type="button"
              className="result-item"
              onClick={() => onSelect(toPickFields(anime))}
            >
              <img src={anime.coverImage?.large} alt="" />
              <div>
                <strong style={{ fontSize: 14 }}>{anime.title?.english || anime.title?.romaji}</strong>
                <div className="meta">
                  {formatLabel(anime.format) || 'TV'} • {anime.seasonYear || 'N/A'}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
