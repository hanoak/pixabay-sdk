export {
  PixabayApiError,
  PixabayConfigError,
  PixabayError,
  PixabayNetworkError,
  PixabayNotFoundError,
  PixabayRateLimitError,
  PixabayResponseError,
  PixabayValidationError,
} from './errors.js'
export type { PixabayRateLimitErrorOptions } from './errors.js'

export { createNoopLogger, createConsoleLogger } from './lib/logger.js'
export type { Logger, LogLevel } from './lib/logger.js'

export { createInMemoryCache } from './lib/cache.js'
export type { Cache } from './lib/cache.js'

// Remaining exports (PixabayClient, resource/param/result types,
// formatAttribution) land in later phases — see docs/ROADMAP.md.
