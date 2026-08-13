# Security Policy

## Supported versions

The latest released version on npm receives security fixes. Only the most recent major
version is supported — there are no parallel maintenance branches for older majors.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's
[**"Report a vulnerability"**](https://github.com/hanoak/pixabay-sdk/security/advisories/new)
(Security → Advisories → Report a vulnerability). Include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version(s).

We aim to acknowledge reports within a few days, and to release a fix (and a coordinated
advisory) as quickly as is practical.

## Handling your Pixabay API key

This SDK accepts your key only via the `apiKey` constructor option or the
`PIXABAY_API_KEY` environment variable, and:

- sends it only to `pixabay.com`, as the `key` query parameter — Pixabay's API has no header
  alternative, so this is the one place a request necessarily carries it;
- redacts it from every log line (via the pluggable `Logger`), thrown error message, and
  stack trace — the default logger is silent, but the redaction happens regardless of which
  logger you configure;
- never persists it anywhere; the default in-memory cache stores only response bodies, never
  the key itself.

If you believe your key was exposed, regenerate it from your
[Pixabay account](https://pixabay.com/api/docs/).
