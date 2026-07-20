export interface DatabaseTarget {
  host: string
  port: string
  database: string
}

export function parseDatabaseTarget(rawUrl: string): DatabaseTarget {
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid database URL')
  }

  let database: string
  try {
    database = decodeURIComponent(url.pathname.slice(1))
  } catch {
    throw new Error('Invalid database URL')
  }

  if (!url.hostname || !database) {
    throw new Error('Invalid database URL')
  }

  return {
    host: url.hostname.toLowerCase(),
    port: url.port || '5432',
    database,
  }
}

function targetKey(target: DatabaseTarget): string {
  return `${target.host}:${target.port}/${target.database}`
}

export function validateSchemaTestTarget(
  testUrl: string,
  developmentUrl: string | undefined
): DatabaseTarget {
  const testTarget = parseDatabaseTarget(testUrl)

  if (
    !testTarget.database.endsWith('_test') &&
    !testTarget.database.endsWith('_disposable')
  ) {
    throw new Error(
      `Test database name '${testTarget.database}' must end with '_test' or '_disposable'`
    )
  }

  if (
    developmentUrl &&
    targetKey(testTarget) === targetKey(parseDatabaseTarget(developmentUrl))
  ) {
    throw new Error('TEST_DATABASE_URL cannot target the same database as DATABASE_URL')
  }

  return testTarget
}

export function formatDatabaseTarget(target: DatabaseTarget): string {
  return targetKey(target)
}
