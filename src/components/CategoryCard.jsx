export default function CategoryCard({ category, pick, isEditable, onChangeSelection }) {
  return (
    <div className="card">
      <div className="card-header">
        <span>{category.name}</span>
        {!category.is_scored && <span className="bonus-tag">Bonus</span>}
      </div>
      <div className="poster-container">
        {pick ? (
          <img className="poster-img" src={pick.image_url} alt={pick.title} />
        ) : (
          <div className="poster-placeholder">No pick yet</div>
        )}
      </div>
      <div className="card-body">
        <div className={pick ? 'anime-title' : 'anime-title empty'}>
          {pick ? pick.title : 'Not picked yet'}
        </div>
        {isEditable && (
          <button type="button" className="btn btn-block" onClick={() => onChangeSelection(category.id)}>
            {pick ? 'Change Selection' : 'Pick an Anime'}
          </button>
        )}
      </div>
    </div>
  )
}
