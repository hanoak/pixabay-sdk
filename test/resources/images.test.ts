import { describe, expect, it, vi } from 'vitest'
import { PixabayNotFoundError, PixabayValidationError } from '../../src/errors.js'
import type { HttpClient } from '../../src/lib/http.js'
import { createNoopLogger } from '../../src/lib/logger.js'
import { ImagesResource } from '../../src/resources/images.js'

function fakeHttp(response: unknown): HttpClient {
  return { request: vi.fn(async () => response) }
}

function resourceWith(http: HttpClient, defaultSafesearch = true): ImagesResource {
  return new ImagesResource({ http, logger: createNoopLogger(), defaultSafesearch })
}

describe('ImagesResource', () => {
  it('search() applies the client default safesearch when the call omits it', async () => {
    const http = fakeHttp({ hits: [] })
    await resourceWith(http, true).search({ q: 'cats' })

    expect(http.request).toHaveBeenCalledWith(
      'https://pixabay.com/api/',
      expect.objectContaining({ q: 'cats', safesearch: true }),
      undefined,
    )
  })

  it('search() lets a per-call safesearch override the client default', async () => {
    const http = fakeHttp({ hits: [] })
    await resourceWith(http, true).search({ safesearch: false })

    expect(http.request).toHaveBeenCalledWith(
      'https://pixabay.com/api/',
      expect.objectContaining({ safesearch: false }),
      undefined,
    )
  })

  it('get() returns the single hit when Pixabay finds one', async () => {
    const http = fakeHttp({ hits: [{ id: 42 }] })
    await expect(resourceWith(http).get({ id: 42 })).resolves.toMatchObject({ id: 42 })
  })

  it('get() throws PixabayNotFoundError when Pixabay returns zero hits', async () => {
    const http = fakeHttp({ hits: [] })
    await expect(resourceWith(http).get({ id: 999 })).rejects.toBeInstanceOf(PixabayNotFoundError)
  })

  it('throws PixabayValidationError for out-of-range input, before ever calling http', async () => {
    const http = fakeHttp({ hits: [] })
    await expect(resourceWith(http).search({ per_page: 500 })).rejects.toBeInstanceOf(
      PixabayValidationError,
    )
    expect(http.request).not.toHaveBeenCalled()
  })
})
