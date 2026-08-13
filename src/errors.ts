import type { z } from 'zod'

/**
 * Base of this SDK's typed error hierarchy. Every method that can fail throws
 * a subclass of this instead of a raw `fetch` or zod error.
 *
 * Every subclass sets `this.name` explicitly (not `new.target.name`) so both
 * `instanceof` and `.name` survive bundling/minification.
 */
export class PixabayError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PixabayError'
  }
}

/**
 * Bad or missing {@link PixabayClient} constructor configuration — for
 * example, no API key from either the constructor option or the
 * `PIXABAY_API_KEY` environment variable. Thrown synchronously by
 * `new PixabayClient(...)`, before any network call could happen.
 */
export class PixabayConfigError extends PixabayError {
  constructor(message: string) {
    super(message)
    this.name = 'PixabayConfigError'
  }
}

/**
 * Input rejected by zod validation before a request was ever made — for
 * example, `per_page` outside Pixabay's documented 3–200 range.
 */
export class PixabayValidationError extends PixabayError {
  /** The underlying zod validation issues. */
  readonly issues: z.core.$ZodIssue[]

  constructor(message: string, issues: z.core.$ZodIssue[]) {
    super(message)
    this.name = 'PixabayValidationError'
    this.issues = issues
  }
}

/** A 4xx/5xx response from Pixabay itself. */
export class PixabayApiError extends PixabayError {
  /** The HTTP status code Pixabay responded with. */
  readonly status: number
  /** Pixabay's own error message, if the response body had one. */
  // `declare`: under target ES2022, a plain class-field declaration emits a
  // native define (eagerly setting the field to `undefined`) before the
  // constructor body runs, which would make the field always "present" and
  // defeat the exactOptionalPropertyTypes distinction below. `declare` opts
  // this field out of that emission — the constructor's conditional
  // assignment becomes the only thing that ever creates it.
  declare readonly pixabayMessage?: string

  constructor(status: number, message: string, pixabayMessage?: string) {
    super(message)
    this.name = 'PixabayApiError'
    this.status = status
    // exactOptionalPropertyTypes: only assign when defined, never `= undefined`.
    if (pixabayMessage !== undefined) {
      this.pixabayMessage = pixabayMessage
    }
  }
}

/** Options accepted by the {@link PixabayRateLimitError} constructor. */
export interface PixabayRateLimitErrorOptions {
  pixabayMessage?: string
  retryAfter?: number
  limit?: number
  remaining?: number
}

/**
 * A `429` response from Pixabay — you've exceeded the ~100 requests/60s rate
 * limit. Carries whatever `X-RateLimit-*` headers Pixabay sent back with the
 * response.
 */
export class PixabayRateLimitError extends PixabayApiError {
  /** Seconds to wait before retrying, from Pixabay's `X-RateLimit-Reset` header. */
  // See the `declare` comment on PixabayApiError.pixabayMessage above.
  declare readonly retryAfter?: number
  /** Your key's request limit per window, from `X-RateLimit-Limit`. */
  declare readonly limit?: number
  /** Requests remaining in the current window, from `X-RateLimit-Remaining`. */
  declare readonly remaining?: number

  constructor(message: string, options: PixabayRateLimitErrorOptions = {}) {
    super(429, message, options.pixabayMessage)
    this.name = 'PixabayRateLimitError'
    if (options.retryAfter !== undefined) {
      this.retryAfter = options.retryAfter
    }
    if (options.limit !== undefined) {
      this.limit = options.limit
    }
    if (options.remaining !== undefined) {
      this.remaining = options.remaining
    }
  }
}

/**
 * Thrown by `images.get()`/`videos.get()` when Pixabay has no result for the
 * given id. Pixabay itself returns `200 OK` with an empty `hits` array for an
 * unknown id — this status is synthesized by the SDK, not passed through
 * from a real Pixabay response.
 */
export class PixabayNotFoundError extends PixabayApiError {
  constructor(message: string) {
    super(404, message)
    this.name = 'PixabayNotFoundError'
  }
}

/**
 * A timeout, cancellation, or other transport-level failure — the request
 * never got a response from Pixabay at all. Never carries the request URL
 * (it may contain the API key); see `lib/redact.ts` and `lib/http.ts`.
 */
export class PixabayNetworkError extends PixabayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PixabayNetworkError'
  }
}

/**
 * Pixabay returned `200 OK`, but the response body didn't match even this
 * SDK's lenient wire schema (only `id` is required — see `schemas/image.ts`).
 * Distinct from {@link PixabayValidationError}, which is about your input,
 * checked before a request is ever sent — this is about Pixabay's own
 * response shape, discovered after a successful HTTP round-trip.
 */
export class PixabayResponseError extends PixabayError {
  constructor(context: string, options?: ErrorOptions) {
    super(`Unexpected Pixabay response shape for ${context}.`, options)
    this.name = 'PixabayResponseError'
  }
}
