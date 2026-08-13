import { z } from 'zod'
import { PixabayNotFoundError } from '../errors.js'
import type { HttpClient } from '../lib/http.js'
import type { Logger } from '../lib/logger.js'
import { validateInput } from '../lib/validate.js'
import type { RequestOptions } from './images.js'
import {
  videoSearchResponseSchema,
  type Video,
  type VideoSearchResponse,
} from '../schemas/video.js'
import { parseResponse } from '../schemas/parse.js'

const VIDEOS_ENDPOINT = 'https://pixabay.com/api/videos/'

const LANGUAGES = [
  'cs',
  'da',
  'de',
  'en',
  'es',
  'fr',
  'id',
  'it',
  'hu',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'sk',
  'fi',
  'sv',
  'tr',
  'vi',
  'th',
  'bg',
  'ru',
  'el',
  'ja',
  'ko',
  'zh',
] as const

const VIDEO_TYPES = ['all', 'film', 'animation'] as const

const CATEGORIES = [
  'backgrounds',
  'fashion',
  'nature',
  'science',
  'education',
  'feelings',
  'health',
  'people',
  'religion',
  'places',
  'animals',
  'industry',
  'computer',
  'food',
  'sports',
  'transportation',
  'travel',
  'buildings',
  'business',
  'music',
] as const

const ORDERS = ['popular', 'latest'] as const

// No `orientation`/`colors` — confirmed directly against pixabay.com/api/docs/
// that those two are image-only params, not shared with the video endpoint
// (an earlier draft of this SDK's own notes assumed otherwise). No
// `callback`/`pretty` either, same reasoning as resources/images.ts.
const videoSearchParamsSchema = z.object({
  q: z.string().max(100).optional(),
  lang: z.enum(LANGUAGES).optional(),
  id: z.number().int().positive().optional(),
  video_type: z.enum(VIDEO_TYPES).optional(),
  category: z.enum(CATEGORIES).optional(),
  min_width: z.number().int().nonnegative().optional(),
  min_height: z.number().int().nonnegative().optional(),
  editors_choice: z.boolean().optional(),
  safesearch: z.boolean().optional(),
  order: z.enum(ORDERS).optional(),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().min(3).max(200).optional(),
})

/**
 * Params for {@link VideosResource.search}. Mirrors Pixabay's documented
 * video search parameters (see https://pixabay.com/api/docs/#api_search_videos)
 * — `q`, `lang`, `video_type`, `category`, `min_width`/`min_height`,
 * `editors_choice`, `order`, and pagination via `page`/`per_page` (clamped
 * 3–200). Unlike image search, there is no `orientation` or `colors` param —
 * confirmed against Pixabay's docs that those are image-only.
 * `safesearch` defaults to the client's own default when omitted.
 */
export type VideoSearchParams = z.infer<typeof videoSearchParamsSchema>

const videoGetParamsSchema = z.object({
  id: z.number().int().positive(),
  safesearch: z.boolean().optional(),
})

/** Params for {@link VideosResource.get}. */
export type VideoGetParams = z.infer<typeof videoGetParamsSchema>

/** @internal */
export interface VideosResourceConfig {
  http: HttpClient
  logger: Logger
  defaultSafesearch: boolean
}

/**
 * Search for and fetch Pixabay videos. Accessed via
 * {@link PixabayClient.videos} — not constructed directly.
 */
export class VideosResource {
  readonly #http: HttpClient
  readonly #logger: Logger
  readonly #defaultSafesearch: boolean

  /** @internal */
  constructor(config: VideosResourceConfig) {
    this.#http = config.http
    this.#logger = config.logger
    this.#defaultSafesearch = config.defaultSafesearch
  }

  /**
   * Search Pixabay videos. Returns Pixabay's response envelope and hit array
   * untrimmed — use {@link VideosResource.get} for a single known id.
   *
   * @throws {PixabayValidationError} if `params` fails validation.
   * @throws {PixabayApiError} on a non-ok Pixabay response (or {@link PixabayRateLimitError} specifically on a 429).
   * @throws {PixabayNetworkError} on a timeout or transport failure.
   */
  async search(
    params: VideoSearchParams = {},
    options: RequestOptions = {},
  ): Promise<VideoSearchResponse> {
    const validated = validateInput(videoSearchParamsSchema, params)
    const requestParams = {
      ...validated,
      safesearch: validated.safesearch ?? this.#defaultSafesearch,
    }
    const json = await this.#http.request(VIDEOS_ENDPOINT, requestParams, options.signal)
    return parseResponse(videoSearchResponseSchema, json, 'video search', this.#logger)
  }

  /**
   * Fetch a single Pixabay video by id. Internally the same search-with-`id`
   * request as {@link VideosResource.search}, with the single hit unwrapped.
   *
   * @throws {PixabayNotFoundError} if Pixabay has no result for this id.
   */
  async get(params: VideoGetParams, options: RequestOptions = {}): Promise<Video> {
    const validated = validateInput(videoGetParamsSchema, params)
    const requestParams = {
      id: validated.id,
      safesearch: validated.safesearch ?? this.#defaultSafesearch,
    }
    const json = await this.#http.request(VIDEOS_ENDPOINT, requestParams, options.signal)
    const response = parseResponse(videoSearchResponseSchema, json, 'video get', this.#logger)
    const hit = response.hits[0]
    if (!hit) {
      throw new PixabayNotFoundError(`No Pixabay video found for id ${validated.id}`)
    }
    return hit
  }
}
