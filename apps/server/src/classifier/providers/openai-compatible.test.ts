import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  env: {
    AI_API_KEY:    'compatible-key',
    AI_BASE_URL:   'http://localhost:1234/v1',
    AI_MODEL:      'qwen2.5:7b',
    AI_TIMEOUT_MS: 30000,
  },
}))

vi.mock('../../shared/env.js', () => mockEnv)

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../../shared/logger.js', () => ({
  logger: loggerMocks,
}))

import { classifyWithOpenAiCompatible } from './openai-compatible.js'

describe('classifyWithOpenAiCompatible', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockEnv.env.AI_API_KEY = 'compatible-key'
    mockEnv.env.AI_BASE_URL = 'http://localhost:1234/v1'
    mockEnv.env.AI_MODEL = 'qwen2.5:7b'
    mockEnv.env.AI_TIMEOUT_MS = 30000
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls chat completions with bearer auth, selected model, prompt, and JSON Schema response format', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              decision:      'signal',
              categories:    ['waste'],
              hokim_related: false,
              short_label:   'Waste issue',
            }),
          },
        },
      ],
    }))

    const result = await classifyWithOpenAiCompatible('Chiqindi muammosi')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization:  'Bearer compatible-key',
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
      }),
    )
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
    expect(requestBody).toEqual(expect.objectContaining({
      model:       'qwen2.5:7b',
      temperature: 0,
      messages:    [
        {
          role:    'user',
          content: expect.stringContaining('<message>\nChiqindi muammosi\n</message>'),
        },
      ],
      response_format: {
        type:        'json_schema',
        json_schema: {
          name:   'classifier_output',
          schema: expect.any(Object),
          strict: true,
        },
      },
    }))
    expect(result).toEqual({
      provider:  'openai-compatible',
      model:     'qwen2.5:7b',
      latencyMs: expect.any(Number),
      rawJson:   {
        decision:      'signal',
        categories:    ['waste'],
        hokim_related: false,
        short_label:   'Waste issue',
      },
    })
  })

  it('falls back to JSON object mode when JSON Schema response format is rejected', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('unsupported response_format json_schema', { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { content: JSON.stringify({ decision: 'ignore' }) } }],
      }))

    const result = await classifyWithOpenAiCompatible('Salom')

    expect(result.rawJson).toEqual({ decision: 'ignore' })
    expect(fetch).toHaveBeenCalledTimes(2)
    const fallbackBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))
    expect(fallbackBody.response_format).toEqual({ type: 'json_object' })
    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event:    'classifier_provider_response_format_fallback',
        provider: 'openai-compatible',
        from:     'json_schema',
        to:       'json_object',
      }),
      expect.any(String),
    )
  })

  it('falls back to prompt-only mode when response_format is rejected', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('unsupported response_format json_schema', { status: 400 }))
      .mockResolvedValueOnce(new Response('unsupported response_format json_object', { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { content: JSON.stringify({ decision: 'ignore' }) } }],
      }))

    await classifyWithOpenAiCompatible('Salom')

    expect(fetch).toHaveBeenCalledTimes(3)
    const promptOnlyBody = JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))
    expect(promptOnlyBody.response_format).toBeUndefined()
  })

  it('throws and logs non-2xx responses without logging auth header or message text', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('provider down', { status: 503 }))

    await expect(classifyWithOpenAiCompatible('secret message text')).rejects.toThrow(
      /OpenAI-compatible classification failed with HTTP 503/,
    )

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event:    'classifier_provider_http_error',
        provider: 'openai-compatible',
        model:    'qwen2.5:7b',
        status:   503,
      }),
      'OpenAI-compatible classification HTTP request failed',
    )
    const logs = JSON.stringify(loggerMocks.warn.mock.calls)
    expect(logs).not.toContain('compatible-key')
    expect(logs).not.toContain('secret message text')
  })

  it('throws when choices or message content are missing', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ choices: [] }))

    await expect(classifyWithOpenAiCompatible('Suv yoq')).rejects.toThrow(
      /OpenAI-compatible classification returned empty message content/,
    )
  })

  it('throws when the outer response is invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{bad json', { status: 200 }))

    await expect(classifyWithOpenAiCompatible('Suv yoq')).rejects.toThrow(
      /OpenAI-compatible classification returned invalid response JSON/,
    )
  })

  it('throws when the model content is invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      choices: [{ message: { content: '{bad json' } }],
    }))

    await expect(classifyWithOpenAiCompatible('Suv yoq')).rejects.toThrow(
      /OpenAI-compatible classification returned invalid json_schema content JSON/,
    )
  })

  it('throws a clear timeout error and aborts the request', async () => {
    vi.useFakeTimers()
    mockEnv.env.AI_TIMEOUT_MS = 50
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))

    const classification = classifyWithOpenAiCompatible('Suv yoq')
    const rejection = expect(classification).rejects.toThrow(
      /OpenAI-compatible classification timed out after 50ms/,
    )

    await vi.advanceTimersByTimeAsync(50)
    await rejection

    const abortSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal
    expect(abortSignal?.aborted).toBe(true)
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event:     'classifier_provider_timeout',
        provider:  'openai-compatible',
        model:     'qwen2.5:7b',
        timeoutMs: 50,
      }),
      'OpenAI-compatible classification timed out',
    )
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  })
}
