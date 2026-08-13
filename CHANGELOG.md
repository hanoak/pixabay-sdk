# Changelog

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
