# Contributing

Thanks for your interest in improving `@hanoak/pixabay-sdk`! This guide covers the dev setup
and the conventions that keep the codebase consistent. See [CLAUDE.md](CLAUDE.md) for the
full set of architectural and process decisions; this file covers the practical day-to-day.

## Development setup

Requires **Node.js >= 22**.

```bash
git clone https://github.com/hanoak/pixabay-sdk.git
cd pixabay-sdk
npm install          # also installs git hooks via husky
cp .env.example .env # optional — only used by local dev/test scripts, if any need a real key
```

### Scripts

| Command                 | What it does                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run build`         | Bundle to `dist/` with tsup (dual ESM + CJS, `.d.ts`).                                           |
| `npm run dev`           | tsup in watch mode.                                                                              |
| `npm run docs:api`      | Generate the TypeDoc API reference to `docs/api/` (gitignored).                                  |
| `npm run typecheck`     | `tsc --noEmit` (strict).                                                                         |
| `npm run lint`          | ESLint (flat config).                                                                            |
| `npm run format`        | Prettier write.                                                                                  |
| `npm test`              | Vitest (unit tests).                                                                             |
| `npm run test:coverage` | Vitest with v8 coverage + thresholds (the coverage gate).                                        |
| `npm run license:check` | Fail if any production dependency has a non-permissive license.                                  |
| `npm run check`         | typecheck + lint + format:check + test (core local gate).                                        |
| `npm run check:package` | Build, then `publint` + `attw` + the require/import smoke script — the publishable-shape checks. |

## Project structure & conventions

See [CLAUDE.md](CLAUDE.md)'s "Architecture & folder conventions" and "Coding standards"
sections — they're the source of truth, not duplicated here to avoid drift.

## Commits & branches

- **Conventional Commits** are enforced by a `commit-msg` hook (`feat:`, `fix:`, `docs:`,
  `chore:`, `refactor:`, `test:`, `ci:` …).
- A `pre-commit` hook runs gitleaks (if installed locally) + `lint-staged` (Prettier + ESLint
  on staged files) and blocks direct commits to `main`.
- Open pull requests against `main`; CI must pass — lint, typecheck, format, coverage
  thresholds, a dependency-license check, package validation (`publint` + `attw` + tarball
  contents), tests on Node 22/24 × Linux/macOS/Windows, and a gitleaks secret scan.

## Versioning & deprecation policy

This project follows [Semantic Versioning](https://semver.org), and
[CHANGELOG.md](./CHANGELOG.md) is Changesets-managed — don't hand-edit past entries or re-add
an intro paragraph (Changesets always inserts new version sections directly after the `#
Changelog` heading). **Every exported symbol from `index.ts` — class/method signatures,
exported types, error class shapes — is part of the public contract**; an incompatible
change to any of them ships only in a **major** release.

**Every PR with a user-facing change must include a changeset**: run `npx changeset add`,
pick the right bump type (major/minor/patch per the contract rule above), and commit the
generated `.changeset/*.md` file alongside your change. Without one, `changesets/action` has
nothing to version on merge to `main` and falls through to publishing directly — skipping the
"Version Packages" PR review step and leaving the CHANGELOG entry unwritten. `chore`/`docs`/
`test`-only changes with no effect on the published package don't need one.

When something must change incompatibly, we deprecate before removing: the old behavior is
kept for at least one subsequent **minor** release, called out in the CHANGELOG, and — where
possible — flagged via a `@deprecated` TSDoc tag (so it surfaces in editors and the TypeDoc
reference). Removal then happens in the next major. Additive changes (new methods, new
optional fields) are minor and backwards-compatible.
