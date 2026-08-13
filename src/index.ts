export { PixabayClient } from './client.js'
export type { PixabayClientOptions } from './client.js'

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

export type { RateLimitInfo } from './lib/http.js'

export type { Image, ImageSearchResponse } from './schemas/image.js'
export type { Video, VideoSearchResponse, VideoVariant } from './schemas/video.js'

// Type-only: PixabayClient.images/.videos are typed as these classes, so the
// generated API reference needs them documentable — but they're never
// exported as runtime values. PixabayClient is the only composition root;
// construct resources through it, not directly.
export type { ImageGetParams, ImagesResource, ImageSearchParams } from './resources/images.js'
export type { VideoGetParams, VideosResource, VideoSearchParams } from './resources/videos.js'
export type { RequestOptions } from './resources/shared.js'

export { formatAttribution } from './attribution.js'

export { version } from './version.js'
