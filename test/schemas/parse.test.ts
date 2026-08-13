import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseResponse } from '../../src/schemas/parse.js'
import { PixabayResponseError } from '../../src/errors.js'
import { createNoopLogger } from '../../src/lib/logger.js'

const schema = z.object({ id: z.number() })

describe('parseResponse', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the parsed data on a schema match', () => {
    expect(parseResponse(schema, { id: 1 }, 'test', createNoopLogger())).toEqual({ id: 1 })
  })

  it('throws PixabayResponseError and logs a warning on a schema mismatch', () => {
    const logger = createNoopLogger()
    const warnSpy = vi.spyOn(logger, 'warn')

    expect(() => parseResponse(schema, { id: 'not a number' }, 'image search', logger)).toThrow(
      PixabayResponseError,
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('image search'))
  })
})
