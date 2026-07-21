/**
 * pipeline.test.ts
 * Pre-filter pipeline unit tests — Story 1.2 (Tasks 1-8) + Story 1.4 (Task 5)
 *
 * Tests: F0 (missing sender), F1 (bot), F2 (no text/caption), F3 (trivial),
 *        idempotent upsert (AC-6), secret-token rejection (AC-7),
 *        edited_message discard (Task 8.4),
 *        keyword-gate routing (AC #1, #6) — Story 1.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Update } from 'grammy/types'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Mock env before any module under test is imported.
//    Use vi.hoisted() so mockEnv is accessible inside the vi.mock factory
//    (vi.mock calls are hoisted to the top of the file by vitest).
// ─────────────────────────────────────────────────────────────────────────────
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    DATABASE_URL:            'postgresql://mock',
    NODE_ENV:                'test',
    PORT:                    3001,
    BOT_TOKEN:               'mock-bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'mock-secret',
    FILTER_MODE:             'keyword_gate' as const,
    AI_API_KEY:              'test-key',
    AI_MODEL:                'gemini-2.5-flash',
    CLASSIFIER_AUTO_TRIGGER_ENABLED: true,
  },
}))

vi.mock('../../shared/env.js', () => ({ env: mockEnv }))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mock Prisma client — use vi.hoisted() so refs work inside the factory
// ─────────────────────────────────────────────────────────────────────────────
const { mockFindUnique, mockUpsert, mockFindMany, mockPipelineCreate, mockCapturedUpsert } = vi.hoisted(() => ({
  mockFindUnique:     vi.fn(),
  mockUpsert:         vi.fn(),
  mockFindMany:       vi.fn(), // keyword.findMany — Story 1.4
  mockPipelineCreate: vi.fn(), // pipelineEvent.create — Story 1.4
  mockCapturedUpsert: vi.fn().mockResolvedValue(undefined), // Story 9.3: capturedMessage.upsert
}))

vi.mock('../../shared/db.js', () => ({
  prisma: {
    mahalla:         { findUnique: mockFindUnique },
    rawMessage:      { upsert:     mockUpsert     },
    keyword:         { findMany:   mockFindMany   }, // Story 1.4
    pipelineEvent:   { create:     mockPipelineCreate }, // Story 1.4
    capturedMessage: { upsert:     mockCapturedUpsert }, // Story 9.3
  },
}))


// ─────────────────────────────────────────────────────────────────────────────
// 3. Mock logger (silence output during tests)
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}))

const mockTriggerClassifierDrain = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../../classifier/index.js', () => ({
  triggerClassifierDrain: mockTriggerClassifierDrain,
}))

// Story 9.3: Mock topic drain to prevent pg Pool creation in unit tests.
// Pipeline tests are not testing drain behavior — only that drain is triggered.
const mockDrainTopicQueue = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../../topics/intake/drain.js', () => ({
  drainTopicQueue:      mockDrainTopicQueue,
  toSafeErrorMetadata:  (err: unknown) => ({ errorCategory: 'unknown', ...(typeof (err as Record<string, unknown>)?.code === 'string' ? { errorCode: (err as Record<string, unknown>).code } : {}) }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// 4. Import filter predicates after mocks are set up
// ─────────────────────────────────────────────────────────────────────────────
import {
  hasMissingSender,
  isBot,
  hasNoText,
  isTrivialContent,
  pipeline,
} from './pipeline.js'
import { handleEditedMessage } from '../index.js'
import { logger } from '../../shared/logger.js'


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeUpdate(overrides: Partial<Update['message']> = {}, updateId = 1): Update {
  return {
    update_id: updateId,
    message: {
      message_id: 42,
      date:        1700000000,
      chat:        { id: -1001234567890, type: 'supergroup' },
      from: {
        id:         999,
        is_bot:     false,
        first_name: 'Alisher',
        last_name:  'Karimov',
        username:   'alisher',
      },
      text: 'Hello world',
      ...overrides,
    } as Update['message'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// F0 — hasMissingSender
// ─────────────────────────────────────────────────────────────────────────────
describe('hasMissingSender (F0)', () => {
  it('returns true when from is undefined', () => {
    const update = makeUpdate({ from: undefined })
    expect(hasMissingSender(update)).toBe(true)
  })

  it('returns false when from is present', () => {
    const update = makeUpdate()
    expect(hasMissingSender(update)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F1 — isBot
// ─────────────────────────────────────────────────────────────────────────────
describe('isBot (F1)', () => {
  it('returns true when from.is_bot is true', () => {
    const update = makeUpdate({ from: { id: 1, is_bot: true, first_name: 'Bot' } })
    expect(isBot(update)).toBe(true)
  })

  it('returns false when from.is_bot is false', () => {
    const update = makeUpdate({ from: { id: 2, is_bot: false, first_name: 'Human' } })
    expect(isBot(update)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F2 — hasNoText
// ─────────────────────────────────────────────────────────────────────────────
describe('hasNoText (F2)', () => {
  it('returns true when both text and caption are undefined', () => {
    const update = makeUpdate({ text: undefined, caption: undefined })
    expect(hasNoText(update)).toBe(true)
  })

  it('returns false when text is present', () => {
    const update = makeUpdate({ text: 'hello', caption: undefined })
    expect(hasNoText(update)).toBe(false)
  })

  it('returns false when caption is present', () => {
    const update = makeUpdate({ text: undefined, caption: 'photo desc' })
    expect(hasNoText(update)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F3 — isTrivialContent
// ─────────────────────────────────────────────────────────────────────────────
describe('isTrivialContent (F3)', () => {
  it('discards bot command starting with /', () => {
    expect(isTrivialContent('/start')).toBe(true)
  })

  it('discards pure emoji', () => {
    expect(isTrivialContent('😀😂🎉')).toBe(true)
  })

  it('passes emoji with text (mixed)', () => {
    expect(isTrivialContent('😀 suv bor')).toBe(false)
  })

  it('discards empty-after-trim string', () => {
    expect(isTrivialContent('   ')).toBe(true)
  })

  it('discards empty string', () => {
    expect(isTrivialContent('')).toBe(true)
  })

  // Short civic text edge cases — MUST pass (no length threshold)
  it('passes short civic text "gaz?"', () => {
    expect(isTrivialContent('gaz?')).toBe(false)
  })

  it('passes short civic text "suv?"', () => {
    expect(isTrivialContent('suv?')).toBe(false)
  })

  it('passes short civic text "tok?"', () => {
    expect(isTrivialContent('tok?')).toBe(false)
  })

  it('passes single punctuation "?"', () => {
    // '?' is not a \w char, not pure emoji, not empty, not '/' prefix —
    // the regex /^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u will
    // NOT match '?' because '?' is not in those Unicode categories.
    // So '?' should PASS (not discarded).
    expect(isTrivialContent('?')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Idempotent upsert — AC-6
// ─────────────────────────────────────────────────────────────────────────────
describe('Idempotent upsert (AC-6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockFindUnique.mockResolvedValue({
      id:          1,
      district_id: 10,
      name:        'Yunusobod-1',
      telegram_chat_id: BigInt(-1001234567890),
    })
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockFindMany.mockResolvedValue([
      SUV_KEYWORD,
      { ...SUV_KEYWORD, id: 2, phrase: 'tok' },
    ])
    mockPipelineCreate.mockResolvedValue({})
  })

  it('calls upsert with update:{} so duplicate update_id is a no-op', async () => {
    const update = makeUpdate({ text: 'suv kelyaptimi' }, 1001)

    await pipeline(update)
    await pipeline(update) // second call — same update_id

    // upsert must be called twice with update: {} each time
    expect(mockUpsert).toHaveBeenCalledTimes(2)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    )
  })

  it('does not throw on duplicate update_id', async () => {
    const update = makeUpdate({ text: 'tok bor?' }, 1002)
    mockUpsert.mockResolvedValue({ id: 101 })

    await expect(pipeline(update)).resolves.not.toThrow()
    await expect(pipeline(update)).resolves.not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Secret token rejection — AC-7
// ─────────────────────────────────────────────────────────────────────────────
// The route pre-validates X-Telegram-Bot-Api-Secret-Token before grammY receives
// the request. This prevents invalid cold-start requests from initializing the
// bot before returning HTTP 401.
// ─────────────────────────────────────────────────────────────────────────────
describe('Secret token rejection (AC-7)', () => {
  async function makeApp() {
    const express = (await import('express')).default
    const { default: request } = await import('supertest')
    const { default: webhookRouter } = await import('../webhook.js')
    const { bot } = await import('../index.js')

    const app = express()
    app.use(webhookRouter)

    const initSpy = vi.spyOn(bot, 'init').mockResolvedValue(undefined)
    const handleUpdateSpy = vi.spyOn(bot, 'handleUpdate').mockResolvedValue(undefined)

    return { app, request, initSpy, handleUpdateSpy }
  }

  it('returns 401 for missing X-Telegram-Bot-Api-Secret-Token', async () => {
    const { app, request, initSpy, handleUpdateSpy } = await makeApp()
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send({ update_id: 1 })
      // No X-Telegram-Bot-Api-Secret-Token header provided

    expect(res.status).toBe(401)
    expect(initSpy).not.toHaveBeenCalled()
    expect(handleUpdateSpy).not.toHaveBeenCalled()
  })

  it('returns 401 for wrong X-Telegram-Bot-Api-Secret-Token', async () => {
    const { app, request, initSpy, handleUpdateSpy } = await makeApp()
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Telegram-Bot-Api-Secret-Token', 'wrong-secret')
      .send({ update_id: 1 })

    expect(res.status).toBe(401)
    expect(initSpy).not.toHaveBeenCalled()
    expect(handleUpdateSpy).not.toHaveBeenCalled()
  })

  it('dispatches to grammY for correct X-Telegram-Bot-Api-Secret-Token', async () => {
    const { app, request, initSpy, handleUpdateSpy } = await makeApp()
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Telegram-Bot-Api-Secret-Token', 'mock-secret')
      .send({ update_id: 1 })

    expect(res.status).toBe(200)
    expect(initSpy).toHaveBeenCalledOnce()
    expect(handleUpdateSpy).toHaveBeenCalledOnce()
  })

  it('accepts valid long Telegram text payloads under the webhook parser limit', async () => {
    const { app, request } = await makeApp()
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Telegram-Bot-Api-Secret-Token', 'mock-secret')
      .send(makeUpdate({ text: '😀'.repeat(4096) }, 4096))

    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edited message handler — Task 8.4 (P-4: non-tautological — calls actual handler)
// Tests the exported handleEditedMessage from bot/index.ts, NOT an inline call.
// ─────────────────────────────────────────────────────────────────────────────
describe('Edited message handler (bot/index.ts)', () => {
  it('logs info and does not call pipeline when edited_message arrives', () => {
    vi.clearAllMocks()

    const editedUpdate = {
      update_id:       2001,
      edited_message: {
        message_id: 100,
        date:       1700000000,
        edit_date:  1700001000,
        chat: { id: -1001234567890, type: 'supergroup' },
        from: { id: 999, is_bot: false, first_name: 'Alisher' },
        text: 'edited text',
      },
    }

    // Call the actual exported handler — not an inline mock
    handleEditedMessage({ update: editedUpdate })

    // logger.info is the vi.fn() injected by the vi.mock('../../shared/logger.js')
    // factory at the top of this file. handleEditedMessage calls it internally.
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ updateId: 2001 }),
      'Pre-filter discard: edited_message ignored',
    )
    // pipeline/upsert must NOT have been called
    expect(mockPipelineCreate).not.toHaveBeenCalled()
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline integration — unmonitored group discard
// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline — unmonitored group', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockFindUnique.mockResolvedValue(null) // no mahalla match
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockFindMany.mockResolvedValue([])
    mockPipelineCreate.mockResolvedValue({})
  })

  it('discards message when mahalla not found for chat_id', async () => {
    const update = makeUpdate({ text: 'suv kelyaptimi' }, 2002)
    await pipeline(update)
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline integration — caption capture (AC-2)
// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline — caption capture (AC-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockFindUnique.mockResolvedValue({ id: 1, district_id: 10, name: 'Yunusobod-1' })
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockFindMany.mockResolvedValue([{ ...SUV_KEYWORD, phrase: 'text' }])
    mockPipelineCreate.mockResolvedValue({})
  })

  it('saves caption with text_source=caption when text is absent', async () => {
    const update = makeUpdate({ text: undefined, caption: 'photo caption text' }, 3001)
    await pipeline(update)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          text:        'photo caption text',
          text_source: 'caption',
        }),
      }),
    )
  })

  it('saves text with text_source=text when text is present', async () => {
    const update = makeUpdate({ text: 'plain text message', caption: undefined }, 3002)
    await pipeline(update)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          text:        'plain text message',
          text_source: 'text',
        }),
      }),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline integration — captured message persistence and filters (Story 9.3 F2.4)
// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline — captured message persistence and filters (Story 9.3 F2.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockFindUnique.mockResolvedValue({ id: 1, district_id: 10, name: 'Yunusobod-1' })
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockPipelineCreate.mockResolvedValue({})
    mockCapturedUpsert.mockResolvedValue({})
    mockFindMany.mockResolvedValue([SUV_KEYWORD])
  })

  it('F0 fail: does not persist to CapturedMessage when sender is missing', async () => {
    const update = makeUpdate({ from: undefined })
    await pipeline(update)
    expect(mockCapturedUpsert).not.toHaveBeenCalled()
  })

  it('F1 fail: does not persist to CapturedMessage when sender is a bot', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = makeUpdate({ from: { id: 2, is_bot: true, first_name: 'Bot' } as any })
    await pipeline(update)
    expect(mockCapturedUpsert).not.toHaveBeenCalled()
  })

  it('F2 fail: does not persist to CapturedMessage when message has neither text nor caption', async () => {
    const update = makeUpdate({ text: undefined, caption: undefined })
    await pipeline(update)
    expect(mockCapturedUpsert).not.toHaveBeenCalled()
  })

  it('F3 fail: does not persist to CapturedMessage when message content is trivial', async () => {
    const update = makeUpdate({ text: '/start' })
    await pipeline(update)
    expect(mockCapturedUpsert).not.toHaveBeenCalled()
  })

  it('F0-F3 pass & keyword match: persists to CapturedMessage AND rawMessage', async () => {
    const update = makeUpdate({ text: 'suv kelyapti' })
    await pipeline(update)
    expect(mockCapturedUpsert).toHaveBeenCalledOnce()
    expect(mockUpsert).toHaveBeenCalledOnce()
  })

  it('F0-F3 pass & no keyword match: persists to CapturedMessage BUT NOT rawMessage', async () => {
    const update = makeUpdate({ text: 'keyword non-matching but valid' })
    await pipeline(update)
    expect(mockCapturedUpsert).toHaveBeenCalledOnce()
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Story 1.4 — keyword-gate routing tests (AC #1, #6)
// ─────────────────────────────────────────────────────────────────────────────

/** Standard mahalla fixture — includes name field needed by pipeline event detail */
const MAHALLA = { id: 1, district_id: 10, name: 'Yunusobod-1' }

/** Keyword that matches the default test message text 'suv kelyapti' */
const SUV_KEYWORD = { id: 1, district_id: 10, phrase: 'suv', is_active: true }

describe('pipeline — keyword_gate mode (Story 1.4 AC #1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockEnv.CLASSIFIER_AUTO_TRIGGER_ENABLED = true
    mockFindUnique.mockResolvedValue(MAHALLA)
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockPipelineCreate.mockResolvedValue({})
  })

  it('5.4 — keyword_gate with keyword match: message written + keyword_match event with raw_message_id set', async () => {
    mockFindMany.mockResolvedValue([SUV_KEYWORD])
    const update = makeUpdate({ text: 'suv kelyapti' }, 5001)

    await pipeline(update)

    expect(mockUpsert).toHaveBeenCalledOnce()
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          keyword_matched: true,
          matched_keyword: 'suv',
        }),
      }),
    )
    expect(mockPipelineCreate).toHaveBeenCalledOnce()
    expect(mockPipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type:     'keyword_match',
          raw_message_id: 100,
          detail:         expect.objectContaining({
            filterMode:     'keyword_gate',
            keywordMatched: true,
            matchedPhrase:  'suv',
          }),
        }),
      }),
    )
    expect(mockTriggerClassifierDrain).toHaveBeenCalledWith('webhook')
  })

  it('5.5 — keyword_gate without keyword match: message NOT written + keyword_skip event with raw_message_id:null', async () => {
    mockFindMany.mockResolvedValue([SUV_KEYWORD])
    const update = makeUpdate({ text: 'gaz yo\'q' }, 5002) // no 'suv' → no match

    await pipeline(update)

    // Message must NOT be written
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockTriggerClassifierDrain).not.toHaveBeenCalled()

    // keyword_skip event must be written with raw_message_id: null
    expect(mockPipelineCreate).toHaveBeenCalledOnce()
    expect(mockPipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type:     'keyword_skip',
          raw_message_id: null,
          detail:         expect.objectContaining({
            filterMode:     'keyword_gate',
            keywordMatched: false,
            reason:         'No keyword match in keyword_gate mode',
          }),
        }),
      }),
    )
  })

  it('5.8b — keyword_gate with whitespace-padded phrase still matches', async () => {
    mockFindMany.mockResolvedValue([{ ...SUV_KEYWORD, phrase: '  suv  ' }])
    const update = makeUpdate({ text: 'suv kelyapti' }, 5003)

    await pipeline(update)

    expect(mockUpsert).toHaveBeenCalledOnce()
    expect(mockPipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event_type: 'keyword_match' }),
      }),
    )
  })

  it('triggers no classifier drain when webhook auto trigger is disabled', async () => {
    mockEnv.CLASSIFIER_AUTO_TRIGGER_ENABLED = false
    mockFindMany.mockResolvedValue([SUV_KEYWORD])
    const update = makeUpdate({ text: 'suv kelyapti' }, 5004)

    await pipeline(update)

    expect(mockUpsert).toHaveBeenCalledOnce()
    expect(mockTriggerClassifierDrain).not.toHaveBeenCalled()
  })

  it('does not fail pipeline when webhook drain trigger rejects', async () => {
    const err = new Error('drain trigger failed')
    mockTriggerClassifierDrain.mockRejectedValueOnce(err)
    mockFindMany.mockResolvedValue([SUV_KEYWORD])
    const update = makeUpdate({ text: 'suv kelyapti' }, 5005)

    await expect(pipeline(update)).resolves.not.toThrow()

    expect(logger.error).toHaveBeenCalledWith(
      { updateId: 5005, rawMessageId: 100, err },
      'Webhook classifier drain trigger failed',
    )
  })
})

describe('pipeline — districtId sourced from mahalla, never request body (AC #5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockEnv.CLASSIFIER_AUTO_TRIGGER_ENABLED = true
    mockFindUnique.mockResolvedValue(MAHALLA)
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockFindMany.mockResolvedValue([SUV_KEYWORD])
    mockPipelineCreate.mockResolvedValue({})
  })

  it('calls getActiveKeywords using mahalla.district_id, not update body data', async () => {
    const update = makeUpdate({ text: 'suv bor' }, 7001)
    await pipeline(update)

    // keyword.findMany must be called with district_id from MAHALLA (10), not from update body
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ district_id: MAHALLA.district_id }),
      }),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CR Patch tests — error handling and DRY (CR Pass 2, 2026-06-10)
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline — getActiveKeywords DB error: fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockEnv.CLASSIFIER_AUTO_TRIGGER_ENABLED = true
    mockFindUnique.mockResolvedValue(MAHALLA)
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockPipelineCreate.mockResolvedValue({})
  })

  it('does not throw when getActiveKeywords rejects and does not write raw message', async () => {
    mockFindMany.mockRejectedValue(new Error('DB connection error'))
    const update = makeUpdate({ text: 'suv bor' }, 8001)

    await expect(pipeline(update)).resolves.not.toThrow()
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockTriggerClassifierDrain).not.toHaveBeenCalled()
  })

  it('records keyword_skip event on DB error with keyword lookup failure detail', async () => {
    mockFindMany.mockRejectedValue(new Error('DB connection error'))
    const update = makeUpdate({ text: 'suv bor' }, 8002)

    await pipeline(update)

    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockPipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type:     'keyword_skip',
          raw_message_id: null,
          detail: expect.objectContaining({
            filterMode:          'keyword_gate',
            keywordLookupFailed: true,
            reason:              'Keyword lookup failed; message not written in keyword_gate mode',
          }),
        }),
      }),
    )
  })
})

describe('pipeline — pipelineEvent.create DB error: does not crash pipeline (CR Patch P2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.FILTER_MODE = 'keyword_gate'
    mockEnv.CLASSIFIER_AUTO_TRIGGER_ENABLED = true
    mockFindUnique.mockResolvedValue(MAHALLA)
    mockUpsert.mockResolvedValue({ id: 100 })
    mockTriggerClassifierDrain.mockResolvedValue(undefined)
    mockFindMany.mockResolvedValue([SUV_KEYWORD])
  })

  it('does not throw when pipelineEvent.create rejects — raw_message already written', async () => {
    mockPipelineCreate.mockRejectedValue(new Error('pipelineEvent insert failed'))
    const update = makeUpdate({ text: 'suv bor' }, 9001)

    // Must not throw even though pipelineEvent.create failed
    await expect(pipeline(update)).resolves.not.toThrow()
  })

  it('raw_message upsert still called when pipelineEvent.create rejects', async () => {
    mockPipelineCreate.mockRejectedValue(new Error('pipelineEvent insert failed'))
    const update = makeUpdate({ text: 'suv bor' }, 9002)

    await pipeline(update)

    // Message was written — only the observability event failed
    expect(mockUpsert).toHaveBeenCalledOnce()
  })
})
