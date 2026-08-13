import { z } from 'zod'

// Shared response-envelope fields returned by both Pixabay search endpoints
// (images and videos). Nullish, like every other wire-schema field here — a
// missing/renamed field degrades gracefully instead of breaking every search call.
export const searchResponseEnvelopeSchema = z.object({
  total: z.number().nullish(),
  totalHits: z.number().nullish(),
})
