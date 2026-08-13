import { describe, expect, it, vi } from 'vitest'
import { formatAttribution, PixabayClient } from '../src/index.js'

// Pixabay's own documented example response (pixabay.com/api/docs/) — same
// fixture used in test/schemas/image.test.ts, exercised here through the
// full public composition instead of the schema in isolation.
const REAL_IMAGE_RESPONSE = {
  total: 4692,
  totalHits: 500,
  hits: [
    {
      id: 195893,
      pageURL: 'https://pixabay.com/en/blossom-bloom-flower-195893/',
      tags: 'blossom, bloom, flower',
      webformatURL: 'https://pixabay.com/get/35bbf209e13e39d2_640.jpg',
      user: 'Josch13',
    },
  ],
}

describe('PixabayClient (integration)', () => {
  it('searches images end-to-end, from the public entry point through to a real response shape', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(REAL_IMAGE_RESPONSE), { status: 200 }),
    )
    const client = new PixabayClient({ apiKey: 'integration-test-key', fetch: fetchImpl })

    const result = await client.images.search({ q: 'flowers' })

    expect(result.total).toBe(4692)
    expect(result.hits[0]?.id).toBe(195893)
    expect(formatAttribution(result.hits[0] ?? {})).toBe('by Josch13 via Pixabay')

    const [, requestInit] = fetchImpl.mock.calls[0] ?? []
    expect((requestInit as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })
})
