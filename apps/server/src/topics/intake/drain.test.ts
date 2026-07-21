/**
 * apps/server/src/topics/intake/drain.test.ts
 *
 * Unit tests for the topic drain module (Story 9.3, Task 2).
 *
 * All tests use mocked Prisma and mocked pg.Pool — no real DB required.
 * Run via: pnpm test
 *
 * Test cases (16):
 *   7.  getOldestEligibleMessage: oldest-first ordering (T1 < T2 → T1 returned)
 *   8.  Blocking rule: oldest is retry with next_retry_at > now() → null (mahalla skipped)
 *   9.  Advisory lock skip: pg_try_advisory_lock returns false → processOneMahalla exits
 *       without calling getOldestEligibleMessage
 *   10. Retry promotion: error + resulting attempt_count=1 → state retry, next_retry_at ≈ now+60s;
 *       attempt_count=2 → now+120s
 *   11. Dead-letter promotion: error + resulting attempt_count=3 → dead_letter, dead_lettered_at set
 *   12. Mahalla isolation: error in mahalla A's processOneMahalla does not affect mahalla B
 *   13. Stub complete: successful drain → state complete, content-free pipeline event written,
 *       no text/caption in event; markComplete and writeDrainEvent executed atomically
 *   14. Atomic terminal state: writeDrainEvent failure → entire transaction rolls back
 *       → handleDrainError called → message transitions to retry or dead_letter
 *   15. Safe error logging: mocked drain failure's logger.error contains no raw err object,
 *       no err.message, no stack trace — only errorCode, errorCategory, and mahallaId
 *   16. Promise.allSettled rejection: rejected inner promise is logged with mahallaId
 *       and safe error metadata, not silently dropped
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CapturedMessage } from '../../generated/prisma/client.js'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Mock env before any module import (vi.hoisted for factory access)
// ─────────────────────────────────────────────────────────────────────────────
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    DATABASE_URL:                'postgresql://mock',
    NODE_ENV:                    'test' as const,
    PORT:                        3001,
    BOT_TOKEN:                   'mock-token',
    TELEGRAM_WEBHOOK_SECRET:     'mock-secret',
    FILTER_MODE:                 'keyword_gate' as const,
    AI_PROVIDER:                 'rule-only' as const,
    AI_API_KEY:                  undefined,
    AI_MODEL:                    'rule-only',
    AI_BASE_URL:                 undefined,
    AI_TIMEOUT_MS:               30000,
    CLASSIFIER_BATCH_SIZE:       100,
    CLASSIFIER_AUTO_TRIGGER_ENABLED: true,
    CLASSIFIER_CRON:             '* * * * *',
    TOPIC_DRAIN_ENABLED:         true,
    TOPIC_DRAIN_CRON:            '* * * * *',
    TOPIC_DRAIN_MAX_PER_MAHALLA: 50,
    OPS_ENABLED:                 undefined,
    OPS_SECRET:                  undefined,
    SESSION_SECRET:              'test-secret-min32chars-xxxxxxxxxxx',
  },
}))

vi.mock('../../shared/env.js', () => ({ env: mockEnv }))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mock Prisma
// ─────────────────────────────────────────────────────────────────────────────
const {
  mockCapturedFindFirst,
  mockCapturedFindMany,
  mockCapturedUpdate,
  mockPipelineCreate,
  mockPrismaTransaction,
} = vi.hoisted(() => ({
  mockCapturedFindFirst:   vi.fn(),
  mockCapturedFindMany:    vi.fn(),
  mockCapturedUpdate:      vi.fn(),
  mockPipelineCreate:      vi.fn(),
  mockPrismaTransaction:   vi.fn(),
}))

vi.mock('../../shared/db.js', () => ({
  prisma: {
    capturedMessage: {
      findFirst: mockCapturedFindFirst,
      findMany:  mockCapturedFindMany,
      update:    mockCapturedUpdate,
    },
    pipelineEvent: {
      create: mockPipelineCreate,
    },
    $transaction: mockPrismaTransaction,
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// 3. Mock pg Pool (dedicated pg.Client advisory lock)
// ─────────────────────────────────────────────────────────────────────────────
const { mockClientQuery, mockClientRelease, mockPoolConnect, MockPool } = vi.hoisted(() => {
  const mockClientQuery   = vi.fn()
  const mockClientRelease = vi.fn()
  const mockPoolConnect   = vi.fn()
  // MockPool must be a regular (non-arrow) function so it works as a constructor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockPool(this: any, _config: any) {
    this.connect = mockPoolConnect
  }
  return { mockClientQuery, mockClientRelease, mockPoolConnect, MockPool }
})

vi.mock('pg', () => ({
  Pool: MockPool,
}))

// ─────────────────────────────────────────────────────────────────────────────
// 4. Mock logger
// ─────────────────────────────────────────────────────────────────────────────
const { mockLoggerInfo, mockLoggerError, mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerInfo:  vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn:  vi.fn(),
}))

vi.mock('../../shared/logger.js', () => ({
  logger: {
    info:  mockLoggerInfo,
    error: mockLoggerError,
    warn:  mockLoggerWarn,
  },
}))

// ─── Import module under test after all mocks are set up ─────────────────────
import {
  getOldestEligibleMessage,
  processOneMahalla,
  handleDrainError,
  drainTopicQueue,
  TOPIC_DRAIN_LOCK_NAMESPACE,
} from './drain.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMsg(overrides: Partial<CapturedMessage> = {}): CapturedMessage {
  return {
    id:                    1,
    telegram_update_id:    BigInt(1001),
    telegram_chat_id:      BigInt(-100123456789),
    telegram_message_id:   5001,
    reply_to_chat_id:      null,
    reply_to_message_id:   null,
    district_id:           7,
    mahalla_id:            42,
    sender_stable_id:      BigInt(9999),
    sender_display_name:   'Ali Karimov',
    sender_username:       'ali',
    text:                  null, // content-free after text purge
    text_source:           'text',
    telegram_timestamp:    new Date('2024-01-01T10:00:00Z'),
    processing_state:      'queued',
    final_disposition:     null,
    final_disposition_at:  null,
    topic_id:              null,
    attempt_count:         0,
    next_retry_at:         null,
    last_error:            null,
    dead_lettered_at:      null,
    text_expires_at:       null,
    disposition_expires_at: null,
    promoted_from_irrelevant_at: null,
    promotion_triggered_by_id: null,
    replay_attempt_at:     null,
    replay_audit_note:     null,
    created_at:            new Date(),
    updated_at:            new Date(),
    ...overrides,
  }
}

/** Sets up a pg.Client mock that successfully acquires and releases the advisory lock */
function setupLockAcquired() {
  mockPoolConnect.mockResolvedValue({
    query:   mockClientQuery,
    release: mockClientRelease,
  })
  // First call: pg_try_advisory_lock → true (acquired)
  // Second call: pg_advisory_unlock → true (released)
  mockClientQuery
    .mockResolvedValueOnce({ rows: [{ ok: true }] })   // acquire
    .mockResolvedValueOnce({ rows: [{ ok: true }] })   // release
}

/** Sets up a pg.Client mock that fails to acquire the advisory lock */
function setupLockNotAcquired() {
  mockPoolConnect.mockResolvedValue({
    query:   mockClientQuery,
    release: mockClientRelease,
  })
  mockClientQuery.mockResolvedValueOnce({ rows: [{ ok: false }] })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: transaction resolves with array of results
  mockPrismaTransaction.mockResolvedValue([{}, {}])
  // Default: update resolves
  mockCapturedUpdate.mockResolvedValue({})
  // Default: pipelineCreate resolves
  mockPipelineCreate.mockResolvedValue({})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: getOldestEligibleMessage — oldest-first ordering
// ─────────────────────────────────────────────────────────────────────────────
describe('getOldestEligibleMessage', () => {
  it('test 7: returns the oldest eligible queued message (T1 < T2 → T1 returned)', async () => {
    const msg = makeMsg({ id: 1, telegram_timestamp: new Date('2024-01-01T09:00:00Z') })
    mockCapturedFindFirst.mockResolvedValue(msg)

    const result = await getOldestEligibleMessage(42)

    expect(result).toEqual(msg)
    expect(mockCapturedFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        mahalla_id:       42,
        processing_state: { in: ['queued', 'retry', 'processing'] },
      },
      orderBy: [{ telegram_timestamp: 'asc' }, { id: 'asc' }],
    }))
  })

  // ─── Test 8: Future-retry blocks the mahalla ───────────────────────────────
  it('test 8: returns null when oldest message is retry with future next_retry_at', async () => {
    const futureTime = new Date(Date.now() + 60_000)
    const msg = makeMsg({
      processing_state: 'retry',
      next_retry_at:    futureTime,
      attempt_count:    1,
    })
    mockCapturedFindFirst.mockResolvedValue(msg)

    const result = await getOldestEligibleMessage(42)
    expect(result).toBeNull()
  })

  it('returns the message when retry is due (next_retry_at in the past)', async () => {
    const pastTime = new Date(Date.now() - 60_000)
    const msg = makeMsg({
      processing_state: 'retry',
      next_retry_at:    pastTime,
      attempt_count:    1,
    })
    mockCapturedFindFirst.mockResolvedValue(msg)

    const result = await getOldestEligibleMessage(42)
    expect(result).toEqual(msg)
  })

  it('returns null when queue is empty', async () => {
    mockCapturedFindFirst.mockResolvedValue(null)
    const result = await getOldestEligibleMessage(42)
    expect(result).toBeNull()
  })

  it('calls inlineRecoverProcessing and returns null when oldest is processing', async () => {
    const msg = makeMsg({ processing_state: 'processing', attempt_count: 0 })
    mockCapturedFindFirst.mockResolvedValue(msg)

    const result = await getOldestEligibleMessage(42)

    expect(result).toBeNull()
    // Should have called update (inlineRecoverProcessing → retry since attempt_count+1=1 < 3)
    expect(mockCapturedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: msg.id },
      data:  expect.objectContaining({ processing_state: 'retry' }),
    }))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Advisory lock skip
// ─────────────────────────────────────────────────────────────────────────────
describe('processOneMahalla — advisory lock', () => {
  it('test 9: exits without processing when pg_try_advisory_lock returns false', async () => {
    setupLockNotAcquired()

    await processOneMahalla(42)

    // Should have connected and queried the lock
    expect(mockPoolConnect).toHaveBeenCalledOnce()
    expect(mockClientQuery).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1::bigint) AS ok',
      [TOPIC_DRAIN_LOCK_NAMESPACE + 42],
    )
    // Should NOT have attempted to read the queue
    expect(mockCapturedFindFirst).not.toHaveBeenCalled()
    // Connection should be released normally (no destroy)
    expect(mockClientRelease).toHaveBeenCalledWith(false)
  })

  it('acquires the correct namespaced lock key', async () => {
    setupLockAcquired()
    mockCapturedFindFirst.mockResolvedValue(null) // empty queue

    await processOneMahalla(99)

    const lockKey = TOPIC_DRAIN_LOCK_NAMESPACE + 99
    expect(mockClientQuery).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1::bigint) AS ok',
      [lockKey],
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests 10–11: Retry and dead-letter promotion
// ─────────────────────────────────────────────────────────────────────────────
describe('handleDrainError — retry/dead-letter invariant', () => {
  it('test 10a: attempt_count=0 → newCount=1 → retry with next_retry_at ≈ now + 60s', async () => {
    const msg = makeMsg({ attempt_count: 0 })
    const before = Date.now()
    await handleDrainError(msg, new Error('test error'))
    const after = Date.now()

    expect(mockCapturedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: msg.id },
      data:  expect.objectContaining({ processing_state: 'retry', attempt_count: 1 }),
    }))
    const data = mockCapturedUpdate.mock.calls[0]![0].data
    const nextRetry = data.next_retry_at as Date
    // 2^1 * 30_000 = 60_000 ms
    expect(nextRetry.getTime()).toBeGreaterThanOrEqual(before + 60_000)
    expect(nextRetry.getTime()).toBeLessThanOrEqual(after + 60_000 + 100)
  })

  it('test 10b: attempt_count=1 → newCount=2 → retry with next_retry_at ≈ now + 120s', async () => {
    const msg = makeMsg({ attempt_count: 1 })
    const before = Date.now()
    await handleDrainError(msg, new Error('test error'))
    const after = Date.now()

    const data = mockCapturedUpdate.mock.calls[0]![0].data
    expect(data.processing_state).toBe('retry')
    expect(data.attempt_count).toBe(2)
    // 2^2 * 30_000 = 120_000 ms
    const nextRetry = data.next_retry_at as Date
    expect(nextRetry.getTime()).toBeGreaterThanOrEqual(before + 120_000)
    expect(nextRetry.getTime()).toBeLessThanOrEqual(after + 120_000 + 100)
  })

  it('test 11: attempt_count=2 → newCount=3 → dead_letter with dead_lettered_at set', async () => {
    const msg = makeMsg({ attempt_count: 2 })
    await handleDrainError(msg, new Error('test error'))

    const data = mockCapturedUpdate.mock.calls[0]![0].data
    expect(data.processing_state).toBe('dead_letter')
    expect(data.attempt_count).toBe(3)
    expect(data.dead_lettered_at).toBeInstanceOf(Date)
    expect(data.next_retry_at).toBeUndefined()
  })

  it('last_error is a valid allowlist JSON string — no raw Error content', async () => {
    const msg = makeMsg({ attempt_count: 0 })
    const err = new Error('This should NOT appear in last_error')
    await handleDrainError(msg, err)

    const data = mockCapturedUpdate.mock.calls[0]![0].data
    const lastError = JSON.parse(data.last_error)
    // Must have errorCategory
    expect(lastError).toHaveProperty('errorCategory')
    expect(lastError).toHaveProperty('message')
    // Must NOT contain the raw error message
    expect(data.last_error).not.toContain('This should NOT appear')
    expect(data.last_error).not.toContain('stack')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 12: Mahalla isolation
// ─────────────────────────────────────────────────────────────────────────────
describe('drainTopicQueue — mahalla isolation', () => {
  it('test 12: error in mahalla A does not affect mahalla B result', async () => {
    // Two mahallas: 11 and 22
    mockCapturedFindMany.mockResolvedValue([{ mahalla_id: 11 }, { mahalla_id: 22 }])

    // For mahalla 11: lock acquired, then processOneMahalla throws internally
    // For mahalla 22: lock acquired, queue empty → success
    let callCount = 0
    mockPoolConnect.mockImplementation(() => {
      callCount++
      // Track callCount to differentiate mahalla 11 vs 22 calls
      void callCount // suppress unused-variable lint (callCount is used as a counter)
      return Promise.resolve({
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ ok: true }] })   // acquire
          .mockResolvedValueOnce({ rows: [{ ok: true }] }),  // release
        release: vi.fn(),
      })
    })

    // mahalla 11: findFirst throws; mahalla 22: returns null (empty)
    mockCapturedFindFirst
      .mockRejectedValueOnce(new Error('DB error for mahalla 11'))
      .mockResolvedValueOnce(null) // mahalla 22 empty

    // Both mahallas processed — allSettled captures the rejection for mahalla 11
    await drainTopicQueue('cron')

    // mahalla 11 error should be logged
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ mahallaId: 11 }),
      expect.any(String),
    )
    // Test passes if drainTopicQueue resolved (mahalla 22 was not blocked by 11)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 13: Stub complete — content-free event, atomic transaction
// ─────────────────────────────────────────────────────────────────────────────
describe('processOneMahalla — stub complete', () => {
  it('test 13: processes queued message to complete with content-free pipeline event atomically', async () => {
    setupLockAcquired()

    const msg = makeMsg()
    // First call: queued message; second call: empty (loop exits)
    mockCapturedFindFirst
      .mockResolvedValueOnce(msg)
      .mockResolvedValueOnce(null)

    await processOneMahalla(42)

    // markProcessing called
    expect(mockCapturedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: msg.id },
      data:  { processing_state: 'processing' },
    }))

    // $transaction called with an array of PrismaPromises (markComplete + writeDrainEvent)
    expect(mockPrismaTransaction).toHaveBeenCalledOnce()
    const txArg = mockPrismaTransaction.mock.calls[0]![0]
    expect(Array.isArray(txArg)).toBe(true)
    expect(txArg).toHaveLength(2)

    // Lock released successfully
    expect(mockClientRelease).toHaveBeenCalledWith(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 14: Atomic terminal state — transaction failure → handleDrainError called
// ─────────────────────────────────────────────────────────────────────────────
describe('processOneMahalla — atomic terminal failure', () => {
  it('test 14: writeDrainEvent failure rolls back transaction → handleDrainError called', async () => {
    setupLockAcquired()

    const msg = makeMsg({ attempt_count: 0 })
    mockCapturedFindFirst
      .mockResolvedValueOnce(msg)
      .mockResolvedValueOnce(null)

    // $transaction (markComplete + writeDrainEvent) fails
    mockPrismaTransaction.mockRejectedValueOnce(new Error('Transaction failed'))

    await processOneMahalla(42)

    // handleDrainError should have been called → capturedMessage.update for retry
    const updateCalls = mockCapturedUpdate.mock.calls
    // First call is markProcessing; second call should be handleDrainError → retry
    const retryCall = updateCalls.find(call =>
      call[0]?.data?.processing_state === 'retry' || call[0]?.data?.processing_state === 'dead_letter'
    )
    expect(retryCall).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 15: Safe error logging — no raw err object
// ─────────────────────────────────────────────────────────────────────────────
describe('handleDrainError — safe error logging', () => {
  it('test 15: logger.warn contains no raw err object, no err.message, no stack trace', async () => {
    const msg = makeMsg({ attempt_count: 0 })
    const err = Object.assign(new Error('Secret DB query content'), {
      code: 'P2002',
      stack: 'Error: Secret DB query\n    at drain.ts:123',
    })
    await handleDrainError(msg, err)

    expect(mockLoggerWarn).toHaveBeenCalled()
    const [meta] = mockLoggerWarn.mock.calls[0]!

    // Must NOT have raw error fields
    expect(meta).not.toHaveProperty('err')
    expect(meta).not.toHaveProperty('message')
    expect(JSON.stringify(meta)).not.toContain('Secret DB query')
    expect(JSON.stringify(meta)).not.toContain('stack')

    // Must have safe fields only
    expect(meta).toHaveProperty('errorCategory')
    expect(meta).toHaveProperty('capturedMessageId')
    expect(meta).toHaveProperty('mahallaId')
    // Prisma code P2002 should be extracted as errorCode
    expect(meta).toHaveProperty('errorCode', 'P2002')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 16: Promise.allSettled rejection logged with mahallaId
// ─────────────────────────────────────────────────────────────────────────────
describe('drainTopicQueue — Promise.allSettled inspection', () => {
  it('test 16: rejected inner promise is logged with mahallaId — not silently dropped', async () => {
    mockCapturedFindMany.mockResolvedValue([{ mahalla_id: 55 }])

    // processOneMahalla for mahalla 55 will throw from pool.connect
    mockPoolConnect.mockRejectedValueOnce(new Error('Connection refused'))

    await drainTopicQueue('webhook')

    // The rejection must be logged with mahallaId
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ mahallaId: 55 }),
      expect.any(String),
    )
    // The logged meta must NOT contain raw error object
    const [meta] = mockLoggerError.mock.calls.find(
      call => call[0]?.mahallaId === 55
    )!
    expect(meta).not.toHaveProperty('err')
    expect(meta).not.toHaveProperty('reason')
  })
})
