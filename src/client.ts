import { PixabayConfigError } from './errors.js'
import { createInMemoryCache, type Cache } from './lib/cache.js'
import { createHttpClient, type HttpClientConfig, type RateLimitInfo } from './lib/http.js'
import { createNoopLogger, type Logger } from './lib/logger.js'
import { createRedactor } from './lib/redact.js'
import { ImagesResource } from './resources/images.js'
import { VideosResource } from './resources/videos.js'

export interface PixabayClientOptions {
  // Falls back to process.env.PIXABAY_API_KEY when omitted.
  apiKey?: string
  cache?: Cache
  logger?: Logger
  fetch?: typeof fetch
  timeoutMs?: number
  // Applied when a search/get call omits its own `safesearch`. Default true.
  safesearch?: boolean
  onRateLimit?: (info: RateLimitInfo) => void
}

const DEFAULT_SAFESEARCH = true

export class PixabayClient {
  readonly images: ImagesResource
  readonly videos: VideosResource

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
