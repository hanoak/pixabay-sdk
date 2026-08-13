import { PixabayConfigError } from './errors.js'
import { createInMemoryCache, type Cache } from './lib/cache.js'
import { createHttpClient, type HttpClientConfig, type RateLimitInfo } from './lib/http.js'
import { createNoopLogger, type Logger } from './lib/logger.js'
import { createRedactor } from './lib/redact.js'
import { ImagesResource } from './resources/images.js'
import { VideosResource } from './resources/videos.js'

/** Constructor options for {@link PixabayClient}. */
export interface PixabayClientOptions {
  /** Falls back to `process.env.PIXABAY_API_KEY` when omitted. */
  apiKey?: string
  /**
   * Backs the mandatory 24-hour response cache Pixabay's terms require.
   * Defaults to an in-memory implementation — swap in a Redis-backed (or
   * similar) {@link Cache} if this SDK runs across short-lived invocations.
   */
  cache?: Cache
  /** Defaults to a silent no-op logger. See {@link createConsoleLogger} for an opt-in convenience. */
  logger?: Logger
  /** Defaults to the global `fetch`. Override for testing or a custom transport. */
  fetch?: typeof fetch
  /** Per-request timeout, in milliseconds. Defaults to 10 seconds. */
  timeoutMs?: number
  /** Applied when a search/get call omits its own `safesearch`. Defaults to `true`. */
  safesearch?: boolean
  /** Called after every response with whatever `X-RateLimit-*` headers Pixabay sent back. */
  onRateLimit?: (info: RateLimitInfo) => void
}

const DEFAULT_SAFESEARCH = true

/**
 * The entry point for this SDK. Wraps the Pixabay images and videos search
 * APIs behind a resource-namespaced client with a mandatory response cache,
 * retry/backoff, and a typed error hierarchy.
 *
 * @example
 * ```ts
 * const pixabay = new PixabayClient({ apiKey: process.env.PIXABAY_API_KEY })
 * const { hits } = await pixabay.images.search({ q: 'cats' })
 * ```
 */
export class PixabayClient {
  /** Search and fetch Pixabay images. */
  readonly images: ImagesResource
  /** Search and fetch Pixabay videos. */
  readonly videos: VideosResource

  /** @throws {PixabayConfigError} if no API key is available from either `options.apiKey` or `PIXABAY_API_KEY`. */
  constructor(options: PixabayClientOptions = {}) {
    // `||`, not `??` — an empty string is as unusable as a missing key.
    const apiKey = options.apiKey || process.env.PIXABAY_API_KEY
    if (!apiKey) {
      throw new PixabayConfigError(
        'Missing Pixabay API key. Pass { apiKey } to `new PixabayClient()`, or set the ' +
          'PIXABAY_API_KEY environment variable. Get a free key at https://pixabay.com/api/docs/.',
      )
    }

    const logger = options.logger ?? createNoopLogger()
    const cache = options.cache ?? createInMemoryCache()
    const redactor = createRedactor(apiKey)

    // Built up conditionally, not via `{ ...options }` spread — exactOptionalPropertyTypes
    // requires an optional field to be genuinely absent or a definite value, never a
    // possibly-undefined one, so a read of `options.fetch` (typed `T | undefined`) can't be
    // assigned straight through to HttpClientConfig's `fetch?: T`.
    const httpConfig: HttpClientConfig = { apiKey, cache, logger, redactor }
    if (options.fetch !== undefined) {
      httpConfig.fetch = options.fetch
    }
    if (options.timeoutMs !== undefined) {
      httpConfig.timeoutMs = options.timeoutMs
    }
    if (options.onRateLimit !== undefined) {
      httpConfig.onRateLimit = options.onRateLimit
    }
    const http = createHttpClient(httpConfig)

    const defaultSafesearch = options.safesearch ?? DEFAULT_SAFESEARCH

    this.images = new ImagesResource({ http, logger, defaultSafesearch })
    this.videos = new VideosResource({ http, logger, defaultSafesearch })
  }
}
