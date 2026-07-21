/**
 * apps/server/src/bot/capturedMessage.test.ts
 *
 * Unit tests for persistCapturedMessage (Story 9.3, Task 1).
 *
 * All tests use mocked Prisma — no real DB required.
 * Run via: pnpm test
 *
 * Test cases (6):
 *   1. All required fields mapped correctly for a standard message
 *   2. Filter-passing message calls persist (upsert called once)
 *   3. Duplicate telegram_update_id — upsert update: {} (idempotent no-op)
 *   4. Reply metadata: both null when no reply; both non-null when reply exists; never mixed
 *   5. sender_display_name truncated to 300 chars; sender_username truncated to 100 chars
 *   6. Content-free assertion: no text/caption in any logger call during persist
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Update } from 'grammy/types'
import type { Mahalla } from '../generated/prisma/client.js'

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma client
// ─────────────────────────────────────────────────────────────────────────────
const { mockCapturedUpsert } = vi.hoisted(() => ({
  mockCapturedUpsert: vi.fn(),
}))

vi.mock('../shared/db.js', () => ({
  prisma: {
    capturedMessage: { upsert: mockCapturedUpsert },
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// Mock logger — allows us to assert no text content is logged
// ─────────────────────────────────────────────────────────────────────────────
const { mockLoggerInfo, mockLoggerError, mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerInfo:  vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn:  vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: {
    info:  mockLoggerInfo,
    error: mockLoggerError,
    warn:  mockLoggerWarn,
  },
}))

import { persistCapturedMessage } from './capturedMessage.js'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mahalla: Mahalla = {
  id:               42,
  district_id:      7,
  name:             'Test Mahalla',
  telegram_chat_id: BigInt(-100123456789),
  bot_status:       'active',
  bot_last_seen_at: null,
  created_at:       new Date('2024-01-01'),
}

function makeUpdate(overrides: Partial<{
  update_id: number
  text: string | undefined
  caption: string | undefined
  message_id: number
  date: number
  from_id: number
  first_name: string
  last_name: string | undefined
  username: string | undefined
  reply: { chat_id: number; message_id: number } | undefined
}>= {}): Update {
  const {
    update_id    = 1001,
    message_id   = 5001,
    date         = 1700000000,
    from_id      = 9999,
    first_name   = 'Ali',
    last_name    = 'Karimov',
    username     = 'alikarimov',
    reply        = undefined,
  } = overrides
  // Use 'in' check to distinguish explicit undefined from not-provided defaults
  const text    = 'text'    in overrides ? overrides.text    : 'Hello mahalla'
  const caption = 'caption' in overrides ? overrides.caption : undefined

  return {
    update_id,
    message: {
      message_id,
      date,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chat: { id: -100123456789, type: 'supergroup' } as any,
      from: {
        id:         from_id,
        is_bot:     false,
        first_name,
        last_name,
        username,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      text,
      caption,
      reply_to_message: reply
        ? {
            message_id: reply.message_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chat: { id: reply.chat_id } as any,
            date,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        : undefined,
    },
  } as Update
}

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCapturedUpsert.mockResolvedValue({} as any)
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: All required fields mapped correctly for a standard message
// ─────────────────────────────────────────────────────────────────────────────
describe('persistCapturedMessage', () => {
  it('test 1: maps all required fields for a standard text message', async () => {
    const update = makeUpdate({
      update_id:   1001,
      text:        'Suv muammosi bor',
      message_id:  5001,
      date:        1700000000,
      from_id:     9999,
      first_name:  'Ali',
      last_name:   'Karimov',
      username:    'alikarimov',
    })

    await persistCapturedMessage(update, mahalla)

    expect(mockCapturedUpsert).toHaveBeenCalledOnce()
    const call = mockCapturedUpsert.mock.calls[0]![0]

    expect(call.where).toEqual({ telegram_update_id: BigInt(1001) })
    expect(call.update).toEqual({})

    const create = call.create
    expect(create.telegram_update_id).toEqual(BigInt(1001))
    expect(create.telegram_chat_id).toEqual(BigInt(-100123456789))
    expect(create.telegram_message_id).toBe(5001)
    expect(create.district_id).toBe(7)
    expect(create.mahalla_id).toBe(42)
    expect(create.sender_stable_id).toEqual(BigInt(9999))
    expect(create.sender_display_name).toBe('Ali Karimov')
    expect(create.sender_username).toBe('alikarimov')
    expect(create.text).toBe('Suv muammosi bor')
    expect(create.text_source).toBe('text')
    expect(create.telegram_timestamp).toEqual(new Date(1700000000 * 1000))
    expect(create.processing_state).toBe('queued')
    expect(create.reply_to_chat_id).toBeNull()
    expect(create.reply_to_message_id).toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Filter-passing message calls persist (upsert called once)
  // ─────────────────────────────────────────────────────────────────────────
  it('test 2: calls upsert exactly once for a filter-passing message', async () => {
    await persistCapturedMessage(makeUpdate(), mahalla)
    expect(mockCapturedUpsert).toHaveBeenCalledOnce()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Duplicate telegram_update_id → upsert update:{} (no-op)
  // ─────────────────────────────────────────────────────────────────────────
  it('test 3: uses update:{} for idempotent duplicate handling', async () => {
    await persistCapturedMessage(makeUpdate({ update_id: 2222 }), mahalla)
    const call = mockCapturedUpsert.mock.calls[0]![0]
    // The update field must be an empty object — no fields updated on conflict
    expect(call.update).toEqual({})
    expect(Object.keys(call.update)).toHaveLength(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Reply metadata pair: both-null or both-non-null; never mixed
  // ─────────────────────────────────────────────────────────────────────────
  it('test 4a: reply_to_chat_id and reply_to_message_id are both null when no reply', async () => {
    await persistCapturedMessage(makeUpdate({ reply: undefined }), mahalla)
    const create = mockCapturedUpsert.mock.calls[0]![0].create
    expect(create.reply_to_chat_id).toBeNull()
    expect(create.reply_to_message_id).toBeNull()
  })

  it('test 4b: reply_to_chat_id and reply_to_message_id are both non-null when reply exists', async () => {
    const update = makeUpdate({ reply: { chat_id: -100987654321, message_id: 444 } })
    await persistCapturedMessage(update, mahalla)
    const create = mockCapturedUpsert.mock.calls[0]![0].create
    expect(create.reply_to_chat_id).toEqual(BigInt(-100987654321))
    expect(create.reply_to_message_id).toBe(444)
    // Guarantee: both must be non-null (never mixed)
    expect(create.reply_to_chat_id).not.toBeNull()
    expect(create.reply_to_message_id).not.toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Truncation of sender_display_name (300) and sender_username (100)
  // ─────────────────────────────────────────────────────────────────────────
  it('test 5: truncates sender_display_name to 300 chars and sender_username to 100 chars', async () => {
    const longName     = 'A'.repeat(400)
    const longUsername = 'u'.repeat(200)
    const update = makeUpdate({ first_name: longName, last_name: undefined, username: longUsername })
    await persistCapturedMessage(update, mahalla)
    const create = mockCapturedUpsert.mock.calls[0]![0].create
    expect(create.sender_display_name).toHaveLength(300)
    expect(create.sender_username).toHaveLength(100)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Content-free — no text/caption in any logger call during persist
  // ─────────────────────────────────────────────────────────────────────────
  it('test 6: no text or caption field appears in any logger call', async () => {
    const update = makeUpdate({ text: 'Sensitive content here', caption: undefined })
    await persistCapturedMessage(update, mahalla)

    const allLogCalls = [
      ...mockLoggerInfo.mock.calls,
      ...mockLoggerError.mock.calls,
      ...mockLoggerWarn.mock.calls,
    ]
    for (const [meta] of allLogCalls) {
      if (meta && typeof meta === 'object') {
        expect(meta).not.toHaveProperty('text')
        expect(meta).not.toHaveProperty('caption')
        expect(meta).not.toHaveProperty('rawText')
      }
    }
    // Also: persistCapturedMessage itself doesn't call logger at all (no logs on success)
    expect(mockLoggerInfo).not.toHaveBeenCalled()
    expect(mockLoggerError).not.toHaveBeenCalled()
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test: caption as text_source when message.text is undefined
  // ─────────────────────────────────────────────────────────────────────────
  it('maps text_source as "caption" and uses caption as text when message has only caption', async () => {
    const update = makeUpdate({ text: undefined, caption: 'Photo caption text' })
    await persistCapturedMessage(update, mahalla)
    const create = mockCapturedUpsert.mock.calls[0]![0].create
    expect(create.text_source).toBe('caption')
    expect(create.text).toBe('Photo caption text')
  })
})
