# @hanoak/pixabay-sdk

[![CI](https://github.com/hanoak/pixabay-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/hanoak/pixabay-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)

Unofficial TypeScript SDK for the [Pixabay API](https://pixabay.com/api/docs/) — search and
fetch royalty-free images and videos. Not affiliated with or endorsed by Pixabay.

> **Status:** feature-complete for v1, not yet published to npm — see
> [docs/ROADMAP.md](docs/ROADMAP.md) for what's left before the first release. Until then,
> use it from source (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Install

```bash
npm install @hanoak/pixabay-sdk
```

Requires Node.js `>=22`. Ships as dual ESM + CJS with bundled types — `import` and
`require()` both work.

## Quickstart

```ts
import { PixabayClient } from '@hanoak/pixabay-sdk'

const pixabay = new PixabayClient({ apiKey: process.env.PIXABAY_API_KEY })

const { hits, totalHits } = await pixabay.images.search({ q: 'cats' })
const image = await pixabay.images.get({ id: hits[0].id })

const { hits: videoHits } = await pixabay.videos.search({ q: 'ocean', video_type: 'film' })
```

`apiKey` can also come from the `PIXABAY_API_KEY` environment variable instead of the
constructor option:

```ts
const pixabay = new PixabayClient() // reads process.env.PIXABAY_API_KEY
```

A missing key throws `PixabayConfigError` synchronously, not a cryptic 401 on first call.

## API reference

This README covers the essentials; the full generated reference (every method, type, and
error class) is built from source doc comments via [TypeDoc](https://typedoc.org):

```bash
npm run docs:api   # generates docs/api/ locally
```

### `PixabayClient`

```ts
new PixabayClient(options?: PixabayClientOptions)
```

| Option        | Type                            | Default                       | Notes                                                                         |
| ------------- | ------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `apiKey`      | `string`                        | `process.env.PIXABAY_API_KEY` | Throws `PixabayConfigError` if neither is set.                                |
| `cache`       | `Cache`                         | in-memory                     | Backs the mandatory 24h response cache. See [Caching](#caching--rate-limits). |
| `logger`      | `Logger`                        | silent no-op                  | See [Logging](#logging).                                                      |
| `fetch`       | `typeof fetch`                  | global `fetch`                | Override for testing or a custom transport.                                   |
| `timeoutMs`   | `number`                        | `10000`                       | Per-request timeout.                                                          |
| `safesearch`  | `boolean`                       | `true`                        | Applied when a call omits its own `safesearch`.                               |
| `onRateLimit` | `(info: RateLimitInfo) => void` | —                             | Called after every response with Pixabay's `X-RateLimit-*` headers.           |

### `pixabay.images` / `pixabay.videos`

Both expose the same two methods:

```ts
search(params?, options?): Promise<{ total, totalHits, hits: Image[] | Video[] }>
get(params: { id: number, safesearch?: boolean }, options?): Promise<Image | Video>
```

- `search()` returns Pixabay's response envelope and hit array **untrimmed** — you get the
  real object back, not a token-trimmed summary, so you decide what to use.
- `get({ id })` calls the same underlying search-with-`id` request (`id` is a filter on the
  search endpoint, not a separate route) and unwraps the single hit. Throws
  `PixabayNotFoundError` if Pixabay has no result for that id — including if your own
  `safesearch` setting filtered it out.
- Search params mirror Pixabay's documented parameters (`q`, `lang`, `category`,
  `min_width`/`min_height`, `order`, `page`/`per_page` clamped 3–200, plus `image_type`/
  `orientation`/`colors` for images or `video_type` for videos — videos don't support
  `orientation`/`colors`, confirmed directly against the docs). Invalid params throw
  `PixabayValidationError` before any request is made.
- `options?: { signal?: AbortSignal }` cancels the request.

## Error handling

Every failure is a typed `Error` subclass — never a raw `fetch` or zod error:

```text
PixabayError                 base class
├─ PixabayConfigError        bad/missing constructor config
├─ PixabayValidationError    bad input, caught before a request was made
├─ PixabayApiError           4xx/5xx from Pixabay (status, pixabayMessage)
│  ├─ PixabayRateLimitError  429 (retryAfter, limit, remaining)
│  └─ PixabayNotFoundError   get() found zero hits for the id
├─ PixabayNetworkError       timeout / transport failure
└─ PixabayResponseError      200 OK but the body didn't match Pixabay's own schema
```

```ts
import { PixabayApiError, PixabayNotFoundError } from '@hanoak/pixabay-sdk'

try {
  await pixabay.images.get({ id: 999999999 }) // an id Pixabay doesn't have
} catch (error) {
  if (error instanceof PixabayNotFoundError) {
    // no image with that id
  } else if (error instanceof PixabayApiError) {
    console.error(error.status, error.pixabayMessage)
  } else {
    throw error
  }
}
```

## Caching & rate limits

Pixabay's terms require every response to be cached for 24 hours — this SDK does that for
you, unconditionally, on every request. The default cache is an in-memory `Map`; if you're
running this SDK across short-lived invocations (serverless, edge functions) where an
in-memory cache never persists between calls, implement the small `Cache` interface against
Redis or similar and pass it as `cache`:

```ts
interface Cache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttlMs: number): Promise<void>
}
```

On a `429`, the client backs off once using Pixabay's own `X-RateLimit-Reset` header, then
throws `PixabayRateLimitError` if it's still rate-limited — never a blind retry loop. Pass
`onRateLimit` to observe `limit`/`remaining`/`reset` on every response, successful or not.

This SDK never auto-paginates an entire result set for you — `page`/`per_page` stay under
your control, per Pixabay's own "no systematic mass downloads" terms.

## Logging

Silent by default — a dependency printing to your console unprompted is a surprise, not a
feature. Pass your own `Logger` (four methods: `debug`/`info`/`warn`/`error`, each
`(message: string) => void`) to route this SDK's log lines through your existing logging
stack, or use the built-in console logger for local scripts:

```ts
import { PixabayClient, createConsoleLogger } from '@hanoak/pixabay-sdk'

const pixabay = new PixabayClient({ apiKey, logger: createConsoleLogger('debug') })
```

## Image & video URLs

Every URL this SDK returns is a direct pass-through of whatever Pixabay's API responded
with. This SDK makes no decision about how long you display or cache an image — that's a
decision for your application, not this HTTP client. Pixabay's terms discourage using their
CDN URLs as a **permanent** hotlink in an app (images meant for persistent display should be
downloaded to your own storage); this SDK simply hands you the URLs Pixabay gave you and
leaves that call to you.

## Attribution

Not legally required — all Pixabay-hosted content is usable under the Pixabay License
without attribution — but `formatAttribution()` is there as a courtesy if you want to credit
contributors anyway:

```ts
import { formatAttribution } from '@hanoak/pixabay-sdk'

formatAttribution(image) // "by Josch13 via Pixabay"
```

## Getting a Pixabay API key

Sign up for a free Pixabay account, then log in to [the API docs page](https://pixabay.com/api/docs/)
to see your key. The default tier is enough for everything this SDK does except three image
fields (`fullHDURL`, `imageURL`, `vectorURL`), which require Pixabay's separate "full API
access" approval — the SDK degrades gracefully without it (those fields are simply absent).
Each consumer of this SDK operates under their own
[Pixabay API Terms](https://pixabay.com/service/terms/api/) — this SDK doesn't change that.

## Privacy

This SDK contacts only `pixabay.com` (and only when you call a method) and collects nothing
of its own — no telemetry, no analytics, no calls to any endpoint other than Pixabay's.

## A note on untrusted data

`tags`, `user`, and every other text field on an `Image`/`Video` are third-party data
supplied by Pixabay contributors, not this SDK. If you're piping search results into an LLM
prompt (this SDK has no prompt surface of its own), treat those fields as untrusted input —
never interpolate them into a system or privileged prompt unescaped.

## Compatibility

|                | Supported                                                  |
| -------------- | ---------------------------------------------------------- |
| Node.js        | `>=22`                                                     |
| Module formats | ESM (`import`) and CommonJS (`require`)                    |
| TypeScript     | Ships its own `.d.ts`/`.d.cts`; no `@types` package needed |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, scripts, and conventions.

## License

MIT — see [LICENSE](LICENSE).
