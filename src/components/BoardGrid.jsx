import CategoryCard from './CategoryCard.jsx'

export default function BoardGrid({ categories, picksByCategoryId, isEditable, onChangeSelection, isHost, onAddCategory }) {
  return (
    <div className="board-grid">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          pick={picksByCategoryId.get(category.id) ?? null}
          isEditable={isEditable}
          onChangeSelection={onChangeSelection}
        />
      ))}
      {isEditable && isHost && (
        <button type="button" className="add-category-tile" onClick={onAddCategory}>
          + Add Bonus Category
        </button>
      )}
    </div>
  )
}
