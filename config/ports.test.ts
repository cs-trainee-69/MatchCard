import { describe, expect, it } from 'vitest'
import { resolvePort } from './ports.mjs'

describe('server port configuration', () => {
  it('uses the process value before the .env value', () => {
    expect(resolvePort('8080', '9090', 'PORT', 5173)).toBe(8080)
  })

  it('uses the .env value and defaults empty values', () => {
    expect(resolvePort(undefined, '9090', 'PORT', 5173)).toBe(9090)
    expect(resolvePort(undefined, '', 'PORT', 5173)).toBe(5173)
    expect(resolvePort('', '9090', 'PORT', 5173)).toBe(5173)
  })

  it.each(['0', '65536', '12.5', '-1', 'abc'])('rejects invalid port %s', (value) => {
    expect(() => resolvePort(value, undefined, 'PORT', 5173)).toThrow(
      'PORT must be a whole number between 1 and 65535',
    )
  })
})
