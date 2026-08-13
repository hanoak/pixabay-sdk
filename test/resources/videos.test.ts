import { describe, expect, it, vi } from 'vitest'
import { PixabayNotFoundError } from '../../src/errors.js'
import type { HttpClient } from '../../src/lib/http.js'
import { createNoopLogger } from '../../src/lib/logger.js'
import { VideosResource } from '../../src/resources/videos.js'

function fakeHttp(response: unknown): HttpClient {
  return { request: vi.fn(async () => response) }
}

function resourceWith(http: HttpClient): VideosResource {
  return new VideosResource({ http, logger: createNoopLogger(), defaultSafesearch: true })
}

describe('VideosResource', () => {
  it('search() sends the video-specific params (video_type, category) to the videos endpoint', async () => {
    const http = fakeHttp({ hits: [] })
    await resourceWith(http).search({ q: 'ocean', video_type: 'film', category: 'nature' })

    expect(http.request).toHaveBeenCalledWith(
      'https://pixabay.com/api/videos/',
      expect.objectContaining({
        q: 'ocean',
        video_type: 'film',
        category: 'nature',
        safesearch: true,
      }),
      expect.any(Function),
      undefined,
    )
  })

  it('get() throws PixabayNotFoundError when Pixabay returns zero hits', async () => {
    const http = fakeHttp({ hits: [] })
    await expect(resourceWith(http).get({ id: 999 })).rejects.toBeInstanceOf(PixabayNotFoundError)
  })
})
