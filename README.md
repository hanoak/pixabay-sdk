# @hanoak/pixabay-sdk

Unofficial TypeScript SDK for the [Pixabay API](https://pixabay.com/api/docs/) — search and
fetch royalty-free images and videos. Not affiliated with or endorsed by Pixabay.

> **Status: under active development.** Nothing is published yet — see
> [docs/ROADMAP.md](docs/ROADMAP.md) for what's built and what's next.

## Planned usage

```ts
import { PixabayClient } from '@hanoak/pixabay-sdk'

const pixabay = new PixabayClient({ apiKey: process.env.PIXABAY_API_KEY })

const { hits } = await pixabay.images.search({ q: 'cats' })
const image = await pixabay.images.get({ id: hits[0].id })
```

A full quickstart, API reference, and CJS/ESM usage notes land here once the client ships
(see [docs/ROADMAP.md](docs/ROADMAP.md), Phase 9).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE). Each consumer of this SDK operates under their own
[Pixabay API Terms](https://pixabay.com/service/terms/api/).
