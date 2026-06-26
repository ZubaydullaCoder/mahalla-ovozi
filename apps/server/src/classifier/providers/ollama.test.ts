import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  env: {
    AI_BASE_URL:   undefined as string | undefined,
    AI_MODEL:      'gemma3:4b',
    AI_TIMEOUT_MS: 30000,
  },
}))

vi.mock('../../shared/env.js', () => mockEnv)

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('../../shared/logger.js', () => ({
  logger: loggerMocks,
}))

import { classifyWithOllama } from './ollama.js'

describe('classifyWithOllama', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockEnv.env.AI_BASE_URL = undefined
    mockEnv.env.AI_MODEL = 'gemma3:4b'
    mockEnv.env.AI_TIMEOUT_MS = 30000
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls local Ollama chat with structured JSON output and no API key', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      message: {
        content: JSON.stringify({
          decision:      'signal',
          categories:    ['gas'],
          hokim_related: false,
          short_label:   'Gas issue',
        }),
      },
    }))

    const result = await classifyWithOllama('Gaz yoq')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
      }),
    )
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
    expect(requestBody).toEqual(expect.objectContaining({
      model:   'gemma3:4b',
      stream:  false,
      format:  expect.any(Object),
      options: {
        temperature: 0,
      },
    }))
    expect(requestBody.messages[0]).toEqual({
      role:    'user',
      content: expect.stringContaining('<message>\nGaz yoq\n</message>'),
    })
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0]?.[1]?.headers)).not.toContain('Authorization')
    expect(result).toEqual({
      provider:  'ollama',
      model:     'gemma3:4b',
      latencyMs: expect.any(Number),
      rawJson:   {
        decision:      'signal',
        categories:    ['gas'],
        hokim_related: false,
        short_label:   'Gas issue',
      },
    })
  })

  it('uses configured base URL when provided', async () => {
    mockEnv.env.AI_BASE_URL = 'http://127.0.0.1:11435/api/'
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      message: { content: JSON.stringify({ decision: 'ignore' }) },
    }))

    await classifyWithOllama('Salom')

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11435/api/chat',
      expect.any(Object),
    )
  })

  it('throws and logs non-2xx responses without logging prompt or message text', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('server error', { status: 500 }))

    await expect(classifyWithOllama('secret message text')).rejects.toThrow(
      /Ollama classification failed with HTTP 500/,
    )

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event:    'classifier_provider_http_error',
        provider: 'ollama',
        model:    'gemma3:4b',
        status:   500,
      }),
      'Ollama classification HTTP request failed',
    )
    expect(JSON.stringify(loggerMocks.warn.mock.calls)).not.toContain('secret message text')
  })

  it('throws when the outer Ollama response is invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{bad json', { status: 200 }))

    await expect(classifyWithOllama('Suv yoq')).rejects.toThrow(
      /Ollama classification returned invalid response JSON/,
    )
  })

  it('throws when assistant content is invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      message: { content: '{bad json' },
    }))

    await expect(classifyWithOllama('Suv yoq')).rejects.toThrow(
      /Ollama classification returned invalid model content JSON/,
    )
  })

  it('throws a clear timeout error and aborts the request', async () => {
    vi.useFakeTimers()
    mockEnv.env.AI_TIMEOUT_MS = 50
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))

    const classification = classifyWithOllama('Suv yoq')
    const rejection = expect(classification).rejects.toThrow(
      /Ollama classification timed out after 50ms/,
    )

    await vi.advanceTimersByTimeAsync(50)
    await rejection

    const abortSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal
    expect(abortSignal?.aborted).toBe(true)
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event:     'classifier_provider_timeout',
        provider:  'ollama',
        model:     'gemma3:4b',
        timeoutMs: 50,
      }),
      'Ollama classification timed out',
    )
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  })
}
