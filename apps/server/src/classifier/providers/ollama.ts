import { zodToJsonSchema } from 'zod-to-json-schema'
import { env } from '../../shared/env.js'
import { logger } from '../../shared/logger.js'
import { buildPlainPrompt } from '../prompt.js'
import { ClassifierOutputSchema } from '../schema.js'
import type { ProviderRawResult } from './types.js'

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/api'

type OllamaChatResponse = {
  message?: {
    content?: unknown
  }
}

export async function classifyWithOllama(text: string): Promise<ProviderRawResult> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const endpoint = buildOllamaEndpoint(env.AI_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL)

  const response = await fetchWithTimeout(
    fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:    env.AI_MODEL,
        messages: [{ role: 'user', content: buildPlainPrompt(text) }],
        stream:   false,
        format:   zodToJsonSchema(ClassifierOutputSchema),
        options:  {
          temperature: 0,
        },
      }),
      signal: controller.signal,
    }),
    controller,
  )

  const latencyMs = Date.now() - startedAt

  if (!response.ok) {
    logger.warn(
      {
        event:     'classifier_provider_http_error',
        provider:  'ollama',
        model:     env.AI_MODEL,
        latencyMs,
        status:    response.status,
      },
      'Ollama classification HTTP request failed',
    )
    throw new Error(`Ollama classification failed with HTTP ${response.status}`)
  }

  const body = await parseResponseJson(response)
  const content = body.message?.content

  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Ollama classification returned empty message content')
  }

  return {
    provider: 'ollama',
    model:    env.AI_MODEL,
    latencyMs,
    rawJson:  parseModelJson(content),
  }
}

function buildOllamaEndpoint(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  return new URL('chat', normalizedBaseUrl).toString()
}

async function fetchWithTimeout(
  request: Promise<Response>,
  controller: AbortController,
): Promise<Response> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      logger.warn(
        {
          event:     'classifier_provider_timeout',
          provider:  'ollama',
          model:     env.AI_MODEL,
          timeoutMs: env.AI_TIMEOUT_MS,
        },
        'Ollama classification timed out',
      )
      reject(new Error(`Ollama classification timed out after ${env.AI_TIMEOUT_MS}ms`))
    }, env.AI_TIMEOUT_MS)
  })

  try {
    return await Promise.race([request, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

async function parseResponseJson(response: Response): Promise<OllamaChatResponse> {
  try {
    return await response.json() as OllamaChatResponse
  } catch (err) {
    throw new Error(`Ollama classification returned invalid response JSON: ${getErrorMessage(err)}`)
  }
}

function parseModelJson(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch (err) {
    throw new Error(`Ollama classification returned invalid model content JSON: ${getErrorMessage(err)}`)
  }
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown parse error'
}
