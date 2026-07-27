export default function CompatBanner({ compatibility }) {
  const { score, completedCategories, totalScored, badges } = compatibility

  return (
    <div className="compat-banner">
      <div className="compat-details">
        <h2>Watch Party Compatibility</h2>
        <p>
          {score === null
            ? `Waiting for more picks... (${completedCategories}/${totalScored} categories complete)`
            : 'Score based on genre overlap and direct title matches across the group.'}
        </p>
        {score !== null && (
          <div className="badges">
            {badges.length === 0 ? (
              <span className="badge">No strong overlaps yet</span>
            ) : (
              badges.map((b) => (
                <span className="badge" key={b.key}>
                  {b.label}
                </span>
              ))
            )}
          </div>
        )}
      </div>
      <div className={score === null ? 'score-circle pending' : 'score-circle'}>
        {score === null ? 'Waiting...' : `${score}%`}
      </div>
    </div>
  )
}
