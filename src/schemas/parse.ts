import type { z } from 'zod'
import { PixabayResponseError } from '../errors.js'
import type { Logger } from '../lib/logger.js'

// Validate `data` against `schema`, warning (via the caller's own configured
// logger — never a fresh default-level one, which would ignore what the
// consumer actually asked for) and throwing PixabayResponseError on mismatch.
// This is the "passthrough-with-warn" boundary: lenient schemas absorb most
// upstream drift, and the rare genuine mismatch is surfaced loudly rather than
// crashing opaquely with a raw ZodError.
export function parseResponse<Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
  context: string,
  logger: Logger,
): z.infer<Schema> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join('.') || '(root)').join(', ')
    logger.warn(`response validation failed for ${context}: ${paths}`)
    throw new PixabayResponseError(context, { cause: result.error })
  }
  return result.data
}
