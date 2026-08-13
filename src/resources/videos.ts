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

export type VideoSearchParams = z.infer<typeof videoSearchParamsSchema>

const videoGetParamsSchema = z.object({
  id: z.number().int().positive(),
  safesearch: z.boolean().optional(),
})

export type VideoGetParams = z.infer<typeof videoGetParamsSchema>

export interface VideosResourceConfig {
  http: HttpClient
  logger: Logger
  defaultSafesearch: boolean
}

export class VideosResource {
  readonly #http: HttpClient
  readonly #logger: Logger
  readonly #defaultSafesearch: boolean

  constructor(config: VideosResourceConfig) {
    this.#http = config.http
    this.#logger = config.logger
    this.#defaultSafesearch = config.defaultSafesearch
  }

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
