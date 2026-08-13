import type { z } from 'zod'

// Base of the typed error hierarchy — never a raw fetch/zod error reaches the
// consumer. Every subclass sets `this.name` explicitly (not `new.target.name`)
// so both `instanceof` and `.name` survive bundling/minification.
export class PixabayError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PixabayError'
  }
}

// Bad/missing constructor config (e.g. no apiKey) — thrown synchronously by
// `new PixabayClient(...)`, before any network call could happen.
export class PixabayConfigError extends PixabayError {
  constructor(message: string) {
    super(message)
    this.name = 'PixabayConfigError'
  }
}

// Bad input caught by zod before a request is made.
export class PixabayValidationError extends PixabayError {
  readonly issues: z.core.$ZodIssue[]

  constructor(message: string, issues: z.core.$ZodIssue[]) {
    super(message)
    this.name = 'PixabayValidationError'
    this.issues = issues
  }
}

// A 4xx/5xx response from Pixabay itself.
export class PixabayApiError extends PixabayError {
  readonly status: number
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

export interface PixabayRateLimitErrorOptions {
  pixabayMessage?: string
  retryAfter?: number
  limit?: number
  remaining?: number
}

// 429 specifically — carries whatever rate-limit headers Pixabay sent back.
export class PixabayRateLimitError extends PixabayApiError {
  // See the `declare` comment on PixabayApiError.pixabayMessage above.
  declare readonly retryAfter?: number
  declare readonly limit?: number
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

// `images.get`/`videos.get` resolved to zero hits — Pixabay itself returns a
// 200 with an empty `hits` array for an unknown id, so this status is
// synthesized by the SDK, not passed through from a real Pixabay response.
export class PixabayNotFoundError extends PixabayApiError {
  constructor(message: string) {
    super(404, message)
    this.name = 'PixabayNotFoundError'
  }
}

// Timeout/abort/transport failure — never carries the request URL (it may
// contain `key=`); see lib/redact.ts and lib/http.ts.
export class PixabayNetworkError extends PixabayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PixabayNetworkError'
  }
}
