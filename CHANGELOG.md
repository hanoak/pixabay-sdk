# Changelog

## 1.0.2

### Patch Changes

- a1c0fd6: Fixed the published README still saying "not yet published to npm" and added the npm version badge, now that the package is live on the registry. No code changes — this release exists only to get the corrected README onto the npm package page, since npm freezes a package's displayed README to whatever was in the tarball at publish time.

## 1.0.1

### Patch Changes

- 71f3e71: Fixed a handful of `HttpClient` bugs found during a post-release code review:

  - A malformed/truncated response body no longer leaks a raw `SyntaxError` — it's now mapped to `PixabayResponseError`.
  - A response that fails schema validation is no longer cached for 24h before that validation runs, so a transient bad payload can't replay for a day after Pixabay recovers.
  - Clarified that `timeoutMs` bounds a single HTTP attempt, not the overall `search()`/`get()` call (which may also include a rate-limit backoff wait before its one retry).

## 1.0.0

### Major Changes

- Initial public release. A TypeScript SDK for the Pixabay API — search and fetch
  royalty-free images and videos:

  - `PixabayClient` with `.images`/`.videos` resources, each exposing `search()` and `get()`
  - Dual ESM + CJS build with bundled types — `import` and `require()` both work
  - A mandatory 24-hour response cache (required by Pixabay's terms) behind a pluggable,
    async `Cache` interface
  - A typed `PixabayError` hierarchy (`PixabayConfigError`, `PixabayValidationError`,
    `PixabayApiError`, `PixabayRateLimitError`, `PixabayNotFoundError`, `PixabayNetworkError`,
    `PixabayResponseError`) — never a raw `fetch`/zod error
  - Retry/backoff on 429/5xx honoring Pixabay's rate-limit headers, timeout/cancellation via
    `AbortSignal`, and an `onRateLimit` callback
  - A pluggable `Logger` (silent by default) and a `formatAttribution()` courtesy helper
  - `safesearch` defaults to `true` on every search/get call, overridable per call
  - A generated TypeDoc API reference (`npm run docs:api`)
