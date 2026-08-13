// Courtesy credit only. Pixabay License content is usable without attribution
// — never gate functionality on this, and never claim it's legally required
// in docs (see CLAUDE.md's Pixabay API facts).
//
// `| undefined` is required, not just `| null`: this takes a real Image/Video
// directly, and zod's `.nullish()` on `user` infers `string | null | undefined`
// — exactOptionalPropertyTypes rejects passing that through a narrower
// `user?: string | null` parameter.
export function formatAttribution(item: { user?: string | null | undefined }): string {
  return item.user ? `by ${item.user} via Pixabay` : 'via Pixabay'
}
