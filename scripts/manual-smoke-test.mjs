// Manual, opt-in verification against the REAL Pixabay API. Not run in CI, not part of
// any npm script — every other test in this repo uses a fake `fetch`, so this is the one
// place that actually confirms a live round-trip works (see docs/ROADMAP.md's testing
// section: "re-verify against a live response if/when a key is available").
//
// Usage:
//   npm run build
//   node --env-file=.env scripts/manual-smoke-test.mjs
//
// Requires a real PIXABAY_API_KEY in .env (copy .env.example) or in your shell env.

import {
  PixabayClient,
  PixabayNotFoundError,
  createConsoleLogger,
  formatAttribution,
} from '../dist/index.js'

const pixabay = new PixabayClient({ logger: createConsoleLogger('debug') })

console.log('\n--- images.search ---')
const images = await pixabay.images.search({ q: 'cats', per_page: 3 })
console.log(`total=${images.total} totalHits=${images.totalHits} hits=${images.hits.length}`)
for (const hit of images.hits) {
  console.log(`  #${hit.id} "${hit.tags}" -> ${hit.webformatURL} (${formatAttribution(hit)})`)
}

console.log('\n--- images.get ---')
const firstImageId = images.hits[0]?.id
if (firstImageId !== undefined) {
  const image = await pixabay.images.get({ id: firstImageId })
  console.log(`  fetched #${image.id}, previewURL=${image.previewURL}`)
}

console.log('\n--- videos.search ---')
const videos = await pixabay.videos.search({ q: 'ocean', video_type: 'film', per_page: 3 })
console.log(`total=${videos.total} totalHits=${videos.totalHits} hits=${videos.hits.length}`)
for (const hit of videos.hits) {
  console.log(
    `  #${hit.id} "${hit.tags}" -> ${hit.videos?.medium?.url} (${formatAttribution(hit)})`,
  )
}

console.log('\n--- videos.get ---')
const firstVideoId = videos.hits[0]?.id
if (firstVideoId !== undefined) {
  const video = await pixabay.videos.get({ id: firstVideoId })
  console.log(`  fetched #${video.id}, medium.url=${video.videos?.medium?.url}`)
}

console.log('\n--- images.search with varied params ---')
const imageSearchCases = [
  {
    label: 'photo, horizontal, nature',
    params: {
      q: 'mountains',
      image_type: 'photo',
      orientation: 'horizontal',
      category: 'nature',
      per_page: 3,
    },
  },
  {
    label: 'illustration, colors=red',
    params: { q: 'flower', image_type: 'illustration', colors: ['red'], per_page: 3 },
  },
  { label: 'order=latest', params: { q: 'city', order: 'latest', per_page: 3 } },
  {
    label: 'min_width/min_height',
    params: { q: 'landscape', min_width: 1920, min_height: 1080, per_page: 3 },
  },
]
for (const { label, params } of imageSearchCases) {
  const result = await pixabay.images.search(params)
  console.log(`  [${label}] total=${result.total} hits=${result.hits.length}`)
  for (const hit of result.hits) {
    console.log(
      `    #${hit.id} type=${hit.type} ${hit.imageWidth}x${hit.imageHeight} "${hit.tags}"`,
    )
  }
}

console.log('\n--- videos.search with varied params ---')
const videoSearchCases = [
  {
    label: 'animation, nature',
    params: { q: 'forest', video_type: 'animation', category: 'nature', per_page: 3 },
  },
  { label: 'order=latest', params: { q: 'city', order: 'latest', per_page: 3 } },
]
for (const { label, params } of videoSearchCases) {
  const result = await pixabay.videos.search(params)
  console.log(`  [${label}] total=${result.total} hits=${result.hits.length}`)
  for (const hit of result.hits) {
    console.log(`    #${hit.id} type=${hit.type} duration=${hit.duration}s "${hit.tags}"`)
  }
}

console.log('\n--- error paths ---')
try {
  await pixabay.images.search({ per_page: 999 })
  console.error('  UNEXPECTED: per_page=999 did not throw')
} catch (error) {
  console.log(`  per_page=999 correctly threw ${error.constructor.name}`)
}

try {
  await pixabay.images.get({ id: 999999999 })
  console.error('  UNEXPECTED: a bogus id did not throw')
} catch (error) {
  console.log(
    `  bogus id correctly threw ${error instanceof PixabayNotFoundError ? 'PixabayNotFoundError' : error.constructor.name}`,
  )
}

console.log('\n--- cache check ---')
// Timing is a more reliable signal than the "cache hit" debug log line here —
// console.debug output can be easy to miss depending on your terminal, but a
// cache hit resolving in ~0ms vs. a real network round-trip is unambiguous.
const uncachedStart = performance.now()
await pixabay.images.search({ q: 'cats', per_page: 3, category: 'animals' })
console.log(`  first call (uncached):  ${(performance.now() - uncachedStart).toFixed(1)}ms`)

const cachedStart = performance.now()
await pixabay.images.search({ q: 'cats', per_page: 3, category: 'animals' })
const cachedMs = performance.now() - cachedStart
console.log(`  repeat call (cached):   ${cachedMs.toFixed(1)}ms`)
console.log(
  cachedMs < 20
    ? '  ✅ cache hit confirmed (repeat call was near-instant)'
    : '  ⚠️  repeat call took longer than expected for a cache hit — see below',
)

console.log('\nAll manual checks completed.')
