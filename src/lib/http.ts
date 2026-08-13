import { PixabayApiError, PixabayNetworkError, PixabayRateLimitError } from '../errors.js'
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
  request: (endpoint: string, params: CacheKeyParams, signal?: AbortSignal) => Promise<unknown>
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

  // Every outbound GET routes through the cache (Pixabay's terms require 24h
  // caching). Exactly one considered retry, never a blind or looping one: on
  // 429, back off using X-RateLimit-Reset (only if Pixabay actually told us how
  // long to wait — otherwise fail fast rather than guess); on 5xx, back off a
  // short fixed delay since there's no equivalent server-provided guidance.
  async function request(
    endpoint: string,
    params: CacheKeyParams,
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
        config.logger.warn(
          `Pixabay rate limit hit — backing off ${retryAfterSeconds}s before one retry`,
        )
        await wait(retryAfterSeconds * 1000)
        response = await attempt(endpoint, params, signal)
        rateLimitInfo = notifyRateLimit(config, response)
      }
    } else if (response.status >= 500) {
      config.logger.warn(
        `Pixabay returned ${response.status} — retrying once after ${SERVER_ERROR_RETRY_DELAY_MS}ms`,
      )
      await wait(SERVER_ERROR_RETRY_DELAY_MS)
      response = await attempt(endpoint, params, signal)
      rateLimitInfo = notifyRateLimit(config, response)
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

    const json = await response.json()
    await config.cache.set(cacheKey, json, cacheTtlMs)
    return json
  }

  return { request }
}
