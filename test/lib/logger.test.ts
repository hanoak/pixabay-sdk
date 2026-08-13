import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsoleLogger, createNoopLogger } from '../../src/lib/logger.js'

describe('createNoopLogger', () => {
  it('never prints anything, at any level', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const logger = createNoopLogger()
    logger.debug('a')
    logger.error('b')

    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('createConsoleLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints every level, prefixed with [pixabay-sdk], when the threshold allows it', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const logger = createConsoleLogger('debug')
    logger.debug('a')
    logger.info('b')
    logger.warn('c')
    logger.error('d')

    expect(debugSpy).toHaveBeenCalledWith('[pixabay-sdk] [debug] a')
    expect(infoSpy).toHaveBeenCalledWith('[pixabay-sdk] [info] b')
    expect(warnSpy).toHaveBeenCalledWith('[pixabay-sdk] [warn] c')
    expect(errorSpy).toHaveBeenCalledWith('[pixabay-sdk] [error] d')
  })

  it('suppresses levels below the configured threshold', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const logger = createConsoleLogger('warn')
    logger.debug('ignored')
    logger.warn('careful')

    expect(debugSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[pixabay-sdk] [warn] careful')
  })

  it('defaults to the "info" level', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const logger = createConsoleLogger()
    logger.debug('ignored')
    logger.info('shown')

    expect(debugSpy).not.toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalledWith('[pixabay-sdk] [info] shown')
  })
})
