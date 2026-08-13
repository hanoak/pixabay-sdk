import { z } from 'zod'
import { PixabayNotFoundError } from '../errors.js'
import type { CacheKeyParams } from '../lib/cache.js'
import type { HttpClient } from '../lib/http.js'
import type { Logger } from '../lib/logger.js'
import { parseResponse } from '../schemas/parse.js'

/** Per-call options accepted by every resource method. */
export interface RequestOptions {
  /** Cancels the request, combined internally with the client's own timeout. */
  signal?: AbortSignal
}

/** @internal */
export interface ResourceConfig {
  http: HttpClient
  logger: Logger
  defaultSafesearch: boolean
}

// Shared between images and videos search params — confirmed identical for
// both endpoints against pixabay.com/api/docs/.
export const LANGUAGES = [
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

export const CATEGORIES = [
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

export const ORDERS = ['popular', 'latest'] as const

// Identical shape for both images.get() and videos.get() — `id` is a filter on
// the search endpoint for both resources, not a separate route (see CLAUDE.md's
// "Public API surface").
export const getParamsSchema = z.object({
  id: z.number().int().positive(),
  // safesearch still applies to an id lookup — a safe-searched-away id resolves
  // to zero hits just like a filtered-out search hit would. Overridable per
  // call for exactly that reason.
  safesearch: z.boolean().optional(),
})

export type GetParams = z.infer<typeof getParamsSchema>

/**
 * Shared validate -> request -> parse -> unwrap-single-hit flow behind both
 * {@link ImagesResource.get} and {@link VideosResource.get}. `id` is a filter
 * on the same search endpoint for both resources, not a separate route, so
 * "found" and "not found" both come back as a `hits` array to unwrap.
 */
export async function getSingleHit<Schema extends z.ZodType<{ hits: unknown[] }>>(
  http: HttpClient,
  endpoint: string,
  requestParams: CacheKeyParams,
  responseSchema: Schema,
  context: string,
  logger: Logger,
  notFoundMessage: string,
  signal: AbortSignal | undefined,
): Promise<z.infer<Schema>['hits'][number]> {
  const json = await http.request(endpoint, requestParams, signal)
  const response = parseResponse(responseSchema, json, context, logger)
  const hit = response.hits[0]
  if (!hit) {
    throw new PixabayNotFoundError(notFoundMessage)
  }
  return hit
}
