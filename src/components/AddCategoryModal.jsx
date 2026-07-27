import { useState } from 'react'

export default function AddCategoryModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a category name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate(trimmed)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add category.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add Bonus Category</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Bonus categories are just for fun — they won't count toward the compatibility score.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="search-input"
            placeholder="e.g. Worst Anime, Underrated Gem..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Adding...' : 'Add Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
