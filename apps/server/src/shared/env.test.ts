import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.js'

const baseEnv = {
  DATABASE_URL:            'postgresql://mock',
  SESSION_SECRET:          'session-secret',
  NODE_ENV:                'test',
  PORT:                    '3001',
  BOT_TOKEN:               'bot-token',
  TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
  FILTER_MODE:             'keyword_gate',
}

describe('parseEnv', () => {
  it('defaults to Gemini with the existing model and requires an API key', () => {
    const env = parseEnv({
      ...baseEnv,
      AI_API_KEY: 'gemini-key',
    })

    expect(env.AI_PROVIDER).toBe('gemini')
    expect(env.AI_MODEL).toBe('gemini-2.5-flash')
    expect(env.AI_API_KEY).toBe('gemini-key')
    expect(env.AI_TIMEOUT_MS).toBe(30000)
    expect(env.CLASSIFIER_BATCH_SIZE).toBe(100)
  })

  it('rejects Gemini configuration without an API key', () => {
    expect(() => parseEnv(baseEnv)).toThrow(/AI_API_KEY is required when AI_PROVIDER=gemini/)
  })

  it('allows Ollama without an API key when a local model is configured', () => {
    const env = parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'ollama',
      AI_MODEL:    'gemma3:4b',
    })

    expect(env.AI_PROVIDER).toBe('ollama')
    expect(env.AI_MODEL).toBe('gemma3:4b')
    expect(env.AI_API_KEY).toBeUndefined()
    expect(env.AI_TIMEOUT_MS).toBe(30000)
  })

  it('rejects Ollama when the model is missing or still the Gemini default', () => {
    expect(() => parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'ollama',
    })).toThrow(/AI_MODEL must be set to a non-Gemini model/)

    expect(() => parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'ollama',
      AI_MODEL:    'gemini-2.5-flash',
    })).toThrow(/AI_MODEL must be set to a non-Gemini model/)
  })

  it('requires OpenAI-compatible provider key, model, and base URL', () => {
    expect(() => parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY:  'compatible-key',
      AI_BASE_URL: 'http://localhost:1234/v1',
    })).toThrow(/AI_MODEL must be set to a non-Gemini model/)

    expect(() => parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'openai-compatible',
      AI_MODEL:    'qwen2.5:7b',
      AI_API_KEY:  'compatible-key',
    })).toThrow(/AI_BASE_URL is required/)

    expect(() => parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'openai-compatible',
      AI_MODEL:    'qwen2.5:7b',
      AI_BASE_URL: 'http://localhost:1234/v1',
    })).toThrow(/AI_API_KEY is required/)

    const env = parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'openai-compatible',
      AI_MODEL:    'qwen2.5:7b',
      AI_BASE_URL: 'http://localhost:1234/v1',
      AI_API_KEY:  'compatible-key',
    })

    expect(env.AI_BASE_URL).toBe('http://localhost:1234/v1')
  })

  it('allows rule-only without API key, model, or base URL', () => {
    const env = parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'rule-only',
    })

    expect(env.AI_PROVIDER).toBe('rule-only')
    expect(env.AI_API_KEY).toBeUndefined()
    expect(env.AI_MODEL).toBe('gemini-2.5-flash')
  })

  it('coerces a positive timeout and rejects invalid providers', () => {
    const env = parseEnv({
      ...baseEnv,
      AI_API_KEY:    'gemini-key',
      AI_TIMEOUT_MS: '15000',
    })

    expect(env.AI_TIMEOUT_MS).toBe(15000)

    expect(() => parseEnv({
      ...baseEnv,
      AI_PROVIDER: 'invalid-provider',
      AI_API_KEY:  'gemini-key',
    })).toThrow()
  })

  it('rejects removed filter modes', () => {
    expect(() => parseEnv({
      ...baseEnv,
      FILTER_MODE: 'shadow_compare',
      AI_API_KEY:  'gemini-key',
    })).toThrow()

    expect(() => parseEnv({
      ...baseEnv,
      FILTER_MODE: 'ai_full',
      AI_API_KEY:  'gemini-key',
    })).toThrow()
  })

  it('rejects non-positive timeout values', () => {
    expect(() => parseEnv({
      ...baseEnv,
      AI_API_KEY:    'gemini-key',
      AI_TIMEOUT_MS: '0',
    })).toThrow()
  })

  it('coerces positive classifier batch size and rejects non-positive values', () => {
    const env = parseEnv({
      ...baseEnv,
      AI_API_KEY:            'gemini-key',
      CLASSIFIER_BATCH_SIZE: '25',
    })

    expect(env.CLASSIFIER_BATCH_SIZE).toBe(25)

    expect(() => parseEnv({
      ...baseEnv,
      AI_API_KEY:            'gemini-key',
      CLASSIFIER_BATCH_SIZE: '0',
    })).toThrow()
  })

  it('requires a strong production session secret', () => {
    expect(() => parseEnv({
      ...baseEnv,
      NODE_ENV:       'production',
      SESSION_SECRET: 'short-secret',
      AI_API_KEY:     'gemini-key',
    })).toThrow(/SESSION_SECRET must be a random value/)

    expect(() => parseEnv({
      ...baseEnv,
      NODE_ENV:       'production',
      SESSION_SECRET: 'change_this_to_a_random_string_in_production',
      AI_API_KEY:     'gemini-key',
    })).toThrow(/SESSION_SECRET must be a random value/)

    const env = parseEnv({
      ...baseEnv,
      NODE_ENV:       'production',
      SESSION_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      AI_API_KEY:     'gemini-key',
    })

    expect(env.SESSION_SECRET).toBe('abcdefghijklmnopqrstuvwxyz123456')
  })
})
