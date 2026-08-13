import { z } from 'zod'
import { PixabayNotFoundError } from '../errors.js'
import type { HttpClient } from '../lib/http.js'
import type { Logger } from '../lib/logger.js'
import { validateInput } from '../lib/validate.js'
import {
  imageSearchResponseSchema,
  type Image,
  type ImageSearchResponse,
} from '../schemas/image.js'
import { parseResponse } from '../schemas/parse.js'

const IMAGES_ENDPOINT = 'https://pixabay.com/api/'

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

const IMAGE_TYPES = ['all', 'photo', 'illustration', 'vector'] as const
const ORIENTATIONS = ['all', 'horizontal', 'vertical'] as const

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

const ORDERS = ['popular', 'latest'] as const

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

export type ImageSearchParams = z.infer<typeof imageSearchParamsSchema>

const imageGetParamsSchema = z.object({
  id: z.number().int().positive(),
  // safesearch still applies to an id lookup — Pixabay's `id` param is a
  // filter on the same search endpoint, not a separate route, so a safe-
  // searched-away id resolves to zero hits just like a filtered-out search
  // hit would. Overridable per call for exactly that reason.
  safesearch: z.boolean().optional(),
})

export type ImageGetParams = z.infer<typeof imageGetParamsSchema>

export interface RequestOptions {
  signal?: AbortSignal
}

export interface ImagesResourceConfig {
  http: HttpClient
  logger: Logger
  defaultSafesearch: boolean
}

export class ImagesResource {
  readonly #http: HttpClient
  readonly #logger: Logger
  readonly #defaultSafesearch: boolean

  constructor(config: ImagesResourceConfig) {
    this.#http = config.http
    this.#logger = config.logger
    this.#defaultSafesearch = config.defaultSafesearch
  }

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

  async get(params: ImageGetParams, options: RequestOptions = {}): Promise<Image> {
    const validated = validateInput(imageGetParamsSchema, params)
    const requestParams = {
      id: validated.id,
      safesearch: validated.safesearch ?? this.#defaultSafesearch,
    }
    const json = await this.#http.request(IMAGES_ENDPOINT, requestParams, options.signal)
    const response = parseResponse(imageSearchResponseSchema, json, 'image get', this.#logger)
    const hit = response.hits[0]
    if (!hit) {
      throw new PixabayNotFoundError(`No Pixabay image found for id ${validated.id}`)
    }
    return hit
  }
}
