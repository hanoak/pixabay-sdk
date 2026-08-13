import { z } from 'zod'
import { searchResponseEnvelopeSchema } from './envelope.js'

// Lenient by design: only `id` is required. Every other field is optional/nullable
// so an upstream field add/rename/reorder degrades gracefully instead of throwing.
// Unlike the sibling MCP server's trimmed wire schema (which only kept what its own
// token-conscious formatters needed), this covers the full documented field set —
// this SDK returns the parsed object to the consumer untrimmed, so nothing here
// should be dropped just because a formatter doesn't happen to use it yet.
export const imageSchema = z.object({
  id: z.number(),
  pageURL: z.string().nullish(),
  type: z.string().nullish(),
  tags: z.string().nullish(),
  previewURL: z.string().nullish(),
  previewWidth: z.number().nullish(),
  previewHeight: z.number().nullish(),
  webformatURL: z.string().nullish(),
  webformatWidth: z.number().nullish(),
  webformatHeight: z.number().nullish(),
  largeImageURL: z.string().nullish(),
  // fullHDURL/imageURL/vectorURL/imageWidth/imageHeight/imageSize require Pixabay's
  // "full API access" approval tier — may be absent for a standard key.
  fullHDURL: z.string().nullish(),
  imageURL: z.string().nullish(),
  vectorURL: z.string().nullish(),
  imageWidth: z.number().nullish(),
  imageHeight: z.number().nullish(),
  imageSize: z.number().nullish(),
  views: z.number().nullish(),
  downloads: z.number().nullish(),
  likes: z.number().nullish(),
  comments: z.number().nullish(),
  user_id: z.number().nullish(),
  user: z.string().nullish(),
  userImageURL: z.string().nullish(),
})

/**
 * A single Pixabay image, as returned by {@link ImagesResource.search} (in
 * `hits`) or {@link ImagesResource.get}. `fullHDURL`/`imageURL`/`vectorURL`/
 * `imageWidth`/`imageHeight`/`imageSize` require Pixabay's "full API access"
 * approval tier and may be absent for a standard key. Only `id` is
 * guaranteed — every other field degrades gracefully to `null`/`undefined`
 * if Pixabay ever adds, renames, or omits it.
 */
export type Image = z.infer<typeof imageSchema>

export const imageSearchResponseSchema = searchResponseEnvelopeSchema.extend({
  hits: z.array(imageSchema).optional().default([]),
})

/** The result of {@link ImagesResource.search} — Pixabay's response envelope, untrimmed. */
export type ImageSearchResponse = z.infer<typeof imageSearchResponseSchema>
