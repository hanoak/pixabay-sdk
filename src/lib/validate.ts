import type { z } from 'zod'
import { PixabayValidationError } from '../errors.js'

// Validates public-method input against `schema` before any request is made,
// throwing PixabayValidationError synchronously relative to the call — the
// "fail before touching the network" boundary. Distinct from
// schemas/parse.ts's "passthrough-with-warn" one, which validates Pixabay's
// own response after a successful round-trip.
export function validateInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join('.') || '(root)').join(', ')
    throw new PixabayValidationError(`Invalid input: ${paths}`, result.error.issues)
  }
  return result.data
}
