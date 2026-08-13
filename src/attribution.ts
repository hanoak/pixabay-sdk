/**
 * Formats a courtesy attribution credit for an {@link Image} or {@link Video}
 * — e.g. `formatAttribution(image)` → `"by Josch13 via Pixabay"`.
 *
 * This is a courtesy, not a legal requirement: Pixabay License content is
 * usable without attribution. Never gate functionality on this.
 */
// `| undefined` is required, not just `| null`: this takes a real Image/Video
// directly, and zod's `.nullish()` on `user` infers `string | null | undefined`
// — exactOptionalPropertyTypes rejects passing that through a narrower
// `user?: string | null` parameter.
export function formatAttribution(item: { user?: string | null | undefined }): string {
  return item.user ? `by ${item.user} via Pixabay` : 'via Pixabay'
}
