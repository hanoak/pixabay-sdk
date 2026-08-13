import { describe, expect, it } from 'vitest'
import { videoSearchResponseSchema } from '../../src/schemas/video.js'

// Pixabay's own documented example response (pixabay.com/api/docs/), trimmed to
// one hit — real field shapes, not hand-invented data.
const REAL_VIDEO_RESPONSE = {
  total: 42,
  totalHits: 42,
  hits: [
    {
      id: 125,
      pageURL: 'https://pixabay.com/videos/id-125/',
      type: 'film',
      tags: 'flowers, yellow, blossom',
      duration: 12,
      videos: {
        large: {
          url: 'https://cdn.pixabay.com/video/2015/08/08/125-135736646_large.mp4',
          width: 1920,
          height: 1080,
          size: 6615235,
          thumbnail: 'https://cdn.pixabay.com/video/2015/08/08/125-135736646_large.jpg',
        },
        medium: {
          url: 'https://cdn.pixabay.com/video/2015/08/08/125-135736646_medium.mp4',
          width: 1280,
          height: 720,
          size: 3562083,
          thumbnail: 'https://cdn.pixabay.com/video/2015/08/08/125-135736646_medium.jpg',
        },
      },
      user_id: 1281706,
      user: 'Coverr-Free-Footage',
      userImageURL: 'https://cdn.pixabay.com/user/2015/10/16/09-28-45-303_250x250.png',
    },
  ],
}

describe('videoSearchResponseSchema', () => {
  it('parses a real Pixabay video response, including the nested videos.* variants', () => {
    const result = videoSearchResponseSchema.parse(REAL_VIDEO_RESPONSE)
    expect(result.hits[0]?.id).toBe(125)
    expect(result.hits[0]?.videos?.large?.width).toBe(1920)
    expect(result.hits[0]?.videos?.medium?.url).toContain('_medium.mp4')
  })

  it('rejects a hit missing `id`', () => {
    expect(() => videoSearchResponseSchema.parse({ hits: [{ tags: 'no id here' }] })).toThrow()
  })
})
