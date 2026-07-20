import { describe, expect, it } from 'vitest'
import {
  parseDatabaseTarget,
  validateSchemaTestTarget,
} from './schema-test-guard.js'

describe('schema test database guard', () => {
  it('normalizes host, default port, and decoded database name', () => {
    expect(
      parseDatabaseTarget('postgresql://user:secret@LOCALHOST/mahalla%5Fovozi%5Ftest')
    ).toEqual({
      host: 'localhost',
      port: '5432',
      database: 'mahalla_ovozi_test',
    })
  })

  it('rejects malformed URLs without echoing credential-bearing input', () => {
    const malformed = 'postgresql://user:super-secret@%'

    expect(() => parseDatabaseTarget(malformed)).toThrow('Invalid database URL')
    expect(() => parseDatabaseTarget(malformed)).not.toThrow(/super-secret/)
  })

  it('rejects non-disposable database names', () => {
    expect(() =>
      validateSchemaTestTarget(
        'postgresql://user:secret@localhost/mahalla_ovozi',
        undefined
      )
    ).toThrow("must end with '_test' or '_disposable'")
  })

  it('rejects the same normalized development target', () => {
    expect(() =>
      validateSchemaTestTarget(
        'postgresql://test:secret@LOCALHOST/mahalla_ovozi_test',
        'postgresql://dev:different@localhost:5432/mahalla_ovozi_test'
      )
    ).toThrow('cannot target the same database')
  })
})
