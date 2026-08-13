import { describe, expect, it } from 'vitest'
import { buildCacheKey, createInMemoryCache } from '../../src/lib/cache.js'

describe('createInMemoryCache', () => {
  it('returns undefined for a key that was never set', async () => {
    const cache = createInMemoryCache()
    await expect(cache.get('missing')).resolves.toBeUndefined()
  })

  it('returns a stored value before its TTL elapses, then evicts it after', async () => {
    let time = 0
    const cache = createInMemoryCache(() => time)
    await cache.set('k', 'v', 1000)

    time += 999
    await expect(cache.get('k')).resolves.toBe('v')

    time += 1
    await expect(cache.get('k')).resolves.toBeUndefined()
  })
})

describe('buildCacheKey', () => {
  it('strips the `key` param so it can never leak into a cache key', () => {
    expect(buildCacheKey('https://pixabay.com/api/', { key: 'secret', q: 'cats' })).toBe(
      'https://pixabay.com/api/?q=cats',
    )
  })

  it('is order-independent, so param order never creates duplicate cache entries', () => {
    const a = buildCacheKey('https://pixabay.com/api/', { q: 'cats', colors: ['red', 'blue'] })
    const b = buildCacheKey('https://pixabay.com/api/', { colors: ['red', 'blue'], q: 'cats' })
    expect(a).toBe(b)
  })
})
