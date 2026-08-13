# pixabay-sdk — status & roadmap

What's planned and the working v1 build list. Structure mirrors the sibling
`pixabay-mcp-server` project's `docs/ROADMAP.md`, adapted for a dual-format importable
library instead of a stdio MCP server.

## Roadmap

### 🔲 v1 — planned, nothing built yet

The public surface: `PixabayClient` with `.images`/`.videos` resources (`search`/`get`);
dual ESM+CJS build; a mandatory 24-hour response cache behind a pluggable async `Cache`
interface; default `safesearch=true`; a typed `PixabayError` hierarchy; a resilient HTTP
client (retry/backoff on 429/5xx, rate-limit-header awareness, cancellation); a pluggable
`Logger`; TypeDoc API reference; the same CI quality gates the sibling project uses
(coverage floor, dependency-license check, package validation, cross-platform test matrix,
secret scanning) plus dual-package shape validation. No OAuth, no write endpoints — Pixabay's
public API doesn't have any.

### 🔲 v2 — not planned yet

Nothing scoped. Candidates to revisit once v1 has real usage: a broader observability hook
surface beyond `onRateLimit` (still no OTel peer-dep unless a concrete need appears); a
pluggable retry-policy override; Redis/other reference `Cache` implementations shipped as
optional sub-exports.

---

## v1 implementation checklist

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done
**Tags:** `[v1]` in the first release · `[post-v1]` deferred.

---

## 0. Core stack decisions (foundational)

- [ ] `[v1]` Language/runtime: **TypeScript + Node >=22** — decided (see CLAUDE.md; higher
      than the sibling project's `>=20` floor because of dev-tooling engine requirements
      discovered at scaffold time)
- [ ] `[v1]` Runtime validation with **zod** (public-method inputs _and_ Pixabay API
      responses) — decided
- [ ] `[v1]` Module format: **dual ESM + CJS** via tsup — decided (differs from the MCP
      server's ESM-only)
- [ ] `[v1]` Use **lenient/passthrough zod on API responses** (only `id` required per
      resource) — decided, ported from the sibling project
- [ ] `[v1]` No OAuth / no `auth/` directory — Pixabay's public API has no authenticated
      write surface — decided
- [ ] `[v1]` Confirm current major versions of `zod`, `tsup`, `vitest`, `typescript`,
      `typescript-eslint`, `@arethetypeswrong/cli` at scaffold time rather than copying the
      sibling project's pins blindly.

## 1. Pixabay API compliance (legal — non-negotiable)

- [ ] `[v1]` **Document the hotlinking/persistence pass-through explicitly.** This SDK
      returns Pixabay CDN URLs as-is and makes no persistence decision — the _consuming
      app_ decides whether/how long to display or cache an image. Write this down in the
      README (a short "Image & Video URLs" section, referencing the sibling project's more
      detailed policy note) so it isn't silently assumed.
- [ ] `[v1]` **Implement the mandatory 24-hour response cache** (`src/lib/cache.ts`) behind
      an async, pluggable `Cache` interface — keyed on the normalized request (endpoint +
      sorted params, `key` stripped), never the raw querystring. Ship a default in-memory
      TTL implementation; every outbound GET must route through it.
- [ ] `[v1]` **No systematic mass downloads** — no auto-paginating helper; `search()`
      exposes `page`/`per_page` passthrough only, and the rate limit is documented.
- [ ] `[v1]` Send the API key as the `key` query parameter (Pixabay has no header option) —
      construct request URLs in one place (`src/lib/http.ts`) so redaction has a single
      choke point.
- [ ] `[v1]` Respect the rate limit: read `X-RateLimit-Limit` / `X-RateLimit-Remaining` /
      `X-RateLimit-Reset` on every response; on `429`, back off using `X-RateLimit-Reset`
      for exactly one considered retry, never a blind loop. Surface remaining/limit/reset
      via an `onRateLimit` callback hook (see CLAUDE.md's "Public API surface").
- [ ] `[v1]` Default `safesearch=true` on search methods (overridable).
- [ ] `[v1]` Ship `formatAttribution(item)` as an optional exported utility — never gate
      functionality on it, never claim it's legally required.
- [ ] `[v1]` "Unofficial — not affiliated with or endorsed by Pixabay" disclaimer in
      `package.json`'s description and the README.
- [ ] `[v1]` Document how to obtain a Pixabay API key (verify current signup/tier flow
      against `pixabay.com/api/docs/` before writing the README — don't trust older notes
      blindly, Pixabay may have changed tiers since).
- [ ] `[v1]` State that each consumer/app operates under their own Pixabay API Terms — sets
      the liability boundary, same pattern as the sibling project's README note.

## 2. Security & secrets

- [ ] `[v1]` API key via constructor param, with `PIXABAY_API_KEY` env fallback; never
      logged/committed.
- [ ] `[v1]` `.env.example` committed (for the local dev/test harness); real `.env`
      gitignored.
- [ ] `[v1]` Secret scanning (gitleaks pre-commit hook, skip-if-absent + warn locally; CI
      full-history scan).
- [ ] `[v1]` Dependency security: `npm audit --omit=dev --audit-level=high`, Dependabot,
      minimal deps (zod only in production).
- [ ] `[v1]` Input validation before hitting the API — zod schemas on every public method,
      clamping/enum-checking, `URLSearchParams`-based encoding.
- [ ] `[v1]` Supply-chain: `npm publish --provenance`, committed lockfile, SHA-pinned CI
      actions (verify current SHAs at setup time).
- [ ] `[v1]` **Fail-fast constructor validation** of `apiKey` — throws `PixabayConfigError`
      synchronously with an actionable message, not a cryptic 401/403 on first call.
- [ ] `[v1]` **Redact the `key` query parameter** from every log line (via the injected
      `Logger`), thrown error message, and stack trace — the single most important
      security control here, since Pixabay offers no header alternative.
- [ ] `[v1]` Protect the publish path: npm account 2FA + a scoped least-privilege
      automation token (or OIDC trusted publishing).
- [ ] `[v1]` Least-privilege GitHub Actions permissions (top-level `contents: read`,
      elevated only in the specific release job).
- [ ] `[v1]` Dependency license-compliance check in CI (permissive-license allowlist).
- [ ] `[v1]` SSRF guard on any URL taken from an API response, if a future feature ever adds
      a server-side follow-up fetch (none planned for v1).

## 3. Reliability & robustness

- [ ] `[v1]` Error mapping: Pixabay 400/403/429/5xx → the typed `PixabayApiError`/
      `PixabayRateLimitError` hierarchy (`src/errors.ts`), never a raw `fetch`/`zod` error.
- [ ] `[v1]` Retries & backoff for 429/5xx, honoring `X-RateLimit-Reset` — exactly one
      considered retry, never blind/looping.
- [ ] `[v1]` Network timeouts (`AbortSignal.timeout`, combined with a caller-supplied
      `AbortSignal` via `AbortSignal.any`).
- [ ] `[v1]` Rate-limit awareness surfaced to the consumer via the `onRateLimit` callback
      and logged at debug level.
- [ ] `[v1]` The 24h cache doubles as a reliability feature — a repeated query within the
      window returns instantly without touching the rate-limit budget.
- [ ] `[v1]` `PixabayClient` instances must not share mutable module-level state — multiple
      clients (e.g. different API keys) coexist safely in one process.

## 4. Testing & quality

- [ ] `[v1]` Unit tests with the Pixabay API mocked via dependency injection (fake
      `fetch`) — zero real API calls in CI.
- [ ] `[v1]` Unit tests for the cache layer: TTL expiry, key-stripping (never contains the
      raw API key), normalization (param order doesn't create duplicate entries).
- [ ] `[v1]` Type-checking, lint, and format checks in CI.
- [x] `[v1]` Coverage thresholds (v8, regression floor in `vitest.config.ts`). ✅ Kept at 70
      (not raised to "just below the real suite's 84-97%" as originally planned here) —
      the bare-minimal-tests convention from CLAUDE.md means the floor exists only to catch
      a module shipping with zero tests, not to track the suite's actual coverage.
- [x] `[v1]` One integration-style test exercising a full `images.search()` call against a
      fake-fetch fixture end-to-end. ✅ `test/integration.test.ts`, using Pixabay's own
      documented example response through the full public `PixabayClient` composition.
- [x] `[v1]` **Package-shape smoke test**: both `require()` and `import` resolve the built
      package correctly — the dual-format equivalent of the MCP server's stdout-purity test.
      ✅ `scripts/verify-package-shape.mjs`, wired into `npm run check:package` after the
      build (plain Node + `node:assert`, not vitest — it validates the real `dist/` output,
      not source run through vitest's own TS-transform pipeline).
- [ ] `[v1]` `publint` + `@arethetypeswrong/cli --pack . --profile node16` (confirmed at
      scaffold time — checks Node's own dual ESM/CJS resolution; `esm-only` doesn't apply
      to this package) in CI.
- [ ] `[v1]` Validate zod schemas against committed, sanitized **real captured** Pixabay
      response fixtures (images + videos) — port the sibling project's fixtures if their
      shape still matches current docs, re-verify against a live response if/when a key is
      available.
- [ ] `[v1]` CI test matrix: Node 22/24 × Linux/macOS/Windows (+ `.nvmrc`).

## 5. CI/CD & release automation

- [ ] `[v1]` `ci.yml`: a `quality` job (typecheck, lint, format:check, `audit:prod`,
      `test:coverage`, `license:check`), a `package` job (build + `publint` +
      `attw --pack . --profile node16` + a require/import smoke script +
      `npm pack --dry-run` confirming the tarball ships only `dist/` + README + LICENSE),
      and a `test` job matrix (Node 22/24 × ubuntu/macos/windows).
- [ ] `[v1]` `release.yml`: `changesets/action`, `HUSKY=0` in CI, `id-token: write` for
      provenance, `NPM_TOKEN` repo secret, least-privilege `permissions:` per job.
- [ ] `[v1]` `secret-scan.yml`: gitleaks over full history on every push/PR.
- [ ] `[v1]` Automated releases (Changesets): version + changelog + npm publish.
- [ ] `[v1]` Conventional commits via commitlint on `commit-msg`.
- [ ] `[v1]` npm publish provenance.

## 6. Developer & contributor experience

- [ ] `[v1]` README: quick start (`npm install` + a 5-line example), full method reference,
      link to the TypeDoc API reference, ESM + CJS usage snippets.
- [ ] `[v1]` CONTRIBUTING.md (mirror the sibling project's structure: dev setup, scripts
      table, project conventions, commit/branch rules, versioning policy — no MCP
      Inspector section needed here).
- [ ] `[v1]` CODE_OF_CONDUCT.md (Contributor Covenant, same as sibling).
- [ ] `[v1]` Issue/PR templates.
- [ ] `[v1]` LICENSE confirmed permissive (MIT).
- [ ] `[v1]` SECURITY.md (vulnerability reporting).
- [ ] `[v1]` Badges: npm version, build status, license, TypeDoc link.
- [ ] `[v1]` Semantic versioning commitment + deprecation policy (CONTRIBUTING.md).
- [ ] `[v1]` Explicit no-telemetry / privacy statement ("collects nothing, only contacts
      pixabay.com when you call a method").
- [ ] `[v1]` README troubleshooting + FAQ section.
- [ ] `[v1]` **TypeDoc API reference** — generated from source doc comments; decide at
      scaffold time whether it's a committed static site, a CI artifact, or published to
      GitHub Pages (flagging: GitHub Pages needs a one-time repo settings change on the
      user's side, same category as branch-protection setup below).

## 7. API surface / DX of the SDK

- [ ] `[v1]` `PixabayClient` with `.images`/`.videos` resources, each exposing `search()`
      and `get({ id })` — confirmed against current docs that `id` is a filter on the same
      search endpoint for both images and videos, not a separate route.
- [ ] `[v1]` Consistent, well-documented method signatures — TSDoc comments on every public
      method/type feed directly into the TypeDoc reference.
- [ ] `[v1]` `search()` returns Pixabay's real envelope + hit array untrimmed (no
      summary/detail split — see CLAUDE.md's "Public API surface" for the rationale).
- [ ] `[v1]` `get({ id })` unwraps the single hit; zero hits throws `PixabayNotFoundError`.
- [ ] `[v1]` Pagination passthrough (`page`/`per_page`, clamped `3`–`200` per Pixabay's
      documented bounds via zod).
- [ ] `[v1]` Clamp/normalize params to Pixabay's documented bounds; zod enums for
      `image_type`/`video_type`/`orientation`/`category`/`order`/`colors`; URL-encode `q`.
- [ ] `[v1]` Cancellation: every `search`/`get` accepts `{ signal?: AbortSignal }`.
- [ ] `[v1]` `onRateLimit` callback hook in `PixabayClientOptions` (see CLAUDE.md — the one
      piece of "observability surface" shipped in v1, deliberately not an OTel peer-dep).

## 8. Distribution & runtime

- [ ] `[v1]` Dual ESM+CJS build via tsup; no shebang, no `bin` field.
- [ ] `[v1]` `package.json` `exports` map: `types` / `import` / `require` all point at real
      built files (`dist/index.d.ts`, `dist/index.js`, `dist/index.cjs`); `main`/`module`/
      `types` fields set consistently for pre-`exports`-aware tooling.
- [ ] `[v1]` `files` field ships only `dist/` (+ npm's automatic README/LICENSE inclusion);
      confirm via `npm pack --dry-run`.
- [ ] `[v1]` Cross-platform (macOS/Linux/Windows); `.gitattributes` forcing LF.
- [ ] `[v1]` Pre-publish package validation in CI: `publint` + `@arethetypeswrong/cli`
      (dual-package profile) + `npm pack --dry-run` + the require/import smoke test.
- [ ] `[v1]` Declare `engines.node` (`>=22`) + `.nvmrc`.
- [ ] `[v1]` Populate `package.json` discoverability metadata (keywords: pixabay,
      pixabay-api, sdk, images, videos, stock-media, stock-photos, typescript…).
- [ ] `[v1]` `sideEffects: false` verified true — no import-time side effects anywhere in
      `src/`.
- [ ] `[v1]` npm name: `@hanoak/pixabay-sdk`.

## 9. Observability (lightweight, by design)

- [ ] `[v1]` Pluggable `Logger` interface + `createNoopLogger()` default +
      `createConsoleLogger()` opt-in convenience.
- [ ] `[v1]` `onRateLimit` callback (see §7) — the only other observability surface in v1.
- [ ] `[post-v1]` Broader hook surface (`onRequest`/`onRetry`/etc.) or an OTel integration —
      deferred until a concrete consumer need appears; see CLAUDE.md's rationale for keeping
      the dependency footprint at zero beyond zod.

## 10. Docs & maintenance

- [ ] `[v1]` CHANGELOG (Changesets-managed) — no hand-written intro paragraph.
- [ ] `[v1]` Compatibility matrix (Node versions, ESM/CJS support) in the README.
- [ ] `[v1]` Deprecation policy for future breaking changes (CONTRIBUTING.md).
- [ ] `[v1]` TypeDoc reference kept in sync via a CI check (fails if doc comments are
      missing on exported symbols, or generation errors) — decide the exact enforcement
      mechanism during scaffolding.

## 11. Library correctness (replaces "MCP protocol correctness")

- [ ] `[v1]` Recoverable failures become typed thrown `Error`s (the `PixabayError`
      hierarchy), never left as raw `fetch`/`zod` errors.
- [ ] `[v1]` Every public method's input is validated via zod **before** a network call is
      made; validation failures throw `PixabayValidationError` synchronously relative to
      the call (i.e. before `fetch` is invoked, though the method itself is still async).
- [ ] `[v1]` No global/module-level mutable state — multiple `PixabayClient` instances
      coexist without interfering.
- [ ] `[v1]` `sideEffects: false` holds — nothing runs at import time beyond declarations.
- [ ] `[v1]` Cancellation via consumer-supplied `AbortSignal`, combined with the internal
      timeout via `AbortSignal.any`.
- [ ] `[v1]` Public API surface is intentionally small and resource-namespaced; internals
      (`lib/*`, `schemas/*`) are not exported from `index.ts`.

## 12. Content safety & responsible use

- [ ] `[v1]` Default `safesearch=true` on search methods (overridable).
- [ ] `[v1]` Document that Pixabay text fields (tags, contributor names) are untrusted
      third-party data — relevant guidance for any consumer piping results into an LLM
      prompt themselves (this SDK has no prompt surface of its own, unlike the MCP server,
      but the README should say so for consumers who might build one on top).

## 13. Discovery & ecosystem

- [ ] `[v1]` npm listing with good `keywords`/`description` for search discoverability.
- [ ] `[v1]` README badges linking npm, CI, license, TypeDoc.
- [ ] `[post-v1]` Community catalogs / "awesome-typescript-sdks"-style listings, if any
      turn out to be relevant (no MCP-registry equivalent applies here).

## 14. Governance

- [ ] `[v1]` Add CODEOWNERS.
- [ ] `[post-v1]` `FUNDING.yml` — only if the project actually seeks sponsorship.

---

### ⚠️ Top gotchas (carried over + new)

1. Pixabay's API key has **no header option** — it's a `key` query parameter or nothing.
   Treat every URL as radioactive until the redactor has touched it.
2. The 24-hour cache is a **compliance requirement from Pixabay's own terms**, not a
   performance feature to defer post-v1.
3. **This SDK's default `Logger` is silent, not stderr.** Unlike the MCP server (where
   stderr is the _only_ legitimate output channel), a library that prints unprompted is a
   bug report waiting to happen. Don't reflexively port the sibling's "log everything to
   stderr by default" instinct here.
4. **The cache interface is async** (`Promise`-returning `get`/`set`), unlike the sibling's
   synchronous in-memory `Map`-backed one — this is deliberate, to allow a Redis/etc-backed
   implementation without a later breaking change. Don't "simplify" it back to sync.
