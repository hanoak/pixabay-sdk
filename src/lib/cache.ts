/**
 * A pluggable cache backing the mandatory 24-hour response cache Pixabay's
 * terms require. Pass a custom implementation via
 * {@link PixabayClientOptions.cache} — e.g. a Redis-backed one, if this SDK
 * runs across short-lived invocations where an in-memory `Map` never
 * persists between calls.
 */
export interface Cache {
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T, ttlMs: number) => Promise<void>
}

interface CacheEntry {
  value: unknown
  expiresAt: number
}

/**
 * The default {@link Cache} — an in-memory `Map`. `now` is injectable so
 * tests can control TTL expiry without waiting real time.
 */
export function createInMemoryCache(now: () => number = Date.now): Cache {
  const store = new Map<string, CacheEntry>()

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const entry = store.get(key)
      if (!entry) {
        return undefined
      }
      if (now() >= entry.expiresAt) {
        store.delete(key)
        return undefined
      }
      return entry.value as T
    },
    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
      store.set(key, { value, expiresAt: now() + ttlMs })
    },
  }
}

export type CacheKeyParams = Record<string, string | number | boolean | string[] | undefined>

// Keyed on the normalized request — endpoint + sorted params — never the raw
// querystring, so the `key` query param can never end up inside a cache key,
// and param order (e.g. {a,b} vs {b,a}) never creates duplicate cache entries.
export function buildCacheKey(endpoint: string, params: CacheKeyParams): string {
  const normalized = Object.entries(params)
    .filter(([paramName, value]) => paramName !== 'key' && value !== undefined)
    .map(
      ([paramName, value]) =>
        [paramName, Array.isArray(value) ? value.join(',') : String(value)] as const,
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([paramName, value]) => `${paramName}=${value}`)
    .join('&')

  return `${endpoint}?${normalized}`
}
