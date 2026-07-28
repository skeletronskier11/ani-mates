const MAX_BADGES = 4
const HIGH_OVERLAP_THRESHOLD = 0.6

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1
  let intersectionSize = 0
  for (const value of setA) {
    if (setB.has(value)) intersectionSize++
  }
  const unionSize = setA.size + setB.size - intersectionSize
  return unionSize === 0 ? 1 : intersectionSize / unionSize
}

function pairKey(participantId, categoryId) {
  return `${participantId}:${categoryId}`
}

/**
 * Generalizes the 2-user "direct match" formula to N participants: an overall
 * score blending exact-title unanimity with average pairwise genre overlap,
 * computed only over scored categories every current participant has picked.
 */
export function computeCompatibility(participants, categories, picks) {
  const scoredCategories = categories.filter((c) => c.is_scored)
  const picksByKey = new Map(picks.map((p) => [pairKey(p.participant_id, p.category_id), p]))
  const participantIds = participants.map((p) => p.id)

  const completeCategories = scoredCategories.filter((cat) =>
    participantIds.every((pid) => picksByKey.has(pairKey(pid, cat.id)))
  )

  const base = {
    completedCategories: completeCategories.length,
    totalScored: scoredCategories.length,
  }

  if (participantIds.length < 2 || completeCategories.length === 0) {
    return { ...base, score: null, badges: [] }
  }

  const pairs = []
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      pairs.push([participantIds[i], participantIds[j]])
    }
  }

  const unanimousMatches = []
  const overlapByCategory = new Map()

  for (const cat of completeCategories) {
    const picksForCat = participantIds.map((pid) => picksByKey.get(pairKey(pid, cat.id)))
    const uniqueAnilistIds = new Set(picksForCat.map((p) => p.anilist_id))
    if (uniqueAnilistIds.size === 1) {
      unanimousMatches.push({ category: cat, title: picksForCat[0].title })
    }

    const overlaps = pairs.map(([a, b]) => {
      const pickA = picksByKey.get(pairKey(a, cat.id))
      const pickB = picksByKey.get(pairKey(b, cat.id))
      return jaccard(new Set(pickA.genres), new Set(pickB.genres))
    })
    overlapByCategory.set(
      cat.id,
      overlaps.reduce((sum, v) => sum + v, 0) / overlaps.length
    )
  }

  const exactMatchRate = unanimousMatches.length / completeCategories.length
  const avgGenreOverlap =
    [...overlapByCategory.values()].reduce((sum, v) => sum + v, 0) / completeCategories.length
  const score = Math.round(100 * (0.6 * exactMatchRate + 0.4 * avgGenreOverlap))

  const badges = buildBadges({ score, unanimousMatches, overlapByCategory, completeCategories })

  return { ...base, score, exactMatchRate, avgGenreOverlap, badges }
}

function buildBadges({ score, unanimousMatches, overlapByCategory, completeCategories }) {
  const badges = []

  if (score === 100) {
    badges.push({ key: 'perfect', label: '💯 Perfect Match!' })
  }

  const matchedCategoryIds = new Set(unanimousMatches.map((m) => m.category.id))

  for (const match of unanimousMatches) {
    badges.push({
      key: `match-${match.category.id}`,
      label: `⭐ Direct Match: ${match.title} (${match.category.name})`,
    })
  }

  const highOverlap = completeCategories
    .filter((cat) => !matchedCategoryIds.has(cat.id) && overlapByCategory.get(cat.id) >= HIGH_OVERLAP_THRESHOLD)
    .sort((a, b) => overlapByCategory.get(b.id) - overlapByCategory.get(a.id))

  for (const cat of highOverlap) {
    badges.push({
      key: `overlap-${cat.id}`,
      label: `🔥 ${Math.round(overlapByCategory.get(cat.id) * 100)}% ${cat.name} Overlap`,
    })
  }

  if (badges.length > MAX_BADGES) {
    const shown = badges.slice(0, MAX_BADGES)
    shown.push({ key: 'more', label: `+${badges.length - MAX_BADGES} more` })
    return shown
  }

  return badges
}
