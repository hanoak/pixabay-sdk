import { describe, expect, it } from 'vitest'
import { imageSearchResponseSchema } from '../../src/schemas/image.js'

// Pixabay's own documented example response (pixabay.com/api/docs/), trimmed to
// one hit — real field shapes, not hand-invented data.
const REAL_IMAGE_RESPONSE = {
  total: 4692,
  totalHits: 500,
  hits: [
    {
      id: 195893,
      pageURL: 'https://pixabay.com/en/blossom-bloom-flower-195893/',
      type: 'photo',
      tags: 'blossom, bloom, flower',
      previewURL: 'https://cdn.pixabay.com/photo/2013/10/15/09/12/flower-195893_150.jpg',
      webformatURL: 'https://pixabay.com/get/35bbf209e13e39d2_640.jpg',
      largeImageURL: 'https://pixabay.com/get/ed6a99fd0a76647_1280.jpg',
      fullHDURL: 'https://pixabay.com/get/ed6a9369fd0a76647_1920.jpg',
      imageURL: 'https://pixabay.com/get/ed6a9364a9fd0a76647.jpg',
      imageWidth: 4000,
      imageHeight: 2250,
      user_id: 48777,
      user: 'Josch13',
      userImageURL: 'https://cdn.pixabay.com/user/2013/11/05/02-10-23-764_250x250.jpg',
    },
  ],
}

describe('imageSearchResponseSchema', () => {
  it('parses a real Pixabay image response', () => {
    const result = imageSearchResponseSchema.parse(REAL_IMAGE_RESPONSE)
    expect(result.hits[0]?.id).toBe(195893)
    expect(result.hits[0]?.user).toBe('Josch13')
  })

  it('parses a hit with only `id`, degrading gracefully when every other field is absent', () => {
    const result = imageSearchResponseSchema.parse({ hits: [{ id: 1 }] })
    expect(result.hits[0]?.id).toBe(1)
  })

  it('rejects a hit missing `id`', () => {
    expect(() => imageSearchResponseSchema.parse({ hits: [{ tags: 'no id here' }] })).toThrow()
  })
})
