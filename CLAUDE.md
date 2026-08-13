# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repository.

## Project overview

`@hanoak/pixabay-sdk` is a **production-grade TypeScript SDK** for the
[Pixabay API](https://pixabay.com/api/docs/) — search and fetch royalty-free images and
videos. It is an importable library (`npm install @hanoak/pixabay-sdk`), **not** an MCP
server or CLI tool. Unofficial; not affiliated with or endorsed by Pixabay.

Quality bar: production-ready, legal/safe, community-maintained open-source npm package —
not a prototype. Every decision should be defensible to a stranger reading the repo cold.
"Standard" and "enterprise-grade" are qualities the **one** package has simultaneously — a
five-minute happy-path integration _and_ production hardening on by default (retries,
rate-limit awareness, structured errors, cancellation) — never a paywall or feature flag.
Pixabay has no tiering to hang an "enterprise edition" off of: one flat API key, no OAuth,
no orgs.

This project's sibling, `pixabay-mcp-server`
(`/Users/hanoak.suchethan/Desktop/personal-github/pixabay-mcp-server` on this machine —
same author, same Pixabay API, already published to npm with provenance and listed on the
MCP registry), is the **canonical pattern source** for tone, rigor, and process. Conventions below are ported from it
directly; deviations exist only where "importable library" genuinely differs from "stdio
MCP server" — every such deviation is called out explicitly in
["Where this differs from pixabay-mcp-server"](#where-this-differs-from-pixabay-mcp-server)
below, never silently.

## Tech stack (decided — do not relitigate without discussion)

- **Language/runtime**: TypeScript, Node.js `>=22`. (Deliberately higher than the sibling
  MCP server's `>=20` — decided at scaffold time; see the dev-tooling note below for why.)
- **Module format**: dual **ESM + CJS** (`tsup` `format: ['esm', 'cjs']`) — a library gets
  `require()`'d by consumers a bin never has to support. No shebang, no `bin` field.
- **Validation**: `zod` for both public-method input validation and lenient Pixabay
  wire-schema validation. Confirm the current major version at scaffold time (the sibling
  project pins `^4.4.3`; verify, don't assume).
- **Runtime deps**: `zod` only, plus Node's own global `fetch` — no axios/node-fetch/undici.
- **Build**: `tsup` → `dist/`, dual ESM+CJS, `.d.ts` output, sourcemaps, `clean: true`,
  target `node22`.
- **Test runner**: `vitest` (+ `@vitest/coverage-v8`). Dependency injection over network
  mocking — the client takes a `fetch` override in its constructor; zero real network calls
  in CI, no `msw`/`nock`.
- **Lint/format**: ESLint flat config (`typescript-eslint` + `eslint-config-prettier`);
  Prettier (`semi: false`, `singleQuote: true`, `printWidth: 100`, `trailingComma: 'all'`).
- **Docs**: TypeDoc-generated API reference — a standard SDK expectation the MCP server
  didn't need (its "API" is a self-documenting MCP tool schema).
- **Release**: Changesets → GitHub Actions → `npm publish --provenance` with a scoped
  least-privilege token + npm 2FA.
- **Commits**: Conventional Commits, enforced by commitlint on a `commit-msg` hook.
- **npm package**: `@hanoak/pixabay-sdk`, MIT license, public npm access. First release is
  `1.0.0`, not `0.1.0`.
- **Why `>=22`, not `>=20` like the sibling project**: at scaffold time, `@changesets/cli`'s
  newest major (`3.0.0`) requires Node `^22.11 || ^24 || >=26`, and `@commitlint/cli`/
  `config-conventional`'s newest major (`21.x`) requires Node `>=22.12.0` — both ahead of
  Node `20`. Rather than pin those two tools to an older major just to keep a `20` floor
  (the alternative considered and rejected), the floor moved to `22` so the SDK's published
  `engines.node`, the dev-tooling floor, and the CI matrix are all one number — no
  split between "what consumers need" and "what contributors need." `lint-staged` (`17.x`,
  needs `>=22.22.1`) and `@commitlint/*` are fine under a current `22.x` LTS patch
  (`22.23.2` at scaffold time). The one holdout: `license-checker-rseidelsohn`'s newest
  major (`5.x`) requires Node `>=24` — pinned to `^4.4.2` (Node `>=18`) instead, since `24`
  wasn't the floor decision made here. Revisit that pin if the floor ever moves to `24`.

## Pixabay API facts that drive design (verify against current docs before relying on exact numbers)

Same upstream API as `pixabay-mcp-server` — these facts bind **any** caller, so they carry
over unchanged regardless of packaging:

- **Auth**: a single API key passed as the `key` query parameter — Pixabay has **no header
  option**. Supplied by the _consumer_ via `new PixabayClient({ apiKey })`, with an optional
  fallback to `process.env.PIXABAY_API_KEY` as documented convenience sugar. Missing/empty
  key throws a `PixabayConfigError` synchronously at construction — fail fast, same spirit
  as the MCP server's startup check, different mechanism (there's no process to exit here).
- **No OAuth, no write endpoints.** Read-only search/lookup surface — no `auth/` module, no
  token store.
- **Two resource domains only**: images (`GET https://pixabay.com/api/`) and videos
  (`GET https://pixabay.com/api/videos/`). No users/collections/topics/stats endpoints.
- **Rate limit**: ~100 requests / 60 seconds per key, surfaced via `X-RateLimit-Limit` /
  `X-RateLimit-Remaining` / `X-RateLimit-Reset` response headers; exceeding it returns `429`.
- **Mandatory 24-hour response caching** — Pixabay's terms require it. Every outbound GET
  routes through a cache layer keyed on the normalized request (endpoint + sorted params,
  `key` stripped), never the raw querystring. This is a compliance requirement, not an
  optimization.
- **No permanent hotlinking** in an app displaying images persistently — Pixabay's terms say
  such images should be downloaded to your own server first (videos may be embedded
  directly). This SDK is a thin HTTP client: it returns Pixabay CDN URLs to the caller and
  makes no persistence decision itself. Document this pass-through clearly in the README so
  the _consuming app_ — not this SDK — owns that compliance decision, and reference the
  sibling project's more detailed reasoning on the ephemeral-vs-permanent distinction.
- **No systematic mass downloads.** Don't build a helper that auto-paginates an entire
  result set — `search()` exposes `page`/`per_page` passthrough; pagination control stays
  with the consumer.
- **Attribution is optional**, not required — surface a courtesy `formatAttribution(item)`
  helper (`"by {user} via Pixabay"` + `pageURL`); never gate functionality on it, never claim
  in docs it's legally mandatory (it isn't — Pixabay License content is usable without it).
- **Content safety**: default `safesearch: true` on search methods (overridable).

## Architecture & folder conventions

```text
src/
  index.ts          # public exports ONLY: PixabayClient, resource/param/result types,
                     # the PixabayError hierarchy, formatAttribution, Cache/Logger
                     # interfaces + default impls, version. Nothing internal leaks.
  client.ts          # PixabayClient composition root: constructor validation (fail-fast),
                      # wires http/cache/logger/redactor, exposes `.images` / `.videos`
  version.ts        # re-exports name/version from package.json
  errors.ts          # the PixabayError hierarchy (see "Error handling" below)
  attribution.ts     # formatAttribution(item) — the only "opinionated" formatting helper
  lib/
    http.ts           # buildUrl choke point + fetch wrapper, retry/backoff, rate-limit
                       # header parsing, timeout/AbortSignal handling
    cache.ts           # Cache interface (async, pluggable) + createInMemoryCache() default
    logger.ts           # Logger interface (pluggable) + createNoopLogger() default +
                         # createConsoleLogger() opt-in convenience
    redact.ts            # createRedactor(apiKey) — ported near-verbatim from the sibling
  schemas/
    envelope.ts          # shared search-response envelope (total/totalHits)
    image.ts             # Pixabay image response schema — lenient (only `id` required)
    video.ts             # Pixabay video response schema — lenient (only `id` required)
    parse.ts             # parseResponse() — safeParse + typed SchemaValidationError
  resources/
    images.ts            # ImagesResource: search(), get()
    videos.ts             # VideosResource: search(), get()
```

Rules:

- **One file per resource domain** under `src/resources/` (`images.ts`, `videos.ts`).
  Adding a method means editing its domain file.
- **`src/schemas/`** is for Pixabay response/wire schemas only, and is intentionally
  **lenient**: only `id` required, everything else optional/nullable, so an upstream field
  add/rename/reorder degrades gracefully instead of throwing.
- **Errors are typed thrown `Error` subclasses** (this is a library, not an MCP tool call) —
  never a raw `fetch`/`zod` error leaks to the consumer. See "Error handling" below.
- **Cache and logger are pluggable via constructor injection**, not fixed implementations.
  The cache is always used (mandatory per Pixabay's terms) but its _backend_ is swappable —
  a consumer running this SDK across short-lived serverless invocations needs something
  like Redis, where the MCP server's single long-lived process never did.
- **No secrets in logs or thrown errors.** The `key` query param is stripped by the
  redactor before a URL can reach a log line (via the injected `Logger`), a thrown error's
  message, or a stack trace.
- **No `console.*` anywhere in `src/`** except inside `lib/logger.ts`'s opt-in
  `createConsoleLogger()` — the _default_ logger is a no-op, because a dependency printing
  to a host app's console unprompted is a surprise, not a feature. (Contrast with the MCP
  server, which owns its whole process and can hardcode a stderr logger.)
- Dependency-inject `fetch`, `Cache`, and `Logger` into `createPixabayHttpClient(config)` /
  `PixabayClient`'s constructor — tests pass fakes for all three.

## Coding standards

- `tsconfig.json`: `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. Target `ES2022`,
  module `NodeNext`.
- **No `any`** (`@typescript-eslint/no-explicit-any: error`).
- **No `console.*`** (ESLint `no-console`, zero exceptions at the rule level — the one
  legitimate use in `createConsoleLogger()` gets a scoped `eslint-disable-next-line` with a
  comment explaining why).
- Prefer small, pure, dependency-injected functions over classes with hidden state, except
  where a class cleanly models a stateful client (`PixabayClient`, the resource classes).
- Comments explain **why**, not what.
- Don't add abstractions, config knobs, or error handling for scenarios that can't occur.

## Error handling

A small typed hierarchy — never raw `fetch`/`zod` errors leaking to the consumer:

```text
PixabayError                     (base; extends Error, sets this.name)
├─ PixabayConfigError            bad/missing constructor config — thrown synchronously
├─ PixabayValidationError        bad input caught by zod before a request is made
│                                 · issues: z.ZodIssue[]
├─ PixabayApiError               4xx/5xx from Pixabay
│  │                              · status: number
│  │                              · pixabayMessage?: string  (Pixabay's own body text)
│  ├─ PixabayRateLimitError      429 specifically
│  │                              · retryAfter?: number      (seconds, from X-RateLimit-Reset)
│  │                              · limit?: number · remaining?: number
│  └─ PixabayNotFoundError       get()-by-id resolved to zero hits (see below)
└─ PixabayNetworkError           timeout/abort/transport failure
                                  · cause?: unknown           (the original fetch error)
```

Never swallow; never log-and-continue silently. Every constructor sets
`this.name = <ClassName>` explicitly (not `new.target.name`) so `instanceof` and `.name`
both survive bundling/minification, matching the sibling project's `PixabayApiError`
pattern.

## Public API surface

```ts
const pixabay = new PixabayClient({ apiKey: '...' }) // or PIXABAY_API_KEY env fallback
await pixabay.images.search({ q: 'cats' }) // -> { total, totalHits, hits: Image[] }
await pixabay.images.get({ id: 123 }) // -> Image, or throws PixabayNotFoundError
await pixabay.videos.search({ q: 'ocean' })
await pixabay.videos.get({ id: 456 })
formatAttribution(image) // -> "by {user} via Pixabay"
```

- Resource-namespaced (`images`, `videos`), mirroring the 4 operations already implemented
  and manually verified end-to-end in the sibling MCP server. Wire schemas port
  near-directly from `pixabay-mcp-server/src/schemas/*.ts`.
- `search()` returns Pixabay's real envelope + hit array untrimmed — unlike the MCP server's
  token-conscious summary/detail split, a TypeScript caller should get the actual object and
  decide what to use, not be forced to re-`get()` for a field that was trimmed away.
- `get({ id })` calls the same underlying search-with-`id` request Pixabay exposes (it is a
  filter on the search endpoint, not a distinct route — confirmed against the docs), then
  unwraps `hits[0]`. Zero hits throws `PixabayNotFoundError` rather than returning
  `undefined` — a `get`-by-id caller expects one object or an error, not an optional. This is
  the one convenience method the MCP server never had to design (an LLM tool can just say
  "no results" in prose); flagged as the least sibling-derived call in this document.
- Every `search`/`get` accepts an optional second `{ signal?: AbortSignal }` argument for
  caller-driven cancellation, combined internally with the request timeout via
  `AbortSignal.any`.

## Security & secrets

- No secrets hardcoded, logged, or committed. `.env.example` committed (for the local
  dev/test harness only), `.env` gitignored.
- **Fail-fast constructor validation** — a missing/empty `apiKey` throws
  `PixabayConfigError` synchronously with an actionable message.
- Single request-URL-building choke point (`lib/http.ts`); the redactor strips `key=`
  before it reaches any log line, thrown error, or stack trace.
- gitleaks on `pre-commit` (skip-if-absent + warn) and as a full-history CI job.
- Dependabot, `npm audit --omit=dev --audit-level=high` in CI, a license-compliance
  allowlist (fail on copyleft in a prod dependency), committed lockfile, every GitHub Action
  SHA-pinned (verify current SHAs at setup time — don't copy stale ones from the sibling
  project's workflow files).
- `npm publish --provenance`, scoped least-privilege token, npm 2FA on the publishing
  account.

## Testing standards

- **Keep tests bare-minimal — one case per meaningful behavior, not exhaustive edge/branch
  enumeration.** If closing a coverage gap means adding a test that doesn't correspond to a
  real behavior worth verifying (e.g. a boundary condition no caller can hit), prefer
  simplifying the source instead (see the `error`-level-is-never-suppressible dead branch
  removed from `lib/logger.ts` during scaffolding) or folding the missing case into an
  existing test's data rather than adding a new test. The coverage floor in
  `vitest.config.ts` is deliberately lower than the sibling project's for this reason — see
  that file's comment.
- **Dependency injection over network mocking** — a fake `fetch` injected into
  `PixabayClient`; zero real network calls in CI, no `msw`/`nock`.
- Unit tests per module: cache TTL/eviction/key-stripping, redactor, retry/backoff math,
  error mapping, each resource's input validation and response parsing.
- One integration-style test exercising a full `images.search()` call against a
  fake-fetch fixture end-to-end.
- A **package-shape smoke test** asserting both `require()` and `import` resolve the built
  package correctly — the dual-format equivalent of the sibling project's stdout-purity
  child-process test — plus `publint` and `attw --pack . --profile node16` (confirmed at
  scaffold time: `@arethetypeswrong/cli@0.18.5`'s valid `--profile` choices are `strict`,
  `node16`, `esm-only` — `node16` is the one that checks Node's own dual ESM/CJS resolution,
  which `esm-only` doesn't apply here) in CI.
- Coverage: v8 provider, a regression-floor threshold in `vitest.config.ts` (start wherever
  the real suite lands, then never lower it to turn a red build green).
- Validate the image/video wire schemas against real (sanitized) captured Pixabay response
  fixtures by hand before shipping (the sibling project's fixtures, sourced from Pixabay's
  own documented example responses, can likely be reused/ported directly).

## Git & commit conventions

- Single persistent working branch (e.g. `feature`) off `main`; a `pre-commit` hook refuses
  direct commits to `main`/`master`.
- Conventional Commits, enforced by commitlint on `commit-msg`.
- `pre-commit` hook: gitleaks scan + `lint-staged` (Prettier + ESLint on staged files).
- **Never auto-commit — always ask first.** Never add a `Co-Authored-By` trailer unless
  explicitly asked.
- Open PRs against `main`; CI must pass before merge.
- **Commit granularity**: one commit per reviewable logical unit (one module, one workflow
  file, one test-file family, one config-file group that's meaningless split apart) — not
  one giant "implement SDK" commit, and not one commit per line either.

## Release process

- Changesets manages `CHANGELOG.md` and version bumps.
- **`CHANGELOG.md` must contain nothing but `# Changelog` followed directly by `##` version
  entries** — no hand-written intro paragraph (Changesets always inserts the new version
  section immediately after the H1). Put format/versioning-policy notes in
  `CONTRIBUTING.md` instead.
- **Public contract** = every exported symbol from `index.ts`: class/method signatures,
  exported types, error class shapes and field names. An incompatible change to any of
  these ships only in a **major** release; deprecate ≥1 minor release before removal.
- **Every PR with a user-facing change needs a real `.changeset/*.md` file**, or the
  "Version Packages" PR step gets silently skipped and publishing happens without a
  CHANGELOG entry.
- CI installs with `HUSKY=0` on the release job (the bot's own commit would otherwise be
  rejected by the local commit-msg hook).

## Where this differs from pixabay-mcp-server

- **Module format**: dual ESM+CJS via tsup, not ESM-only. No shebang, no `bin` field —
  this isn't an executable. Validate the dual-package shape with `@arethetypeswrong/cli`
  using a dual-package profile, not `esm-only`.
- **Auth**: supplied by the consumer via constructor (`new PixabayClient({ apiKey })`), with
  an optional `PIXABAY_API_KEY` env fallback as convenience sugar — not the MCP server's own
  env-loading `config.ts`. Missing/empty key throws synchronously at construction; there's
  no MCP `isError` envelope to soften it into, so it's a real thrown error.
- **Error handling**: recoverable failures become typed thrown `Error`s (see hierarchy
  above), not `isError` tool results — this is a library, not an MCP tool call.
- **Logging & caching are pluggable, not fixed.** The MCP server owns its whole process and
  hardcodes a stderr logger + in-memory cache; this SDK gets embedded in arbitrary host apps
  (including short-lived serverless functions where in-memory caching alone is useless
  across invocations), so both are small injectable interfaces with a sane default,
  swappable by the consumer. The default logger is a silent no-op (not stderr) — a
  dependency printing unprompted is a surprise for a library, unlike a process-owning
  server where stderr is the _only_ legitimate output channel.
- **No "enterprise edition."** Pixabay's API has no tiering to hang one off of. "Standard"
  and "enterprise-grade" are qualities the one package has simultaneously, never two
  products or a paywalled flag.
- **TypeDoc API reference** — a standard SDK expectation the MCP server didn't need (its
  only "API" is its MCP tool schema, already self-documenting via the protocol).
- **No MCP-specific surface at all**: no tools/resources/prompts, no `isError` mapping, no
  `readOnlyHint`/`openWorldHint` annotations, no `instructions` field, no stdout-purity
  constraint (there is no stdout channel this library must protect — logging is fully owned
  by the pluggable `Logger`), no stdio transport concerns.
- **`get({ id })` unwraps to a single object and throws `PixabayNotFoundError` on zero
  hits** — a design choice the MCP server never had to make (see "Public API surface"
  above).
- **No telemetry/OTel integration in v1.** Kept out to preserve the zero-extra-dependency
  footprint (zod is the only prod dep). If wanted later, plain optional callback hooks
  (e.g. `onRateLimit`) are the planned shape, not an OpenTelemetry peer dependency — this
  keeps the SDK usable in any host app without forcing a specific observability stack. The
  `onRateLimit` callback already ships in v1 for this reason; a broader hook surface is
  `post-v1` and undecided.

## Do not

- Do not let a raw request URL (containing `key=`) reach a log line, thrown error message,
  or stack trace.
- Do not bypass the mandatory 24h cache layer "just for this one endpoint."
- Do not build a method that auto-paginates an entire result set in one call.
- Do not claim attribution is legally required in any docs text — it isn't.
- Do not lower the coverage floor to unblock a build.
- Do not hand-edit past `CHANGELOG.md` entries or re-add its intro paragraph.
- Do not add a `console.*` call anywhere outside `lib/logger.ts`'s opt-in console
  implementation.
- Do not commit or push without being explicitly asked.
- Do not add an OTel/telemetry peer dependency without discussion (see "Where this differs"
  above).
