import { afterEach, describe, expect, it, vi } from 'vitest'
import { PixabayClient } from '../src/client.js'
import { PixabayConfigError } from '../src/errors.js'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('PixabayClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws PixabayConfigError when no apiKey is available anywhere', () => {
    vi.stubEnv('PIXABAY_API_KEY', '')
    expect(() => new PixabayClient()).toThrow(PixabayConfigError)
  })

  it('falls back to the PIXABAY_API_KEY environment variable when apiKey is omitted', async () => {
    vi.stubEnv('PIXABAY_API_KEY', 'env-key')
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ hits: [] }))
    const client = new PixabayClient({ fetch: fetchImpl })

    await client.images.search({ q: 'cats' })

    const [calledUrl] = fetchImpl.mock.calls[0] ?? []
    expect((calledUrl as URL).searchParams.get('key')).toBe('env-key')
  })

  it('wires .images and .videos through the injected fetch, end to end', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ hits: [{ id: 1 }] }))
    const client = new PixabayClient({ apiKey: 'ctor-key', fetch: fetchImpl })

    const images = await client.images.search({ q: 'cats' })
    const videos = await client.videos.search({ q: 'ocean' })

    expect(images.hits).toEqual([{ id: 1 }])
    expect(videos.hits).toEqual([{ id: 1 }])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
