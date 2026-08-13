export interface Logger {
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

const NOOP_LOGGER: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

// Default: silent. Unlike a process-owning stdio server (where stderr is the
// only legitimate output channel), this SDK gets embedded in a host app that
// hasn't asked for it to print anything — an unprompted console line from a
// dependency is a surprise, not a feature.
export function createNoopLogger(): Logger {
  return NOOP_LOGGER
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

// Opt-in convenience for local scripts/debugging — the only place console.*
// is used in this codebase (see eslint.config.js's unqualified `no-console`).
export function createConsoleLogger(level: LogLevel = 'info'): Logger {
  const threshold = LEVEL_WEIGHT[level]
  const enabled = (messageLevel: LogLevel): boolean => LEVEL_WEIGHT[messageLevel] >= threshold

  return {
    debug: (message) => {
      if (!enabled('debug')) return
      // eslint-disable-next-line no-console -- opt-in convenience logger; see file comment above
      console.debug(`[pixabay-sdk] [debug] ${message}`)
    },
    info: (message) => {
      if (!enabled('info')) return
      // eslint-disable-next-line no-console -- opt-in convenience logger; see file comment above
      console.info(`[pixabay-sdk] [info] ${message}`)
    },
    warn: (message) => {
      if (!enabled('warn')) return
      // eslint-disable-next-line no-console -- opt-in convenience logger; see file comment above
      console.warn(`[pixabay-sdk] [warn] ${message}`)
    },
    // `error` is the highest severity in LogLevel, so it's never suppressible
    // by any configured level — no `enabled('error')` guard needed.
    error: (message) => {
      // eslint-disable-next-line no-console -- opt-in convenience logger; see file comment above
      console.error(`[pixabay-sdk] [error] ${message}`)
    },
  }
}
