import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '../generated/prisma/client.js'
import type { ClassifierOutput } from './schema.js'

const mockEnv = vi.hoisted(() => ({
  env: {
    DATABASE_URL:            'postgresql://mock',
    NODE_ENV:                'test',
    PORT:                    3001,
    BOT_TOKEN:               'mock-bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'mock-secret',
    FILTER_MODE:             'keyword_gate' as const,
    AI_API_KEY:              'test-key',
    AI_MODEL:                'gemini-2.5-flash',
    CLASSIFIER_BATCH_SIZE:   100,
  },
}))

vi.mock('../shared/env.js', () => mockEnv)

const prismaMocks = vi.hoisted(() => ({
  rawMessageFindMany:    vi.fn(),
  rawMessageDelete:      vi.fn(),
  signalMessageCreate:   vi.fn(),
  signalMessageFindMany: vi.fn(),
  batchHealthFindFirst:  vi.fn(),
  batchHealthCreate:     vi.fn(),
  pipelineEventCreate:   vi.fn(),
  queryRaw:              vi.fn(),
  transaction:           vi.fn(),
}))

vi.mock('../shared/db.js', () => ({
  prisma: {
    rawMessage: {
      findMany: prismaMocks.rawMessageFindMany,
      delete:   prismaMocks.rawMessageDelete,
    },
    signalMessage: {
      create:   prismaMocks.signalMessageCreate,
      findMany: prismaMocks.signalMessageFindMany,
    },
    batchHealth: {
      findFirst: prismaMocks.batchHealthFindFirst,
      create:    prismaMocks.batchHealthCreate,
    },
    pipelineEvent: {
      create: prismaMocks.pipelineEventCreate,
    },
    $queryRaw:     prismaMocks.queryRaw,
    $transaction:  prismaMocks.transaction,
  },
}))

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info:  vi.fn(),
  warn:  vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: loggerMocks,
}))

const aiMocks = vi.hoisted(() => ({
  classifyMessage: vi.fn(),
}))

vi.mock('./ai-client.js', () => ({
  classifyMessage: aiMocks.classifyMessage,
}))

import {
  aggregateIntakeMetrics,
  classifyBatch,
  classifyMessageWithRetry,
} from './batch-processor.js'

const rawMessage = {
  id:                  10,
  telegram_update_id:  1001,
  telegram_message_id: 55,
  chat_id:             BigInt(-1001234567890),
  district_id:         1,
  mahalla_id:          2,
  sender_is_bot:       false,
  sender_display_name: 'Ali Karimov',
  sender_username:     'ali',
  text:                'Suvimiz yoq',
  text_source:         'text',
  keyword_matched:     true,
  matched_keyword:     'suv',
  telegram_timestamp:  new Date('2026-06-11T01:00:00.000Z'),
  created_at:          new Date('2026-06-11T01:01:00.000Z'),
}

function signalOutput(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
  return {
    decision:      'signal',
    categories:    ['water'],
    hokim_related: false,
    short_label:   'Water outage',
    ...overrides,
  } as ClassifierOutput
}

describe('classifyBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.env.FILTER_MODE = 'keyword_gate'
    prismaMocks.rawMessageFindMany.mockResolvedValue([rawMessage])
    prismaMocks.rawMessageDelete.mockReturnValue({ operation: 'delete-raw' })
    prismaMocks.signalMessageCreate.mockResolvedValue({ id: 20, operation: 'create-signal' })
    prismaMocks.signalMessageFindMany.mockResolvedValue([])
    prismaMocks.transaction.mockImplementation(async (arg) => {
      if (typeof arg === 'function') {
        return arg({
          signalMessage: {
            findMany: prismaMocks.signalMessageFindMany,
            create:   prismaMocks.signalMessageCreate,
          },
          rawMessage: {
            delete:   prismaMocks.rawMessageDelete,
          },
        })
      }
      return [{ id: 20 }, { id: rawMessage.id }]
    })
    prismaMocks.batchHealthFindFirst.mockResolvedValue(null)
    prismaMocks.batchHealthCreate.mockResolvedValue({ id: 1 })
    prismaMocks.pipelineEventCreate.mockResolvedValue({ id: 30 })
    prismaMocks.queryRaw.mockResolvedValue([])
  })

  it('writes a signal and deletes the raw message in one transaction', async () => {
    aiMocks.classifyMessage.mockResolvedValue(signalOutput())

    const result = await classifyBatch(1)

    expect(result.status).toBe('ok')
    expect(prismaMocks.rawMessageFindMany).toHaveBeenCalledWith({
      where:   { district_id: 1 },
      orderBy: { id: 'asc' },
      take:    100,
    })
    expect(prismaMocks.signalMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        telegram_update_id:  rawMessage.telegram_update_id,
        telegram_message_id: rawMessage.telegram_message_id,
        district_id:         rawMessage.district_id,
        mahalla_id:          rawMessage.mahalla_id,
        raw_text:            rawMessage.text,
        category:            'water',
        hokim_related:       false,
        keyword_matched:     true,
        matched_keyword:     'suv',
        short_label:         'Water outage',
      }),
    })
    expect(prismaMocks.transaction).toHaveBeenCalledWith(expect.any(Function))
    expect(prismaMocks.pipelineEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type:         'classifier_signal',
        district_id:        rawMessage.district_id,
        mahalla_id:         rawMessage.mahalla_id,
        telegram_update_id: rawMessage.telegram_update_id,
        raw_message_id:     rawMessage.id,
        signal_id:          20,
        detail:             expect.objectContaining({
          decision:    'signal',
          categories:  ['water'],
          rawMessageId: rawMessage.id,
          signalId:    20,
          textSnippet: rawMessage.text,
        }),
      }),
    })
  })

  it('deletes ignored messages without writing a signal', async () => {
    aiMocks.classifyMessage.mockResolvedValue({ decision: 'ignore' })

    const result = await classifyBatch(1)

    expect(result.ignored_count).toBe(1)
    expect(prismaMocks.signalMessageCreate).not.toHaveBeenCalled()
    expect(prismaMocks.rawMessageDelete).toHaveBeenCalledWith({ where: { id: rawMessage.id } })
    expect(prismaMocks.pipelineEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type:         'classifier_ignore',
        district_id:        rawMessage.district_id,
        telegram_update_id: rawMessage.telegram_update_id,
        raw_message_id:     rawMessage.id,
        signal_id:          null,
        detail:             expect.objectContaining({
          decision:    'ignore',
          rawMessageId: rawMessage.id,
          signalId:    null,
          textSnippet: rawMessage.text,
        }),
      }),
    })
  })

  it('retries failed AI classifications before succeeding', async () => {
    aiMocks.classifyMessage
      .mockRejectedValueOnce(new Error('invalid json'))
      .mockRejectedValueOnce(new Error('invalid json'))
      .mockResolvedValue(signalOutput({ categories: ['gas'] }))

    const result = await classifyMessageWithRetry('gaz yoq', 3, () => Promise.resolve())

    expect(result).toEqual(expect.objectContaining({ decision: 'signal', categories: ['gas'] }))
    expect(aiMocks.classifyMessage).toHaveBeenCalledTimes(3)
  })

  it('leaves retry-exhausted raw messages in place and marks the batch failed', async () => {
    aiMocks.classifyMessage.mockRejectedValue(new Error('invalid output'))

    const result = await classifyBatch(1, { sleep: () => Promise.resolve() })

    expect(result.status).toBe('failed')
    expect(result.error_message).toContain('1 message(s) failed')
    expect(prismaMocks.rawMessageDelete).not.toHaveBeenCalled()
    expect(prismaMocks.pipelineEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type:     'classifier_error',
        raw_message_id: rawMessage.id,
        signal_id:      null,
        detail:         expect.objectContaining({
          decision: 'error',
          error:    expect.stringContaining('invalid output'),
        }),
      }),
    })
    expect(prismaMocks.batchHealthCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status:        'failed',
        error_message: expect.stringContaining('raw message IDs: 10'),
      }),
    })
  })

  it('keeps timed-out provider failures in raw_messages after retry exhaustion', async () => {
    aiMocks.classifyMessage.mockRejectedValue(
      new Error('Ollama classification timed out after 30000ms'),
    )

    const result = await classifyBatch(1, { sleep: () => Promise.resolve() })

    expect(result.status).toBe('failed')
    expect(result.error_message).toContain('raw message IDs: 10')
    expect(aiMocks.classifyMessage).toHaveBeenCalledTimes(3)
    expect(prismaMocks.rawMessageDelete).not.toHaveBeenCalled()
    expect(prismaMocks.signalMessageCreate).not.toHaveBeenCalled()
    expect(prismaMocks.transaction).not.toHaveBeenCalled()
    expect(loggerMocks.warn).toHaveBeenCalledTimes(2)
    expect(loggerMocks.error).toHaveBeenCalledWith(
      expect.objectContaining({
        districtId:    1,
        rawMessageId:  10,
        attempts:      3,
        err:           expect.any(Error),
      }),
      'AI classification failed after max retries; message stays in raw_messages',
    )
  })

  it('keeps schema-invalid provider failures in raw_messages after retry exhaustion', async () => {
    aiMocks.classifyMessage.mockRejectedValue(
      new Error('AI output schema invalid: signal category required'),
    )

    const result = await classifyBatch(1, { sleep: () => Promise.resolve() })

    expect(result.status).toBe('failed')
    expect(result.error_message).toContain('raw message IDs: 10')
    expect(aiMocks.classifyMessage).toHaveBeenCalledTimes(3)
    expect(prismaMocks.rawMessageDelete).not.toHaveBeenCalled()
    expect(prismaMocks.signalMessageCreate).not.toHaveBeenCalled()
    expect(prismaMocks.transaction).not.toHaveBeenCalled()
    expect(prismaMocks.batchHealthCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status:        'failed',
        error_message: expect.stringContaining('raw message IDs: 10'),
      }),
    })
  })

  it('clears raw message only when signal write hits a unique constraint', async () => {
    aiMocks.classifyMessage.mockResolvedValue(signalOutput())
    prismaMocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code:          'P2002',
        clientVersion: 'test',
      }),
    )

    const result = await classifyBatch(1)

    expect(result.status).toBe('ok')
    expect(result.signals_written).toBe(0)
    expect(prismaMocks.rawMessageDelete).toHaveBeenLastCalledWith({ where: { id: rawMessage.id } })
  })

  it('writes batch health fields at completion', async () => {
    const previousStartedAt = new Date('2026-06-10T00:00:00.000Z')
    aiMocks.classifyMessage.mockResolvedValue({ decision: 'ignore' })
    prismaMocks.batchHealthFindFirst.mockResolvedValue({ started_at: previousStartedAt })
    prismaMocks.queryRaw.mockResolvedValue([
      { event_type: 'keyword_match', count: BigInt(3) },
      { event_type: 'keyword_skip', count: BigInt(2) },
    ])

    await classifyBatch(1)

    expect(prismaMocks.batchHealthCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        district_id:                1,
        status:                     'ok',
        intake_window_from:         previousStartedAt,
        messages_fetched:           1,
        signals_written:            0,
        ignored_count:              1,
        pre_filter_discards:        0,
        filter_mode:                'keyword_gate',
        keyword_matched_count:      3,
        keyword_skipped_count:      2,
        keyword_ai_signal_count:    0,
        keyword_ai_ignore_count:    0,
        no_keyword_ai_signal_count: 0,
        no_keyword_ai_ignore_count: 0,
        error_message:              null,
      }),
    })
  })

  it('limits each run to the configured classifier batch size', async () => {
    mockEnv.env.CLASSIFIER_BATCH_SIZE = 25
    aiMocks.classifyMessage.mockResolvedValue({ decision: 'ignore' })

    await classifyBatch(1)

    expect(prismaMocks.rawMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    )
  })
})

describe('aggregateIntakeMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.queryRaw.mockResolvedValue([
      { event_type: 'keyword_match', count: BigInt(4) },
      { event_type: 'keyword_skip', count: BigInt(6) },
    ])
  })

  it('uses distinct telegram update aggregation for pipeline event metrics', async () => {
    const metrics = await aggregateIntakeMetrics({
      districtId: 1,
      from:       new Date('2026-06-10T00:00:00.000Z'),
      to:         new Date('2026-06-11T00:00:00.000Z'),
    })

    expect(metrics.keyword_matched_count).toBe(4)
    expect(metrics.keyword_skipped_count).toBe(6)

    const queryTemplate = Array.from(prismaMocks.queryRaw.mock.calls[0]?.[0] ?? []).join('')
    expect(queryTemplate).toContain('COUNT(DISTINCT telegram_update_id)')
    expect(queryTemplate).toContain('created_at <')
  })
})
