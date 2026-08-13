import { describe, expect, it, vi } from 'vitest'
import { PixabayApiError, PixabayNetworkError, PixabayRateLimitError } from '../../src/errors.js'
import { createHttpClient } from '../../src/lib/http.js'
import { createInMemoryCache } from '../../src/lib/cache.js'
import { createNoopLogger } from '../../src/lib/logger.js'
import { createRedactor } from '../../src/lib/redact.js'

function jsonResponse(
  body: unknown,
  init: ResponseInit & { headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), { status: 200, ...init })
}

function baseConfig(fetchImpl: typeof fetch) {
  return {
    apiKey: 'test-api-key',
    cache: createInMemoryCache(),
    logger: createNoopLogger(),
    redactor: createRedactor('test-api-key'),
    fetch: fetchImpl,
  }
}

describe('createHttpClient', () => {
  it('builds the request URL with the apiKey and params, and caches a successful response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ hits: [] }))
    const client = createHttpClient(baseConfig(fetchImpl))

    const result = await client.request('https://pixabay.com/api/', { q: 'cats' })

    expect(result).toEqual({ hits: [] })
    const [calledUrl] = fetchImpl.mock.calls[0] ?? []
    expect((calledUrl as URL).searchParams.get('key')).toBe('test-api-key')
    expect((calledUrl as URL).searchParams.get('q')).toBe('cats')

    await client.request('https://pixabay.com/api/', { q: 'cats' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries exactly once on 429, honoring X-RateLimit-Reset, then throws PixabayRateLimitError', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('rate limited', {
          status: 429,
          headers: { 'X-RateLimit-Reset': '0', 'X-RateLimit-Remaining': '0' },
        }),
    )
    const client = createHttpClient(baseConfig(fetchImpl))

    await expect(client.request('https://pixabay.com/api/', { q: 'cats' })).rejects.toBeInstanceOf(
      PixabayRateLimitError,
    )
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('retries exactly once on a 5xx, then throws PixabayApiError', async () => {
    const fetchImpl = vi.fn(async () => new Response('oops', { status: 500 }))
    const client = createHttpClient(baseConfig(fetchImpl))

    const error = await client.request('https://pixabay.com/api/', { q: 'cats' }).catch((e) => e)
    expect(error).toBeInstanceOf(PixabayApiError)
    expect((error as PixabayApiError).status).toBe(500)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('maps a transport failure to PixabayNetworkError with the apiKey redacted from the message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connect failed for https://pixabay.com/api/?key=test-api-key')
    })
    const client = createHttpClient(baseConfig(fetchImpl))

    const error = await client.request('https://pixabay.com/api/', { q: 'cats' }).catch((e) => e)
    expect(error).toBeInstanceOf(PixabayNetworkError)
    expect((error as Error).message).not.toContain('test-api-key')
  })

  it('surfaces rate-limit headers via the onRateLimit callback and a debug log line', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { hits: [] },
        { headers: { 'X-RateLimit-Limit': '100', 'X-RateLimit-Remaining': '99' } },
      ),
    )
    const onRateLimit = vi.fn()
    const logger = createNoopLogger()
    const debugSpy = vi.spyOn(logger, 'debug')
    const client = createHttpClient({ ...baseConfig(fetchImpl), logger, onRateLimit })

    await client.request('https://pixabay.com/api/', { q: 'cats' })

    expect(onRateLimit).toHaveBeenCalledWith({ limit: 100, remaining: 99 })
    expect(debugSpy).toHaveBeenCalledWith('Pixabay rate limit remaining: 99')
  })

  it("maps a non-ok, non-429 response to PixabayApiError carrying Pixabay's own message", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("Bad Request. Missing parameter 'q'.", { status: 400 }),
    )
    const client = createHttpClient(baseConfig(fetchImpl))

    const error = await client.request('https://pixabay.com/api/', {}).catch((e) => e)
    expect(error).toBeInstanceOf(PixabayApiError)
    expect((error as PixabayApiError).status).toBe(400)
    expect((error as PixabayApiError).pixabayMessage).toBe("Bad Request. Missing parameter 'q'.")
  })
})
