export interface Redactor {
  redact: (input: string) => string
}

const PLACEHOLDER = '[REDACTED]'

// Guard against redacting trivially short secrets, which would mangle unrelated
// text (e.g. a 1-char "secret" replacing every occurrence of that character).
const MIN_SECRET_LENGTH = 4

// Pixabay's key is only ever accepted as a query param — there's no header
// alternative to leak-proof by default. This strips the literal key (and its
// URL-encoded form, in case it ever contains characters that get percent-encoded)
// from any string before it reaches a log line (via the injected Logger) or a
// thrown error's message.
export function createRedactor(apiKey: string): Redactor {
  if (!apiKey || apiKey.length < MIN_SECRET_LENGTH) {
    return { redact: (input) => input }
  }

  const patterns = Array.from(new Set([apiKey, encodeURIComponent(apiKey)]))

  return {
    redact(input: string): string {
      return patterns.reduce((result, pattern) => result.split(pattern).join(PLACEHOLDER), input)
    },
  }
}
