export interface OllamaHarnessConfig {
  baseUrl: string
  model: 'gemma4:12b'
  timeoutMs: number
  seed: number
  temperature: number
  numCtx: number
  numPredict: number
  keepAlive: string
  think: boolean
}

export type HarnessConfig =
  | { mode: 'deterministic' }
  | { mode: 'provisional'; ollama: OllamaHarnessConfig }

export class HarnessConfigError extends Error {
  constructor(public readonly code: string) {
    super(`Evaluation configuration error [${code}]`)
    this.name = 'HarnessConfigError'
  }
}

export function parseHarnessConfig(
  argv: string[],
  environment: Record<string, string | undefined>,
): HarnessConfig {
  const cliMode = readModeFlag(argv)
  const mode = cliMode ?? environment.EVAL_MODE ?? 'deterministic'
  if (mode !== 'deterministic' && mode !== 'provisional') {
    throw new HarnessConfigError('invalid_mode')
  }
  if (mode === 'deterministic') return { mode }

  const baseUrl = requireValue(environment, 'EVAL_OLLAMA_URL')
  validateLoopbackUrl(baseUrl)
  const model = requireValue(environment, 'EVAL_OLLAMA_MODEL')
  if (model !== 'gemma4:12b') {
    throw new HarnessConfigError('invalid_ollama_model')
  }

  return {
    mode,
    ollama: {
      baseUrl,
      model,
      timeoutMs: positiveInteger(environment, 'EVAL_TIMEOUT_MS'),
      seed: integer(environment, 'EVAL_SEED'),
      temperature: finiteNumber(environment, 'EVAL_TEMPERATURE'),
      numCtx: positiveInteger(environment, 'EVAL_NUM_CTX'),
      numPredict: positiveInteger(environment, 'EVAL_NUM_PREDICT'),
      keepAlive: requireValue(environment, 'EVAL_KEEP_ALIVE'),
      think: strictBoolean(environment, 'EVAL_THINK'),
    },
  }
}

export function validateLoopbackUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new HarnessConfigError('invalid_ollama_url')
  }
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  if (
    url.protocol !== 'http:'
    || !allowedHosts.has(url.hostname.toLocaleLowerCase('en-US'))
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
    || !['/', '/api', '/api/'].includes(url.pathname)
  ) {
    throw new HarnessConfigError('invalid_ollama_url')
  }
  return url
}

function readModeFlag(argv: string[]): string | undefined {
  const index = argv.indexOf('--mode')
  if (index === -1) return undefined
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new HarnessConfigError('missing_mode_value')
  }
  return value
}

function requireValue(
  environment: Record<string, string | undefined>,
  key: string,
): string {
  const value = environment[key]
  if (!value) throw new HarnessConfigError(`missing_${key.toLocaleLowerCase('en-US')}`)
  return value
}

function positiveInteger(environment: Record<string, string | undefined>, key: string): number {
  const value = integer(environment, key)
  if (value <= 0) throw new HarnessConfigError(`invalid_${key.toLocaleLowerCase('en-US')}`)
  return value
}

function integer(environment: Record<string, string | undefined>, key: string): number {
  const raw = requireValue(environment, key)
  if (!/^-?\d+$/u.test(raw)) throw new HarnessConfigError(`invalid_${key.toLocaleLowerCase('en-US')}`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) throw new HarnessConfigError(`invalid_${key.toLocaleLowerCase('en-US')}`)
  return value
}

function finiteNumber(environment: Record<string, string | undefined>, key: string): number {
  const raw = requireValue(environment, key)
  if (!/^-?(?:\d+|\d*\.\d+)$/u.test(raw)) {
    throw new HarnessConfigError(`invalid_${key.toLocaleLowerCase('en-US')}`)
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new HarnessConfigError(`invalid_${key.toLocaleLowerCase('en-US')}`)
  return value
}

function strictBoolean(environment: Record<string, string | undefined>, key: string): boolean {
  const raw = requireValue(environment, key)
  if (raw !== 'true' && raw !== 'false') {
    throw new HarnessConfigError(`invalid_${key.toLocaleLowerCase('en-US')}`)
  }
  return raw === 'true'
}
