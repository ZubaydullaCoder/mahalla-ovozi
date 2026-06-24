import { GoogleGenAI } from '@google/genai'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { env } from '../../shared/env.js'
import { buildPrompt } from '../prompt.js'
import { ClassifierOutputSchema } from '../schema.js'
import type { ProviderRawResult } from './types.js'

let aiClient: GoogleGenAI | undefined
let aiClientApiKey: string | undefined

export async function classifyWithGemini(text: string): Promise<ProviderRawResult> {
  const apiKey = env.AI_API_KEY
  if (!apiKey) {
    throw new Error('AI_API_KEY is required for Gemini provider')
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  const response = await withTimeout(
    getGeminiClient(apiKey).models.generateContent({
      model:    env.AI_MODEL,
      contents: buildPrompt(text),
      config:   {
        abortSignal: controller.signal,
        responseMimeType: 'application/json',
        responseJsonSchema: zodToJsonSchema(ClassifierOutputSchema),
        temperature: 0,
      },
    }),
    controller,
  )

  const rawText = response.text
  if (!rawText) {
    throw new Error(
      'AI returned empty or null response (possible safety block or quota exhaustion)',
    )
  }

  return {
    provider:  'gemini',
    model:     env.AI_MODEL,
    latencyMs: Date.now() - startedAt,
    rawJson:   parseGeminiJson(rawText),
  }
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!aiClient || aiClientApiKey !== apiKey) {
    aiClient = new GoogleGenAI({ apiKey })
    aiClientApiKey = apiKey
  }

  return aiClient
}

function parseGeminiJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(
      `Gemini classification returned invalid JSON: ${err instanceof Error ? err.message : 'Unknown parse error'}`,
    )
  }
}

async function withTimeout<T>(promise: Promise<T>, controller: AbortController): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error(`Gemini classification timed out after ${env.AI_TIMEOUT_MS}ms`))
    }, env.AI_TIMEOUT_MS)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}
