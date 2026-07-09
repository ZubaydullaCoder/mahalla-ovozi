// apps/server/src/classifier/summary-generator.ts
// Best-effort AI summary generation for classified signal messages.
// NEVER throws — returns null on any failure.
// Failure must not propagate to signal persistence (AC6).

import { GoogleGenAI } from '@google/genai'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import { buildSummaryPrompt } from './summary-prompt.js'

/**
 * Generates an Uzbek Cyrillic professional summary for a signal message.
 *
 * Routing:
 *   - rule-only  → null immediately (no AI call)
 *   - gemini     → Google GenAI plain-text completion
 *   - ollama     → /api/chat plain-text completion
 *   - openai-compatible → /v1/chat/completions plain-text completion
 *
 * Returns null on ANY error (timeout, provider failure, invalid/empty/non-Cyrillic output).
 */
export async function generateSignalSummary(
  rawText: string,
  senderName: string | null,
  category: string,
): Promise<string | null> {
  try {
    const promptText = buildSummaryPrompt(rawText, senderName, category)

    switch (env.AI_PROVIDER) {
      case 'rule-only':
        return null

      case 'gemini':
        return await generateWithGemini(promptText)

      case 'ollama':
        return await generateWithOllama(promptText)

      case 'openai-compatible':
        return await generateWithOpenAiCompatible(promptText)

      default: {
        // TypeScript exhaustive check — should never reach here
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _exhaustiveCheck: never = env.AI_PROVIDER
        return null
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Summary generation unexpected error; using null')
    return null
  }
}

// ─── Normalization / Validation ───────────────────────────────────────────────

/**
 * Validates and normalises a raw AI response before persistence.
 * Returns null for empty, oversized, or non-Cyrillic output.
 */
function normalizeSummary(text: string | null | undefined): string | null {
  const trimmed = text?.trim()
  if (!trimmed) return null
  if (trimmed.length > 500) return null
  // Must contain at least one Uzbek/Russian Cyrillic character
  if (!/[А-Яа-яЁёЎўҚқҒғҲҳ]/.test(trimmed)) return null
  return trimmed
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

let _geminiClient: GoogleGenAI | undefined
let _geminiClientApiKey: string | undefined

function getGeminiClient(): GoogleGenAI {
  const apiKey = env.AI_API_KEY!
  if (!_geminiClient || _geminiClientApiKey !== apiKey) {
    _geminiClient = new GoogleGenAI({ apiKey })
    _geminiClientApiKey = apiKey
  }
  return _geminiClient
}

async function generateWithGemini(promptText: string): Promise<string | null> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort()
        reject(new Error(`Gemini summary timed out after ${env.AI_TIMEOUT_MS}ms`))
      }, env.AI_TIMEOUT_MS)
    })

    const responsePromise = getGeminiClient().models.generateContent({
      model:    env.AI_MODEL,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config:   {
        abortSignal: controller.signal,
        temperature: 0.3,
        // NO responseMimeType — plain text output only (AC: no JSON for summary)
      },
    })

    const response = await Promise.race([responsePromise, timeoutPromise])
    return normalizeSummary(response.text)
  } catch (err) {
    logger.warn({ provider: 'gemini', err }, 'Gemini summary generation failed; using null')
    return null
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

// ─── Ollama ───────────────────────────────────────────────────────────────────

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/api'

type OllamaChatResponse = {
  message?: {
    content?: unknown
  }
}

async function generateWithOllama(promptText: string): Promise<string | null> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const baseUrl = env.AI_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const endpoint = new URL('chat', normalizedBase).toString()

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort()
        reject(new Error(`Ollama summary timed out after ${env.AI_TIMEOUT_MS}ms`))
      }, env.AI_TIMEOUT_MS)
    })

    const fetchPromise = fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:    env.AI_MODEL,
        messages: [{ role: 'user', content: promptText }],
        stream:   false,
        think:    false,
        options:  {
          temperature: 0.3,
        },
      }),
      signal:  controller.signal,
    })

    const response = await Promise.race([fetchPromise, timeoutPromise])

    if (!response.ok) {
      logger.warn(
        { provider: 'ollama', status: response.status },
        'Ollama summary HTTP request failed; using null',
      )
      return null
    }

    const body = await response.json() as OllamaChatResponse
    const content = body.message?.content
    if (typeof content !== 'string') return null
    return normalizeSummary(content)
  } catch (err) {
    logger.warn({ provider: 'ollama', err }, 'Ollama summary generation failed; using null')
    return null
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

// ─── OpenAI-compatible ────────────────────────────────────────────────────────

type OpenAiCompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

async function generateWithOpenAiCompatible(promptText: string): Promise<string | null> {
  if (!env.AI_BASE_URL) {
    logger.warn({ provider: 'openai-compatible' }, 'AI_BASE_URL missing; using null for summary')
    return null
  }

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const normalizedBase = env.AI_BASE_URL.endsWith('/') ? env.AI_BASE_URL : `${env.AI_BASE_URL}/`
  const endpoint = new URL('chat/completions', normalizedBase).toString()

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort()
        reject(new Error(`OpenAI-compatible summary timed out after ${env.AI_TIMEOUT_MS}ms`))
      }, env.AI_TIMEOUT_MS)
    })

    const fetchPromise = fetch(endpoint, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${env.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:    env.AI_MODEL,
        messages: [{ role: 'user', content: promptText }],
        // No response_format — plain text output only
      }),
      signal: controller.signal,
    })

    const response = await Promise.race([fetchPromise, timeoutPromise])

    if (!response.ok) {
      logger.warn(
        { provider: 'openai-compatible', status: response.status },
        'OpenAI-compatible summary HTTP request failed; using null',
      )
      return null
    }

    const body = await response.json() as OpenAiCompatibleResponse
    const content = body.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null
    return normalizeSummary(content)
  } catch (err) {
    logger.warn(
      { provider: 'openai-compatible', err },
      'OpenAI-compatible summary generation failed; using null',
    )
    return null
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}
