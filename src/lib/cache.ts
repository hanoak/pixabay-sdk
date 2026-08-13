export interface Cache {
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T, ttlMs: number) => Promise<void>
}

interface CacheEntry {
  value: unknown
  expiresAt: number
}

// Default in-memory implementation. `now` is injectable so tests can control
// TTL expiry without waiting real time.
//
// The Cache interface itself is async even though nothing here actually
// awaits anything — a consumer running this SDK across short-lived
// serverless invocations needs a Redis/etc-backed implementation (an
// in-memory Map never persists across invocations there), and an async
// interface lets that be a drop-in swap instead of a later breaking change.
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
