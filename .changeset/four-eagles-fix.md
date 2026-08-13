---
'@hanoak/pixabay-sdk': patch
---

Fixed a handful of `HttpClient` bugs found during a post-release code review:

- A malformed/truncated response body no longer leaks a raw `SyntaxError` — it's now mapped to `PixabayResponseError`.
- A response that fails schema validation is no longer cached for 24h before that validation runs, so a transient bad payload can't replay for a day after Pixabay recovers.
- Clarified that `timeoutMs` bounds a single HTTP attempt, not the overall `search()`/`get()` call (which may also include a rate-limit backoff wait before its one retry).
