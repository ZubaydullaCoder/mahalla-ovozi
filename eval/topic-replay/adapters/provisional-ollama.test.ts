import { beforeEach, describe, expect, it, vi } from 'vitest'

import { parseHarnessConfig } from '../harness-config.js'
import { ReplayCaseSchema } from '../schema.js'
import { runReplayCase } from '../runner.js'
import { createProvisionalOllamaAdapter } from './provisional-ollama.js'

const configEnv = {
  EVAL_OLLAMA_URL: 'http://127.0.0.1:11434',
  EVAL_OLLAMA_MODEL: 'gemma4:12b',
  EVAL_TIMEOUT_MS: '1000',
  EVAL_SEED: '7',
  EVAL_TEMPERATURE: '0',
  EVAL_NUM_CTX: '8192',
  EVAL_NUM_PREDICT: '512',
  EVAL_KEEP_ALIVE: '5m',
  EVAL_THINK: 'false',
}

const replayCase = ReplayCaseSchema.parse({
  id: 'ollama-001',
  scope: { districtKey: 'd1', mahallaKey: 'h1', telegramChatKey: 'c1' },
  activeHokimKeywords: [],
  messages: [
    {
      key: 'm1',
      telegramTimestamp: '2026-07-18T05:00:00.000Z',
      senderKey: 'resident-1',
      text: 'PRIVATE_FIXTURE_TEXT_1',
      textSource: 'text',
    },
    {
      key: 'm2',
      telegramTimestamp: '2026-07-18T05:01:00.000Z',
      text: 'PRIVATE_FIXTURE_TEXT_2',
      textSource: 'text',
    },
  ],
  expected: {
    dispositions: { m1: 'new_topic', m2: 'attached' },
    topics: [],
    promotionEvents: [],
  },
  adapterScript: {
    steps: [
      {
        messageKey: 'm1',
        disposition: 'irrelevant',
        topicUpdates: [],
        promotionEvents: [],
        telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 0 },
      },
      {
        messageKey: 'm2',
        disposition: 'irrelevant',
        topicUpdates: [],
        promotionEvents: [],
        telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 0 },
      },
    ],
  },
})

describe('parseHarnessConfig', () => {
  it('uses CLI mode before environment and deterministic mode needs no provider config', () => {
    expect(parseHarnessConfig(['--mode', 'deterministic'], {
      EVAL_MODE: 'provisional',
    })).toEqual({ mode: 'deterministic' })
  })

  it.each([
    ['https://localhost:11434', 'invalid_ollama_url'],
    ['http://example.com:11434', 'invalid_ollama_url'],
    ['http://user:pass@localhost:11434', 'invalid_ollama_url'],
  ])('rejects non-local URL %s', (url, code) => {
    expect(() => parseHarnessConfig(['--mode', 'provisional'], {
      ...configEnv,
      EVAL_OLLAMA_URL: url,
    })).toThrow(expect.objectContaining({ code }))
  })
})

describe('provisional Ollama adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends sequential structured-output requests with full prefix and accumulated state', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(chatResponse('m1', 'new_topic', [{
        topicKey: 'p1',
        messageKeys: ['m1'],
        categories: ['water'],
        anchorMessageKey: 'm1',
      }]))
      .mockResolvedValueOnce(chatResponse('m2', 'attached', [{
        topicKey: 'p1',
        messageKeys: ['m1', 'm2'],
        categories: ['water'],
        anchorMessageKey: 'm1',
      }]))
    const adapter = createProvisionalOllamaAdapter(
      provisionalConfig(),
    )

    const result = await runReplayCase(replayCase, adapter)

    expect(result.dispositions).toEqual({ m1: 'new_topic', m2: 'attached' })
    expect(fetch).toHaveBeenCalledTimes(2)
    const firstRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
    const secondRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))
    expect(firstRequest).toMatchObject({
      model: 'gemma4:12b',
      stream: false,
      think: false,
      keep_alive: '5m',
      options: { seed: 7, temperature: 0, num_ctx: 8192, num_predict: 512 },
    })
    expect(firstRequest.format).toEqual(expect.objectContaining({
      type: 'object',
      properties: expect.objectContaining({
        messageKey: expect.objectContaining({ type: 'string' }),
        disposition: expect.any(Object),
        topicUpdates: expect.objectContaining({ type: 'array' }),
      }),
    }))
    expect(secondRequest.messages[0].content).toContain('PRIVATE_FIXTURE_TEXT_1')
    expect(secondRequest.messages[0].content).toContain('"senderKey":"resident-1"')
    expect(secondRequest.messages[0].content).toContain('"districtKey":"d1"')
    expect(secondRequest.messages[0].content).toContain('Output JSON Schema')
    expect(secondRequest.messages[0].content).toContain('"topicKey":"p1"')
    expect(vi.mocked(fetch).mock.calls.every(call => call[1]?.redirect === 'error')).toBe(true)
  })

  it.each([
    ['provider_http_error', new Response('', { status: 503 })],
    ['invalid_response_json', new Response('{bad', { status: 200 })],
    ['empty_model_content', jsonResponse({ message: { content: '' } })],
    ['invalid_model_json', jsonResponse({ message: { content: '{bad' } })],
    ['schema_invalid_output', jsonResponse({ message: { content: '{}' } })],
    ['domain_invalid_output', chatResponse('wrong-message', 'new_topic', [])],
  ])('classifies %s without exposing payloads', async (code, response) => {
    vi.mocked(fetch).mockResolvedValue(response)
    const adapter = createProvisionalOllamaAdapter(
      provisionalConfig(),
    )

    let caught: unknown
    try {
      await runReplayCase(replayCase, adapter)
    } catch (error) {
      caught = error
    }
    expect(caught).toMatchObject({ code })
    expect(caught).toMatchObject({
      stepTelemetry: [
        expect.objectContaining({
          attempts: 1,
          terminalFailure: true,
        }),
      ],
    })
    expect(String(caught)).not.toContain('PRIVATE_FIXTURE_TEXT')
  })

  it('aborts timeout-bound requests and performs no fallback', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))
    const adapter = createProvisionalOllamaAdapter({
      ...provisionalConfig(),
      timeoutMs: 10,
    })

    const pending = runReplayCase(replayCase, adapter)
    const rejection = expect(pending).rejects.toMatchObject({ code: 'provider_timeout' })
    await vi.advanceTimersByTimeAsync(10)
    await rejection

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it('keeps the timeout active while reading the response body', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}),
    } as Response)
    const adapter = createProvisionalOllamaAdapter({
      ...provisionalConfig(),
      timeoutMs: 10,
    })

    const pending = runReplayCase(replayCase, adapter)
    const rejection = expect(pending).rejects.toMatchObject({ code: 'provider_timeout' })
    await vi.advanceTimersByTimeAsync(10)
    await rejection

    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it('records local runtime and exact model provenance', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ version: '0.12.0' }))
      .mockResolvedValueOnce(jsonResponse({
        models: [{
          name: 'gemma4:12b',
          digest: 'sha256-safe-digest',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        template: 'PRIVATE_RAW_TEMPLATE',
        license: 'PRIVATE_RAW_LICENSE',
        capabilities: ['completion'],
        details: {
          family: 'gemma4',
          parameter_size: '12B',
          format: 'gguf',
          quantization_level: 'Q4_K_M',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        models: [{
          name: 'gemma4:12b',
          context_length: 8192,
          size: 456,
          size_vram: 123,
        }],
      }))
    const adapter = createProvisionalOllamaAdapter(provisionalConfig())

    const provenance = await adapter.getProvenance?.()
    expect(provenance).toMatchObject({
      ollamaVersion: '0.12.0',
      model: 'gemma4:12b',
      modelDigest: 'sha256-safe-digest',
      concurrency: 1,
      runtimeOptions: {
        numCtx: 8192,
        loadedContextLength: 8192,
        loadedSizeBytes: 456,
        loadedVramBytes: 123,
      },
      modelDetails: {
        family: 'gemma4',
        parameterSize: '12B',
        format: 'gguf',
        quantizationLevel: 'Q4_K_M',
        capabilities: ['completion'],
      },
    })
    expect(JSON.stringify(provenance)).not.toContain('PRIVATE_RAW_TEMPLATE')
    expect(JSON.stringify(provenance)).not.toContain('PRIVATE_RAW_LICENSE')
    expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([
      'http://127.0.0.1:11434/api/version',
      'http://127.0.0.1:11434/api/tags',
      'http://127.0.0.1:11434/api/show',
      'http://127.0.0.1:11434/api/ps',
    ])
  })

  it('fails closed when required version or exact digest provenance is absent', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ models: [{ name: 'gemma4:12b' }] }))
      .mockResolvedValueOnce(jsonResponse({ details: { family: 'gemma4' } }))
      .mockResolvedValueOnce(jsonResponse({ models: [] }))
    const adapter = createProvisionalOllamaAdapter(provisionalConfig())

    await expect(adapter.getProvenance?.()).rejects.toMatchObject({
      code: 'provider_metadata_invalid',
    })
  })
})

function chatResponse(
  messageKey: string,
  disposition: 'new_topic' | 'attached',
  topicUpdates: unknown[],
): Response {
  return jsonResponse({
    message: {
      content: JSON.stringify({
        messageKey,
        disposition,
        topicUpdates,
        promotionEvents: [],
        telemetry: {
          attempts: 1,
          retries: 0,
          terminalFailure: false,
          latencyMs: 0,
        },
      }),
    },
    total_duration: 100,
    load_duration: 10,
    prompt_eval_count: 20,
    prompt_eval_duration: 30,
    eval_count: 5,
    eval_duration: 40,
  })
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function provisionalConfig() {
  const config = parseHarnessConfig(['--mode', 'provisional'], configEnv)
  if (config.mode !== 'provisional') throw new Error('Expected provisional config')
  return config.ollama
}
