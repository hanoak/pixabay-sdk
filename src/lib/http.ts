import {
  PixabayApiError,
  PixabayNetworkError,
  PixabayRateLimitError,
  PixabayResponseError,
} from '../errors.js'
import { buildCacheKey, type Cache, type CacheKeyParams } from './cache.js'
import type { Logger } from './logger.js'
import type { Redactor } from './redact.js'

/**
 * Pixabay's `X-RateLimit-*` response headers, parsed. Passed to
 * {@link PixabayClientOptions.onRateLimit} after every response. Any field
 * may be absent if Pixabay didn't send the corresponding header.
 */
export interface RateLimitInfo {
  /** Your key's request limit per window, from `X-RateLimit-Limit`. */
  limit?: number
  /** Requests remaining in the current window, from `X-RateLimit-Remaining`. */
  remaining?: number
  /** Seconds until the window resets, from `X-RateLimit-Reset`. */
  reset?: number
}

export interface HttpClientConfig {
  apiKey: string
  cache: Cache
  logger: Logger
  redactor: Redactor
  fetch?: typeof fetch
  timeoutMs?: number
  cacheTtlMs?: number
  onRateLimit?: (info: RateLimitInfo) => void
}

export interface HttpClient {
  request: (
    endpoint: string,
    params: CacheKeyParams,
    // Decides whether a fresh (non-cached) response is worth caching — the
    // caller passes its own zod schema's safeParse check, so a response that
    // fails schema validation never gets cached and replayed for 24h. Kept as
    // an opaque predicate rather than importing zod here: this module stays
    // schema-agnostic, per CLAUDE.md's separation of transport (lib/http.ts)
    // from Pixabay's response shape (schemas/*.ts).
    isCacheable: (json: unknown) => boolean,
    signal?: AbortSignal,
  ) => Promise<unknown>
}

const DEFAULT_TIMEOUT_MS = 10_000

// Pixabay's terms require every response to be cached for 24 hours.
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Pixabay's documented rate-limit window — a ceiling on how long we'll ever wait,
// in case a future X-RateLimit-Reset value is unexpectedly large.
const MAX_BACKOFF_SECONDS = 60

// A single fixed delay before the one considered retry on a 5xx — there's no
// server-provided guidance here (unlike 429's X-RateLimit-Reset), so this is a
// short, deliberately conservative wait rather than an unbounded/exponential scheme.
const SERVER_ERROR_RETRY_DELAY_MS = 500

// Single choke point for request-URL construction, since Pixabay only accepts
// the API key as a query param. The URL built here is only ever handed to
// fetch() — it must never be logged or included in an error message; see
// `attempt` and the redactor it wraps errors with below. Not exported: this
// choke point is only meaningful from inside this module, and exporting it
// would invite a future caller to bypass it.
function buildUrl(endpoint: string, apiKey: string, params: CacheKeyParams): URL {
  const url = new URL(endpoint)
  url.searchParams.set('key', apiKey)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  return url
}

function parseRateLimitInfo(response: Response): RateLimitInfo {
  const limit = response.headers.get('X-RateLimit-Limit')
  const remaining = response.headers.get('X-RateLimit-Remaining')
  const reset = response.headers.get('X-RateLimit-Reset')
  const info: RateLimitInfo = {}
  if (limit !== null && Number.isFinite(Number(limit))) info.limit = Number(limit)
  if (remaining !== null && Number.isFinite(Number(remaining))) info.remaining = Number(remaining)
  if (reset !== null && Number.isFinite(Number(reset))) info.reset = Number(reset)
  return info
}

// Parses rate-limit headers off `response` and notifies both observability
// surfaces this SDK offers: the caller's onRateLimit callback and a debug
// log line, so rate-limit visibility is available even to a consumer who
// only configured a Logger.
function notifyRateLimit(config: HttpClientConfig, response: Response): RateLimitInfo {
  const info = parseRateLimitInfo(response)
  if (info.remaining !== undefined) {
    config.logger.debug(`Pixabay rate limit remaining: ${info.remaining}`)
  }
  config.onRateLimit?.(info)
  return info
}

function parseRetryAfterSeconds(reset: number | undefined): number | undefined {
  if (reset === undefined || reset < 0) {
    return undefined
  }
  return Math.min(reset, MAX_BACKOFF_SECONDS)
}

function describeStatus(status: number): string {
  if (status === 400) return 'Pixabay rejected the request as malformed'
  if (status === 403)
    return 'Pixabay rejected the request as forbidden — check that the API key is valid and active'
  if (status === 429) return 'Pixabay API rate limit exceeded'
  if (status >= 500)
    return "Pixabay's API returned a server error — this is usually transient, try again shortly"
  return 'Pixabay API request failed'
}

function buildErrorMessage(status: number, detail: string): string {
  const description = describeStatus(status)
  return detail ? `${description}: ${detail}` : description
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchImpl = config.fetch ?? fetch
  // Per attempt, not a ceiling on the overall request(): a retried call gets a
  // fresh timeoutMs for its own fetch, separate from whatever backoff delay
  // preceded it (the 429 backoff in particular can itself be up to
  // MAX_BACKOFF_SECONDS — folding that into a single overall deadline would
  // mean a long, deliberate rate-limit wait could burn the entire budget and
  // make the retry it was waiting to permit fail instantly instead of never
  // being attempted at all, which is a worse outcome). Documented as such in
  // PixabayClientOptions.timeoutMs and the README rather than silently implied
  // to be a total-latency cap.
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS

  async function attempt(
    endpoint: string,
    params: CacheKeyParams,
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    const url = buildUrl(endpoint, config.apiKey, params)
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const combinedSignal = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal
    try {
      return await fetchImpl(url, { signal: combinedSignal })
    } catch (error) {
      // fetch() itself can throw with the request URL embedded in its message
      // (e.g. on a DNS/connection failure) — the URL carries the `key` query
      // param, so redact before this can ever reach a log line or a thrown
      // error. Deliberately not attaching `cause: error` — that would smuggle
      // the raw, unredacted message right back in for anything that inspects it.
      const isTimeout = error instanceof Error && error.name === 'TimeoutError'
      const message = isTimeout
        ? `Pixabay request timed out after ${timeoutMs / 1000}s`
        : error instanceof Error
          ? error.message
          : String(error)
      throw new PixabayNetworkError(config.redactor.redact(message))
    }
  }

  // The one retry, unified: log why, wait, re-attempt, re-notify. Both the 429
  // and 5xx call sites in request() below differ only in the delay and the
  // log message — this was previously two hand-duplicated copies.
  async function retryOnce(
    endpoint: string,
    params: CacheKeyParams,
    signal: AbortSignal | undefined,
    delayMs: number,
    logMessage: string,
  ): Promise<{ response: Response; rateLimitInfo: RateLimitInfo }> {
    config.logger.warn(logMessage)
    await wait(delayMs)
    const response = await attempt(endpoint, params, signal)
    const rateLimitInfo = notifyRateLimit(config, response)
    return { response, rateLimitInfo }
  }

  // Every outbound GET routes through the cache (Pixabay's terms require 24h
  // caching) — but only once `isCacheable` confirms the body is worth
  // caching; a response that fails the caller's schema check is returned
  // as-is (so the caller can still throw its usual typed error) without ever
  // being written to the cache, so a transient bad payload doesn't replay
  // for 24h after Pixabay recovers.
  //
  // Exactly one considered retry, never a blind or looping one: on 429, back
  // off using X-RateLimit-Reset (only if Pixabay actually told us how long to
  // wait — otherwise fail fast rather than guess); on 5xx, back off a short
  // fixed delay since there's no equivalent server-provided guidance.
  async function request(
    endpoint: string,
    params: CacheKeyParams,
    isCacheable: (json: unknown) => boolean,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const cacheKey = buildCacheKey(endpoint, params)
    const cached = await config.cache.get<unknown>(cacheKey)
    if (cached !== undefined) {
      config.logger.debug(`cache hit for ${endpoint}`)
      return cached
    }

    let response = await attempt(endpoint, params, signal)
    let rateLimitInfo = notifyRateLimit(config, response)

    if (response.status === 429) {
      const retryAfterSeconds = parseRetryAfterSeconds(rateLimitInfo.reset)
      if (retryAfterSeconds !== undefined) {
        const retried = await retryOnce(
          endpoint,
          params,
          signal,
          retryAfterSeconds * 1000,
          `Pixabay rate limit hit — backing off ${retryAfterSeconds}s before one retry`,
        )
        response = retried.response
        rateLimitInfo = retried.rateLimitInfo
      }
    } else if (response.status >= 500) {
      const retried = await retryOnce(
        endpoint,
        params,
        signal,
        SERVER_ERROR_RETRY_DELAY_MS,
        `Pixabay returned ${response.status} — retrying once after ${SERVER_ERROR_RETRY_DELAY_MS}ms`,
      )
      response = retried.response
      rateLimitInfo = retried.rateLimitInfo
    }

    if (!response.ok) {
      // Never include `url` here — it carries the `key` query param. Redacted
      // too, as defense-in-depth in case Pixabay's error body ever echoes back
      // a param.
      const body = await response.text().catch(() => '')
      const detail = config.redactor.redact(body || response.statusText)
      const message = buildErrorMessage(response.status, detail)

      if (response.status === 429) {
        const options: {
          pixabayMessage: string
          retryAfter?: number
          limit?: number
          remaining?: number
        } = {
          pixabayMessage: detail,
        }
        const retryAfter = parseRetryAfterSeconds(rateLimitInfo.reset)
        if (retryAfter !== undefined) options.retryAfter = retryAfter
        if (rateLimitInfo.limit !== undefined) options.limit = rateLimitInfo.limit
        if (rateLimitInfo.remaining !== undefined) options.remaining = rateLimitInfo.remaining
        throw new PixabayRateLimitError(message, options)
      }

      throw new PixabayApiError(response.status, message, detail)
    }

    // Read as text first, not response.json() directly: a malformed/truncated
    // body (e.g. a CDN error page during an outage) throws a raw SyntaxError
    // from .json(), which would otherwise leak past this SDK's typed error
    // hierarchy. Redact defensively before it can reach a log line, same
    // reasoning as the non-ok body above.
    const bodyText = await response.text()
    let json: unknown
    try {
      json = JSON.parse(bodyText)
    } catch {
      config.logger.warn(`response body from ${endpoint} was not valid JSON`)
      throw new PixabayResponseError(endpoint)
    }

    if (isCacheable(json)) {
      await config.cache.set(cacheKey, json, cacheTtlMs)
    }
    return json
  }

  return { request }
}
