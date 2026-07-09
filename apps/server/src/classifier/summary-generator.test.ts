// apps/server/src/classifier/summary-generator.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks (hoisted so they are available before imports) ─────────────────────

const mockEnv = vi.hoisted(() => ({
  env: {
    AI_PROVIDER:   'gemini' as 'gemini' | 'ollama' | 'openai-compatible' | 'rule-only',
    AI_API_KEY:    'test-key',
    AI_MODEL:      'gemini-2.5-flash',
    AI_TIMEOUT_MS: 30000,
    AI_BASE_URL:   undefined as string | undefined,
  },
}))

vi.mock('../shared/env.js', () => mockEnv)

vi.mock('../shared/logger.js', () => ({
  logger: {
    warn:  vi.fn(),
    info:  vi.fn(),
    error: vi.fn(),
  },
}))

const genaiMocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: genaiMocks.generateContent },
  })),
}))

// ─── Module under test ────────────────────────────────────────────────────────

import { generateSignalSummary } from './summary-generator.js'
import { logger } from '../shared/logger.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CYRILLIC = 'Алиев исмли гуруҳ аъзоси "Газимиз йўқ" деб мурожаат қилмоқда.'

function setProvider(provider: typeof mockEnv.env.AI_PROVIDER) {
  mockEnv.env.AI_PROVIDER = provider
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateSignalSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockEnv.env.AI_PROVIDER = 'gemini'
    mockEnv.env.AI_API_KEY = 'test-key'
    mockEnv.env.AI_MODEL = 'gemini-2.5-flash'
    mockEnv.env.AI_TIMEOUT_MS = 30000
    mockEnv.env.AI_BASE_URL = undefined
  })

  // ── rule-only ──────────────────────────────────────────────────────────────

  describe('rule-only provider', () => {
    it('returns null immediately without making any AI call', async () => {
      setProvider('rule-only')
      const result = await generateSignalSummary('Suv yoq', 'Ali', 'water')
      expect(result).toBeNull()
      expect(genaiMocks.generateContent).not.toHaveBeenCalled()
    })
  })

  // ── gemini ─────────────────────────────────────────────────────────────────

  describe('gemini provider', () => {
    it('returns trimmed Cyrillic text on valid response', async () => {
      genaiMocks.generateContent.mockResolvedValue({ text: `  ${VALID_CYRILLIC}  ` })
      const result = await generateSignalSummary('Suv yoq', 'Ali', 'water')
      expect(result).toBe(VALID_CYRILLIC)
    })

    it('returns null and logs warn when provider throws', async () => {
      genaiMocks.generateContent.mockRejectedValue(new Error('network failure'))
      const result = await generateSignalSummary('Suv yoq', 'Ali', 'water')
      expect(result).toBeNull()
      expect(logger.warn).toHaveBeenCalled()
    })

    it('returns null when response text is empty', async () => {
      genaiMocks.generateContent.mockResolvedValue({ text: '   ' })
      const result = await generateSignalSummary('Suv yoq', 'Ali', 'water')
      expect(result).toBeNull()
    })

    it('returns null when response text is null/undefined', async () => {
      genaiMocks.generateContent.mockResolvedValue({ text: null })
      const result = await generateSignalSummary('Suv yoq', 'Ali', 'water')
      expect(result).toBeNull()
    })

    it('returns null when response text is non-Cyrillic (Latin only)', async () => {
      genaiMocks.generateContent.mockResolvedValue({ text: 'Gas yo\'q, uy sovuq' })
      const result = await generateSignalSummary('Suv yoq', 'Ali', 'water')
      expect(result).toBeNull()
    })

    it('returns null when response text exceeds 500 characters', async () => {
      const longText = 'А'.repeat(501)
      genaiMocks.generateContent.mockResolvedValue({ text: longText })
      const result = await generateSignalSummary('Suv yoq', 'Ali', 'water')
      expect(result).toBeNull()
    })

    it('returns null on timeout and logs warn', async () => {
      vi.useFakeTimers()
      mockEnv.env.AI_TIMEOUT_MS = 50
      genaiMocks.generateContent.mockReturnValue(new Promise(() => {}))

      const summaryPromise = generateSignalSummary('Suv yoq', 'Ali', 'water')
      await vi.advanceTimersByTimeAsync(100)
      const result = await summaryPromise

      expect(result).toBeNull()
      expect(logger.warn).toHaveBeenCalled()
    })

    it('uses senderName as null → "Foydalanuvchi" subject in prompt', async () => {
      genaiMocks.generateContent.mockResolvedValue({ text: VALID_CYRILLIC })
      await generateSignalSummary('Suv yoq', null, 'water')
      const callArgs = genaiMocks.generateContent.mock.calls[0]?.[0]
      const promptText = callArgs?.contents?.[0]?.parts?.[0]?.text as string
      expect(promptText).toContain('Foydalanuvchi')
    })

    it('does not use responseMimeType or responseJsonSchema (plain text only)', async () => {
      genaiMocks.generateContent.mockResolvedValue({ text: VALID_CYRILLIC })
      await generateSignalSummary('Suv yoq', 'Ali', 'water')
      const callArgs = genaiMocks.generateContent.mock.calls[0]?.[0]
      expect(callArgs?.config?.responseMimeType).toBeUndefined()
      expect(callArgs?.config?.responseJsonSchema).toBeUndefined()
    })
  })

  // ── ollama ─────────────────────────────────────────────────────────────────

  describe('ollama provider', () => {
    beforeEach(() => {
      setProvider('ollama')
    })

    it('returns trimmed Cyrillic text on valid response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ message: { content: `  ${VALID_CYRILLIC}  ` } }), {
          status: 200,
        }),
      )
      const result = await generateSignalSummary('Gaz yoq', 'Ali', 'gas')
      expect(result).toBe(VALID_CYRILLIC)
      fetchSpy.mockRestore()
    })

    it('returns null and logs warn on HTTP error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('error', { status: 500 }),
      )
      const result = await generateSignalSummary('Gaz yoq', 'Ali', 'gas')
      expect(result).toBeNull()
      expect(logger.warn).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('returns null and logs warn when fetch throws', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'))
      const result = await generateSignalSummary('Gaz yoq', 'Ali', 'gas')
      expect(result).toBeNull()
      expect(logger.warn).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('returns null when response content is non-Cyrillic', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ message: { content: 'latin text only' } }), { status: 200 }),
      )
      const result = await generateSignalSummary('Gaz yoq', 'Ali', 'gas')
      expect(result).toBeNull()
      fetchSpy.mockRestore()
    })
  })

  // ── openai-compatible ──────────────────────────────────────────────────────

  describe('openai-compatible provider', () => {
    beforeEach(() => {
      setProvider('openai-compatible')
      mockEnv.env.AI_BASE_URL = 'http://localhost:8080'
      mockEnv.env.AI_API_KEY = 'oa-key'
    })

    it('returns trimmed Cyrillic text on valid response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: `  ${VALID_CYRILLIC}  ` } }] }),
          { status: 200 },
        ),
      )
      const result = await generateSignalSummary('Elektr yoq', 'Ali', 'electricity')
      expect(result).toBe(VALID_CYRILLIC)
      fetchSpy.mockRestore()
    })

    it('returns null and logs warn on HTTP error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('error', { status: 503 }),
      )
      const result = await generateSignalSummary('Elektr yoq', 'Ali', 'electricity')
      expect(result).toBeNull()
      expect(logger.warn).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('returns null when AI_BASE_URL is missing', async () => {
      mockEnv.env.AI_BASE_URL = undefined
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
      const result = await generateSignalSummary('Elektr yoq', 'Ali', 'electricity')
      expect(result).toBeNull()
      expect(logger.warn).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('returns null and logs warn when fetch throws', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
      const result = await generateSignalSummary('Elektr yoq', 'Ali', 'electricity')
      expect(result).toBeNull()
      expect(logger.warn).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('appends chat/completions to AI_BASE_URL (properly handling trailing slash and trailing v1)', async () => {
      mockEnv.env.AI_BASE_URL = 'http://localhost:1234/v1'
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: VALID_CYRILLIC } }] }),
          { status: 200 },
        ),
      )
      const result = await generateSignalSummary('Elektr yoq', 'Ali', 'electricity')
      expect(result).toBe(VALID_CYRILLIC)
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.any(Object),
      )
      fetchSpy.mockRestore()
    })
  })
})
