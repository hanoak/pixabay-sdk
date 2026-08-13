import { describe, expect, it } from 'vitest'
import {
  PixabayApiError,
  PixabayConfigError,
  PixabayError,
  PixabayNetworkError,
  PixabayNotFoundError,
  PixabayRateLimitError,
  PixabayValidationError,
} from '../src/errors.js'

describe('PixabayError hierarchy', () => {
  it('sets name and message on the base class', () => {
    const error = new PixabayError('boom')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('PixabayError')
    expect(error.message).toBe('boom')
  })

  it('PixabayConfigError is a PixabayError', () => {
    const error = new PixabayConfigError('missing apiKey')
    expect(error).toBeInstanceOf(PixabayError)
    expect(error.name).toBe('PixabayConfigError')
  })

  it('PixabayValidationError carries the zod issues', () => {
    const issues = [{ code: 'custom', message: 'bad', path: ['q'] }] as never
    const error = new PixabayValidationError('invalid input', issues)
    expect(error).toBeInstanceOf(PixabayError)
    expect(error.name).toBe('PixabayValidationError')
    expect(error.issues).toBe(issues)
  })

  it('PixabayApiError carries status and, when provided, pixabayMessage', () => {
    const withMessage = new PixabayApiError(400, 'bad request', "Missing parameter 'q'")
    expect(withMessage.status).toBe(400)
    expect(withMessage.pixabayMessage).toBe("Missing parameter 'q'")

    const withoutMessage = new PixabayApiError(500, 'server error')
    expect(withoutMessage.status).toBe(500)
    // exactOptionalPropertyTypes discipline: absent, not explicitly undefined.
    expect('pixabayMessage' in withoutMessage).toBe(false)
  })

  it('PixabayRateLimitError is a PixabayApiError with status 429 and optional rate-limit fields', () => {
    const error = new PixabayRateLimitError('rate limited', {
      retryAfter: 30,
      limit: 100,
      remaining: 0,
    })
    expect(error).toBeInstanceOf(PixabayApiError)
    expect(error.status).toBe(429)
    expect(error.retryAfter).toBe(30)
    expect(error.limit).toBe(100)
    expect(error.remaining).toBe(0)

    const bare = new PixabayRateLimitError('rate limited')
    expect('retryAfter' in bare).toBe(false)
    expect('limit' in bare).toBe(false)
    expect('remaining' in bare).toBe(false)
  })

  it('PixabayNotFoundError is a PixabayApiError with status 404', () => {
    const error = new PixabayNotFoundError('no hits for id 123')
    expect(error).toBeInstanceOf(PixabayApiError)
    expect(error.status).toBe(404)
    expect(error.name).toBe('PixabayNotFoundError')
  })

  it('PixabayNetworkError carries the original error as cause', () => {
    const original = new Error('ECONNRESET')
    const error = new PixabayNetworkError('request failed', { cause: original })
    expect(error).toBeInstanceOf(PixabayError)
    expect(error.cause).toBe(original)
  })
})
