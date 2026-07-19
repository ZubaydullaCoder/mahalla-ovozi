import { zodToJsonSchema } from 'zod-to-json-schema'
import { z as z3 } from 'zod/v3'

import type { OllamaHarnessConfig } from '../harness-config.js'
import { SAFE_ID_PATTERN, type AdapterStepOutput } from '../schema.js'
import { AdapterOperationalError, type ReplayAdapter, type ReplayAdapterInput } from './types.js'

const ProvisionalTopicStateSchema = z3.object({
  topicKey: z3.string().regex(SAFE_ID_PATTERN),
  messageKeys: z3.array(z3.string().regex(SAFE_ID_PATTERN)).min(1),
  categories: z3.array(z3.enum(['water', 'electricity', 'gas', 'waste'])).min(1),
  anchorMessageKey: z3.string().regex(SAFE_ID_PATTERN),
})

const ProvisionalModelOutputSchema = z3.object({
  messageKey: z3.string().regex(SAFE_ID_PATTERN),
  disposition: z3.enum(['new_topic', 'attached', 'irrelevant']),
  topicUpdates: z3.array(ProvisionalTopicStateSchema),
  promotionEvents: z3.array(z3.object({
    originMessageKey: z3.string().regex(SAFE_ID_PATTERN),
    triggerMessageKey: z3.string().regex(SAFE_ID_PATTERN),
    topicKey: z3.string().regex(SAFE_ID_PATTERN),
  })),
  summaryText: z3.string().min(1).max(4000).optional(),
})
const provisionalOutputJsonSchema = zodToJsonSchema(ProvisionalModelOutputSchema)

type OllamaChatResponse = {
  message?: { content?: unknown }
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export function createProvisionalOllamaAdapter(config: OllamaHarnessConfig): ReplayAdapter {
  const endpoint = buildOllamaEndpoint(config.baseUrl, 'chat')

  return {
    name: 'provisional_ollama',
    authorityLabel: 'provisional_pre_triage',
    async classifyStep(input) {
      const prompt = buildEvaluationPrompt(input, provisionalOutputJsonSchema)
      const startedAt = performance.now()
      try {
        const outer = await withTimeout(async signal => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            redirect: 'error',
            signal,
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
              think: config.think,
              keep_alive: config.keepAlive,
              format: provisionalOutputJsonSchema,
              options: {
                seed: config.seed,
                temperature: config.temperature,
                num_ctx: config.numCtx,
                num_predict: config.numPredict,
              },
            }),
          })
          if (!response.ok) {
            throw new AdapterOperationalError('provider_http_error', 'Local Ollama request failed')
          }
          return parseOuterResponse(response)
        }, config.timeoutMs)
        const content = outer.message?.content
        if (typeof content !== 'string' || content.trim() === '') {
          throw new AdapterOperationalError('empty_model_content', 'Local Ollama returned empty content')
        }
        let modelValue: unknown
        try {
          modelValue = JSON.parse(content)
        } catch {
          throw new AdapterOperationalError(
            'invalid_model_json',
            'Local Ollama returned malformed model JSON',
          )
        }
        const parsed = ProvisionalModelOutputSchema.safeParse(modelValue)
        if (!parsed.success) {
          throw new AdapterOperationalError(
            'schema_invalid_output',
            'Local Ollama output failed schema validation',
          )
        }
        validateDomainOutput(input, parsed.data)
        const latencyMs = performance.now() - startedAt
        const output: AdapterStepOutput = {
          ...parsed.data,
          telemetry: {
            attempts: 1,
            retries: 0,
            terminalFailure: false,
            latencyMs,
            promptCharacters: prompt.length,
            inputTokens: outer.prompt_eval_count,
            outputTokens: outer.eval_count,
            totalDurationNs: outer.total_duration,
            loadDurationNs: outer.load_duration,
            promptEvalDurationNs: outer.prompt_eval_duration,
            evalDurationNs: outer.eval_duration,
          },
        }
        return output
      } catch (error) {
        const operational = error instanceof AdapterOperationalError
          ? error
          : new AdapterOperationalError(
              'provider_network_error',
              'Local Ollama network request failed',
            )
        throw new AdapterOperationalError(operational.code, operational.message, {
          attempts: 1,
          retries: 0,
          terminalFailure: true,
          latencyMs: performance.now() - startedAt,
          promptCharacters: prompt.length,
        })
      }
    },
    async getProvenance() {
      const version = await fetchMetadata(
        buildOllamaEndpoint(config.baseUrl, 'version'),
        config.timeoutMs,
      )
      const tags = await fetchMetadata(
        buildOllamaEndpoint(config.baseUrl, 'tags'),
        config.timeoutMs,
      )
      const details = await fetchMetadata(
        buildOllamaEndpoint(config.baseUrl, 'show'),
        config.timeoutMs,
        {
          method: 'POST',
          body: JSON.stringify({ model: config.model }),
        },
      )
      const running = await fetchMetadata(
        buildOllamaEndpoint(config.baseUrl, 'ps'),
        config.timeoutMs,
      )
      const model = findModel(tags, config.model)
      const runningModel = findModel(running, config.model)
      const ollamaVersion = getRecordString(version, 'version')
      const modelDigest = getRecordString(model, 'digest')
      if (!ollamaVersion || !modelDigest) {
        throw new AdapterOperationalError(
          'provider_metadata_invalid',
          'Required local Ollama provenance is unavailable',
        )
      }
      return {
        adapter: 'provisional_ollama',
        ollamaVersion,
        model: config.model,
        modelDigest,
        modelDetails: extractModelDetails(details),
        runtimeOptions: {
          seed: config.seed,
          temperature: config.temperature,
          numCtx: config.numCtx,
          numPredict: config.numPredict,
          think: config.think,
          keepAlive: config.keepAlive,
          loadedContextLength: getRecordNumber(runningModel, 'context_length'),
          loadedSizeBytes: getRecordNumber(runningModel, 'size'),
          loadedVramBytes: getRecordNumber(runningModel, 'size_vram'),
        },
        concurrency: 1,
        warmColdPolicy: 'load_duration_gt_zero_is_cold',
      }
    },
  }
}

export function buildOllamaEndpoint(baseUrl: string, resource: string): string {
  const url = new URL(baseUrl)
  url.pathname = `/api/${resource}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

function buildEvaluationPrompt(
  input: ReplayAdapterInput,
  outputSchema: Record<string, unknown>,
): string {
  const serializeMessage = (message: ReplayAdapterInput['message']) => ({
    key: message.key,
    telegramTimestamp: message.telegramTimestamp,
    senderKey: message.senderKey ?? null,
    text: message.text,
    textSource: message.textSource,
    replyToKey: message.replyToKey ?? null,
    tags: message.tags,
  })
  return [
    'Evaluation-only contextual topic replay. Return only JSON matching the supplied schema.',
    'Use stable synthetic topic IDs. Do not infer production retrieval or persistence behavior.',
    `Output JSON Schema: ${JSON.stringify(outputSchema)}`,
    `Replay scope: ${JSON.stringify(input.replayCase.scope)}`,
    `Fixture-local active Hokim keywords: ${JSON.stringify(input.replayCase.activeHokimKeywords)}`,
    `Earlier validated fixture prefix: ${JSON.stringify(input.priorMessages.map(serializeMessage))}`,
    `Current synthetic message: ${JSON.stringify(serializeMessage(input.message))}`,
    `Accumulated synthetic topic state: ${JSON.stringify(input.state)}`,
  ].join('\n')
}

function validateDomainOutput(
  input: ReplayAdapterInput,
  output: z3.infer<typeof ProvisionalModelOutputSchema>,
): void {
  if (output.messageKey !== input.message.key) {
    throw new AdapterOperationalError('domain_invalid_output', 'Local Ollama output referenced the wrong message')
  }
  const availableKeys = new Set([...input.priorMessages, input.message].map(message => message.key))
  for (const topic of output.topicUpdates) {
    if (topic.messageKeys.some(key => !availableKeys.has(key))) {
      throw new AdapterOperationalError('domain_invalid_output', 'Local Ollama output referenced an unavailable message')
    }
  }
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(new AdapterOperationalError('provider_timeout', 'Local Ollama request timed out'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      operation(controller.signal),
      timeoutPromise,
    ])
  } catch (error) {
    if (error instanceof AdapterOperationalError) throw error
    if (controller.signal.aborted) {
      throw new AdapterOperationalError('provider_timeout', 'Local Ollama request timed out')
    }
    throw new AdapterOperationalError('provider_network_error', 'Local Ollama network request failed')
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function parseOuterResponse(response: Response): Promise<OllamaChatResponse> {
  try {
    return await response.json() as OllamaChatResponse
  } catch {
    throw new AdapterOperationalError('invalid_response_json', 'Local Ollama returned malformed response JSON')
  }
}

async function fetchMetadata(
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<unknown> {
  return withTimeout(async signal => {
    const response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json' },
      redirect: 'error',
      signal,
    })
    if (!response.ok) {
      throw new AdapterOperationalError(
        'provider_metadata_error',
        'Local Ollama metadata request failed',
      )
    }
    return parseOuterResponse(response)
  }, timeoutMs)
}

function findModel(value: unknown, modelName: string): unknown {
  if (typeof value !== 'object' || value === null || !('models' in value)) return undefined
  const models = (value as { models?: unknown }).models
  if (!Array.isArray(models)) return undefined
  return models.find(model =>
    typeof model === 'object'
    && model !== null
    && ('name' in model || 'model' in model)
    && ((model as { name?: unknown }).name === modelName || (model as { model?: unknown }).model === modelName))
}

function getRecordString(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined
  const item = (value as Record<string, unknown>)[key]
  return typeof item === 'string' ? item : undefined
}

function getRecordNumber(value: unknown, key: string): number | undefined {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined
  const item = (value as Record<string, unknown>)[key]
  return typeof item === 'number' && Number.isFinite(item) ? item : undefined
}

function extractModelDetails(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return {}
  const record = value as Record<string, unknown>
  const details = typeof record.details === 'object' && record.details !== null
    ? record.details as Record<string, unknown>
    : {}
  return {
    format: getRecordString(details, 'format'),
    family: getRecordString(details, 'family'),
    families: Array.isArray(details.families)
      ? details.families.filter((item): item is string => typeof item === 'string')
      : undefined,
    parameterSize: getRecordString(details, 'parameter_size'),
    quantizationLevel: getRecordString(details, 'quantization_level'),
    capabilities: Array.isArray(record.capabilities)
      ? record.capabilities.filter((item): item is string => typeof item === 'string')
      : undefined,
  }
}
