import { z } from 'zod'
import type { HttpClient } from '../lib/http.js'
import type { Logger } from '../lib/logger.js'
import { validateInput } from '../lib/validate.js'
import {
  imageSearchResponseSchema,
  type Image,
  type ImageSearchResponse,
} from '../schemas/image.js'
import { parseResponse } from '../schemas/parse.js'
import {
  CATEGORIES,
  getParamsSchema,
  getSingleHit,
  LANGUAGES,
  ORDERS,
  type GetParams,
  type RequestOptions,
  type ResourceConfig,
} from './shared.js'

const IMAGES_ENDPOINT = 'https://pixabay.com/api/'

const IMAGE_TYPES = ['all', 'photo', 'illustration', 'vector'] as const
const ORIENTATIONS = ['all', 'horizontal', 'vertical'] as const

const COLORS = [
  'grayscale',
  'transparent',
  'red',
  'orange',
  'yellow',
  'green',
  'turquoise',
  'blue',
  'lilac',
  'pink',
  'white',
  'gray',
  'black',
  'brown',
] as const

// No `callback`/`pretty` — those are JSONP/pretty-print concerns for a raw HTTP
// caller, not this fetch-and-parse SDK.
const imageSearchParamsSchema = z.object({
  q: z.string().max(100).optional(),
  lang: z.enum(LANGUAGES).optional(),
  id: z.number().int().positive().optional(),
  image_type: z.enum(IMAGE_TYPES).optional(),
  orientation: z.enum(ORIENTATIONS).optional(),
  category: z.enum(CATEGORIES).optional(),
  min_width: z.number().int().nonnegative().optional(),
  min_height: z.number().int().nonnegative().optional(),
  colors: z.array(z.enum(COLORS)).optional(),
  editors_choice: z.boolean().optional(),
  safesearch: z.boolean().optional(),
  order: z.enum(ORDERS).optional(),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().min(3).max(200).optional(),
})

/**
 * Params for {@link ImagesResource.search}. Mirrors Pixabay's documented
 * image search parameters (see https://pixabay.com/api/docs/#api_search_images)
 * — `q`, `lang`, `image_type`, `orientation`, `category`, `min_width`/
 * `min_height`, `colors`, `editors_choice`, `order`, and pagination via
 * `page`/`per_page` (clamped 3–200). `safesearch` defaults to the client's
 * own default (see {@link PixabayClientOptions.safesearch}) when omitted.
 */
export type ImageSearchParams = z.infer<typeof imageSearchParamsSchema>

/** Params for {@link ImagesResource.get}. */
export type ImageGetParams = GetParams

/**
 * Search for and fetch Pixabay images. Accessed via
 * {@link PixabayClient.images} — not constructed directly.
 */
export class ImagesResource {
  readonly #http: HttpClient
  readonly #logger: Logger
  readonly #defaultSafesearch: boolean

  /** @internal */
  constructor(config: ResourceConfig) {
    this.#http = config.http
    this.#logger = config.logger
    this.#defaultSafesearch = config.defaultSafesearch
  }

  /**
   * Search Pixabay images. Returns Pixabay's response envelope and hit array
   * untrimmed — use {@link ImagesResource.get} for a single known id.
   *
   * @throws {PixabayValidationError} if `params` fails validation.
   * @throws {PixabayApiError} on a non-ok Pixabay response (or {@link PixabayRateLimitError} specifically on a 429).
   * @throws {PixabayNetworkError} on a timeout or transport failure.
   */
  async search(
    params: ImageSearchParams = {},
    options: RequestOptions = {},
  ): Promise<ImageSearchResponse> {
    const validated = validateInput(imageSearchParamsSchema, params)
    const requestParams = {
      ...validated,
      safesearch: validated.safesearch ?? this.#defaultSafesearch,
    }
    const json = await this.#http.request(IMAGES_ENDPOINT, requestParams, options.signal)
    return parseResponse(imageSearchResponseSchema, json, 'image search', this.#logger)
  }

  /**
   * Fetch a single Pixabay image by id. Internally the same search-with-`id`
   * request as {@link ImagesResource.search} (confirmed against Pixabay's
   * docs that `id` is a filter on the search endpoint, not a separate
   * route), with the single hit unwrapped.
   *
   * `safesearch` still applies to an id lookup — a safe-searched-away id
   * resolves to zero hits just like a filtered-out search hit would.
   * Override it per call if you need to look up explicit content.
   *
   * @throws {PixabayNotFoundError} if Pixabay has no result for this id.
   */
  async get(params: ImageGetParams, options: RequestOptions = {}): Promise<Image> {
    const validated = validateInput(getParamsSchema, params)
    const requestParams = {
      id: validated.id,
      safesearch: validated.safesearch ?? this.#defaultSafesearch,
    }
    return getSingleHit(
      this.#http,
      IMAGES_ENDPOINT,
      requestParams,
      imageSearchResponseSchema,
      'image get',
      this.#logger,
      `No Pixabay image found for id ${validated.id}`,
      options.signal,
    )
  }
}
