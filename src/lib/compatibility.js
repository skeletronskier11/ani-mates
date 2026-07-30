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

function getDecade(year) {
  if (!year) return null
  // Divide by 10, round down, multiply by 10 (e.g. 1998 -> 199 -> 1990)
  return Math.floor(year / 10) * 10
}

function pairKey(participantId, categoryId) {
  return `${participantId}:${categoryId}`
  const pairs = []
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      pairs.push([participantIds[i], participantIds[j]])
    }
  }
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
  const decadeOverlapByCategory = new Map()

  for (const cat of completeCategories) {
    const picksForCat = participantIds.map((pid) => picksByKey.get(pairKey(pid, cat.id)))
    const uniqueAnilistIds = new Set(picksForCat.map((p) => p.anilist_id))
    if (uniqueAnilistIds.size === 1) {
      unanimousMatches.push({ category: cat, title: picksForCat[0].title })
    }

    const genreOverlaps = pairs.map(([a, b]) => {
      const pickA = picksByKey.get(pairKey(a, cat.id))
      const pickB = picksByKey.get(pairKey(b, cat.id))
      return jaccard(new Set(pickA.genres), new Set(pickB.genres))
    })
    overlapByCategory.set(
      cat.id,
      genreOverlaps.reduce((sum, v) => sum + v, 0) / genreOverlaps.length
    )

    // Calculate decade overlap (1 for a match, 0 for a mismatch)
    const decadeOverlaps = pairs.map(([a, b]) => {
      const pickA = picksByKey.get(pairKey(a, cat.id))
      const pickB = picksByKey.get(pairKey(b, cat.id))
      const decadeA = getDecade(pickA.year)
      const decadeB = getDecade(pickB.year)
      return (decadeA && decadeB && decadeA === decadeB) ? 1 : 0
    })
    decadeOverlapByCategory.set(
      cat.id,
      decadeOverlaps.reduce((sum, v) => sum + v, 0) / decadeOverlaps.length
    )
  }

  const exactMatchRate = unanimousMatches.length / completeCategories.length
  const avgGenreOverlap =
    [...overlapByCategory.values()].reduce((sum, v) => sum + v, 0) / completeCategories.length
  const avgDecadeOverlap =
    [...decadeOverlapByCategory.values()].reduce((sum, v) => sum + v, 0) / completeCategories.length
    
  // New Weighting: 60% Exact Match + 20% Genre Overlap + 20% Decade Overlap
  const score = Math.round(100 * (0.6 * exactMatchRate + 0.2 * avgGenreOverlap + 0.2 * avgDecadeOverlap))

  const badges = buildBadges({ 
    score, 
    unanimousMatches, 
    overlapByCategory, 
    decadeOverlapByCategory, 
    completeCategories, 
    picksByKey, 
    participantIds 
  })

  return { ...base, score, exactMatchRate, avgGenreOverlap, avgDecadeOverlap, badges }
}

function buildBadges({ score, unanimousMatches, overlapByCategory, decadeOverlapByCategory, completeCategories, picksByKey, participantIds }) {
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

  const highDecadeOverlap = completeCategories
    .filter((cat) => !matchedCategoryIds.has(cat.id) && decadeOverlapByCategory.get(cat.id) === 1)

  for (const cat of highDecadeOverlap) {
    const samplePick = picksByKey.get(pairKey(participantIds[0], cat.id))
    const decade = getDecade(samplePick.year)
    if (decade) {
      badges.push({
        key: `decade-${cat.id}`,
        label: `📼 Shared ${decade}s Era in ${cat.name}`,
      })
    }
  }

  if (badges.length > MAX_BADGES) {
    const shown = badges.slice(0, MAX_BADGES)
    shown.push({ key: 'more', label: `+${badges.length - MAX_BADGES} more` })
    return shown
  }

  return badges
}
