import { z } from 'zod'
import { searchResponseEnvelopeSchema } from './envelope.js'

const videoVariantSchema = z.object({
  url: z.string().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  size: z.number().nullish(),
  thumbnail: z.string().nullish(),
})

export type VideoVariant = z.infer<typeof videoVariantSchema>

// Lenient by design: only `id` is required — see schemas/image.ts for the rationale.
export const videoSchema = z.object({
  id: z.number(),
  pageURL: z.string().nullish(),
  type: z.string().nullish(),
  tags: z.string().nullish(),
  duration: z.number().nullish(),
  videos: z
    .object({
      large: videoVariantSchema.nullish(),
      medium: videoVariantSchema.nullish(),
      small: videoVariantSchema.nullish(),
      tiny: videoVariantSchema.nullish(),
    })
    .nullish(),
  views: z.number().nullish(),
  downloads: z.number().nullish(),
  likes: z.number().nullish(),
  comments: z.number().nullish(),
  user_id: z.number().nullish(),
  user: z.string().nullish(),
  userImageURL: z.string().nullish(),
})

export type Video = z.infer<typeof videoSchema>

export const videoSearchResponseSchema = searchResponseEnvelopeSchema.extend({
  hits: z.array(videoSchema).optional().default([]),
})

export type VideoSearchResponse = z.infer<typeof videoSearchResponseSchema>
