import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  env: {
    AI_API_KEY:    'test-key',
    AI_MODEL:      'gemini-2.5-flash',
    AI_TIMEOUT_MS: 30000,
  },
}))

vi.mock('../../shared/env.js', () => mockEnv)

const genaiMocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  constructor:     vi.fn(),
}))

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: genaiMocks.generateContent,
    }

    constructor(options: { apiKey: string }) {
      genaiMocks.constructor(options)
    }
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
  }
})

import { classifyWithGemini } from './gemini.js'

describe('classifyWithGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockEnv.env.AI_API_KEY = 'test-key'
    mockEnv.env.AI_MODEL = 'gemini-2.5-flash'
    mockEnv.env.AI_TIMEOUT_MS = 30000
  })

  it('requests Gemini structured JSON output with the shared prompt and schema', async () => {
    genaiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        decision:      'signal',
        categories:    ['water'],
        hokim_related: false,
        classify_reason:   'No water',
      }),
    })

    const result = await classifyWithGemini('Suv yoq')

    expect(genaiMocks.constructor).toHaveBeenCalledWith({ apiKey: 'test-key' })
    expect(genaiMocks.generateContent).toHaveBeenCalledWith({
      model:    'gemini-2.5-flash',
      contents: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
        }),
      ]),
      config: expect.objectContaining({
        responseMimeType:   'application/json',
        responseJsonSchema: expect.any(Object),
        temperature:        0,
        abortSignal:        expect.any(AbortSignal),
      }),
    })
    expect(result).toEqual({
      provider:  'gemini',
      model:     'gemini-2.5-flash',
      latencyMs: expect.any(Number),
      rawJson:   {
        decision:      'signal',
        categories:    ['water'],
        hokim_related: false,
        classify_reason:   'No water',
      },
    })
  })

  it('throws a clear error for empty Gemini responses', async () => {
    genaiMocks.generateContent.mockResolvedValue({ text: '' })

    await expect(classifyWithGemini('Suv yoq')).rejects.toThrow(
      /AI returned empty or null response/,
    )
  })

  it('throws a clear timeout error and aborts the SDK request', async () => {
    vi.useFakeTimers()
    mockEnv.env.AI_TIMEOUT_MS = 50
    genaiMocks.generateContent.mockReturnValue(new Promise(() => {}))

    const classification = classifyWithGemini('Suv yoq')
    const rejection = expect(classification).rejects.toThrow(
      /Gemini classification timed out after 50ms/,
    )

    await vi.advanceTimersByTimeAsync(50)
    await rejection

    const abortSignal = genaiMocks.generateContent.mock.calls[0]?.[0]?.config?.abortSignal
    expect(abortSignal?.aborted).toBe(true)
  })
})
