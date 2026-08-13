// Courtesy credit only. Pixabay License content is usable without attribution
// — never gate functionality on this, and never claim it's legally required
// in docs (see CLAUDE.md's Pixabay API facts).
export function formatAttribution(item: { user?: string | null }): string {
  return item.user ? `by ${item.user} via Pixabay` : 'via Pixabay'
}
