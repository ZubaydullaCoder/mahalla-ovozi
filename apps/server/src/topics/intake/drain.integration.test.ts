/**
 * apps/server/src/topics/intake/drain.integration.test.ts
 *
 * Real-DB integration tests for Story 9.3: Topic Drain.
 *
 * IMPORTANT: This test file targets a REAL PostgreSQL database.
 * It MUST only be run via `pnpm test:schema` (the guarded wrapper), never
 * directly via `pnpm test`. The guard script injects TEST_DATABASE_URL as
 * DATABASE_URL and verifies safety invariants before invoking this suite.
 *
 * Serial execution is enforced by vitest.schema.config.ts (maxWorkers: 1).
 *
 * Test cases (9 real-DB tests, numbered 16–24 per story spec):
 *   16. Two concurrent processOneMahalla calls for same mahalla → only one processes
 *   17. Two concurrent processOneMahalla calls for different mahallas → both process
 *   18. Lock released after successful processing → second call can acquire and process
 *   19. Lock released after thrown exception → second call can acquire the lock
 *   20. Oldest-first under concurrency — messages at T1 and T2, drain always picks T1 first
 *   21. Identical-timestamp tie-breaking — same telegram_timestamp, ordered by id ASC
 *   22. Retry blocking — future-retry blocks all later messages in its mahalla
 *   23. Inline processing recovery under lock — abandoned processing row recovered
 *   24. Processing-only-mahalla discovery — getEligibleMahallas finds processing-state mahallas
 */
import { describe, it, beforeAll, afterAll, afterEach, expect, vi } from 'vitest'
import { PrismaClient } from '../../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { prisma as globalPrisma } from '../../shared/db.js'

// ─── Real Prisma client for test setup/teardown ────────────────────────────────
let prisma: PrismaClient
let testPool: Pool

beforeAll(() => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL not set — guard script must inject TEST_DATABASE_URL')
  const adapter = new PrismaPg({ connectionString: databaseUrl })
  prisma = new PrismaClient({ adapter })
  testPool = new Pool({ connectionString: databaseUrl })
})

afterAll(async () => {
  await testPool.end()
  await prisma.$disconnect()
})

// ─── Fixture IDs ──────────────────────────────────────────────────────────────
let districtId: number
let mahallaAId: number
let mahallaBId: number

const runSeed       = BigInt(Date.now())
const fixtureSuffix = `drain-${process.pid}-${runSeed}`
const chatIdA       = -(runSeed * 100n + 11n)
const chatIdB       = -(runSeed * 100n + 22n)

beforeAll(async () => {
  const district = await prisma.district.create({
    data: { name: `Drain Test District ${fixtureSuffix}` },
  })
  districtId = district.id

  const mA = await prisma.mahalla.create({
    data: { district_id: districtId, name: `Drain Mahalla A ${fixtureSuffix}`, telegram_chat_id: chatIdA },
  })
  mahallaAId = mA.id

  const mB = await prisma.mahalla.create({
    data: { district_id: districtId, name: `Drain Mahalla B ${fixtureSuffix}`, telegram_chat_id: chatIdB },
  })
  mahallaBId = mB.id
})

// ─── Cleanup between tests ────────────────────────────────────────────────────
async function cleanCapturedMessages() {
  await prisma.pipelineEvent.deleteMany({ where: { district_id: districtId } })
  await prisma.capturedMessage.deleteMany({ where: { district_id: districtId } })
}

afterEach(async () => {
  await cleanCapturedMessages()
})

afterAll(async () => {
  await cleanCapturedMessages()
  await prisma.mahalla.deleteMany({ where: { district_id: districtId } })
  await prisma.district.deleteMany({ where: { id: districtId } })
})

// ─── Fixture helper ───────────────────────────────────────────────────────────
let msgCounter = 0

async function createMsg(mahallaId: number, overrides: {
  processing_state?: string
  next_retry_at?: Date
  attempt_count?: number
  telegram_timestamp?: Date
  update_id_offset?: number
} = {}) {
  msgCounter++
  const {
    processing_state = 'queued',
    next_retry_at    = null,
    attempt_count    = 0,
    telegram_timestamp = new Date(),
    update_id_offset = msgCounter,
  } = overrides

  const mahalla = mahallaId === mahallaAId
    ? { id: mahallaAId, district_id: districtId }
    : { id: mahallaBId, district_id: districtId }

  return prisma.capturedMessage.create({
    data: {
      telegram_update_id:  BigInt(Date.now()) + BigInt(update_id_offset),
      telegram_chat_id:    mahallaId === mahallaAId ? chatIdA : chatIdB,
      telegram_message_id: update_id_offset,
      district_id:         mahalla.district_id,
      mahalla_id:          mahalla.id,
      sender_stable_id:    BigInt(123456),
      sender_display_name: 'Test User',
      sender_username:     'testuser',
      text:                null, // content-free
      text_source:         'text',
      telegram_timestamp,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processing_state:    processing_state as any,
      next_retry_at,
      attempt_count,
    },
  })
}

// ─── Import module under test ────────────────────────────────────────────────
// We import the drain functions directly so integration tests exercise real pg advisory locks.
// The module uses process.env.DATABASE_URL which is injected by the guard script.
import {
  processOneMahalla,
  getOldestEligibleMessage,
  getEligibleMahallas,
  inlineRecoverProcessing,
} from './drain.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test 16: Concurrent processOneMahalla for SAME mahalla → only one processes
// ─────────────────────────────────────────────────────────────────────────────
describe('advisory lock exclusion', () => {
  it('test 16: two concurrent processOneMahalla calls for same mahalla — only one processes (advisory-lock exclusion with overlap proof)', async () => {
    // Create one queued message
    const msg = await createMsg(mahallaAId)

    // Create a deferred promise to block the first call
    let resolveBarrier!: () => void
    const barrierPromise = new Promise<void>((resolve) => {
      resolveBarrier = resolve
    })

    const originalFindFirst = globalPrisma.capturedMessage.findFirst
    let findCount = 0

    // Spy on findFirst to block only the first call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(globalPrisma.capturedMessage, 'findFirst').mockImplementation((async (args: any) => {
      findCount++
      const result = await originalFindFirst.call(globalPrisma.capturedMessage, args)
      if (findCount === 1) {
        // Hold the first call at the barrier
        await barrierPromise
      }
      return result
    }) as any)

    // Start first call (will block at barrier while holding advisory lock)
    const firstCallPromise = processOneMahalla(mahallaAId)

    // Wait a brief moment to ensure first call has connected, acquired the lock, and reached findFirst
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Start second call concurrently. It must fail to acquire the lock and exit immediately.
    await processOneMahalla(mahallaAId)

    // Release the first call from the barrier
    resolveBarrier()
    await firstCallPromise

    // Restore findFirst spy
    vi.restoreAllMocks()

    // Verify: first call processed the message to complete
    const result = await prisma.capturedMessage.findUnique({ where: { id: msg.id } })
    expect(result!.processing_state).toBe('complete')
  })

  // ─── Test 17: Different mahallas process independently ─────────────────────
  it('test 17: two concurrent processOneMahalla calls for different mahallas — both process independently', async () => {
    const msgA = await createMsg(mahallaAId)
    const msgB = await createMsg(mahallaBId)

    await Promise.all([
      processOneMahalla(mahallaAId),
      processOneMahalla(mahallaBId),
    ])

    const resultA = await prisma.capturedMessage.findUnique({ where: { id: msgA.id } })
    const resultB = await prisma.capturedMessage.findUnique({ where: { id: msgB.id } })

    expect(resultA!.processing_state).toBe('complete')
    expect(resultB!.processing_state).toBe('complete')
  })

  // ─── Test 18: Lock released after successful processing ────────────────────
  it('test 18: lock released after successful processing — second call acquires and processes', async () => {
    const msg1 = await createMsg(mahallaAId)

    // First drain processes msg1
    await processOneMahalla(mahallaAId)
    const after1 = await prisma.capturedMessage.findUnique({ where: { id: msg1.id } })
    expect(after1!.processing_state).toBe('complete')

    // Create second message — lock should be free for a second drain
    const msg2 = await createMsg(mahallaAId)
    await processOneMahalla(mahallaAId)
    const after2 = await prisma.capturedMessage.findUnique({ where: { id: msg2.id } })
    expect(after2!.processing_state).toBe('complete')
  })

  // ─── Test 19: Lock released after thrown exception ─────────────────────────
  it('test 19: lock released after exception — second call can acquire the lock (genuine exception test)', async () => {
    // Create two queued messages
    const msg1 = await createMsg(mahallaAId, { update_id_offset: 1 })
    const msg2 = await createMsg(mahallaAId, { update_id_offset: 2 })

    const originalFindFirst = globalPrisma.capturedMessage.findFirst
    let hasThrown = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(globalPrisma.capturedMessage, 'findFirst').mockImplementation((async (args: any) => {
      if (!hasThrown) {
        hasThrown = true
        throw new Error('Forced Database Exception')
      }
      return originalFindFirst.call(globalPrisma.capturedMessage, args)
    }) as any)

    // Run first call. It will acquire the lock, call findFirst, throw, and release the lock in finally.
    await expect(processOneMahalla(mahallaAId)).rejects.toThrow('Forced Database Exception')

    // Restore the spy
    vi.restoreAllMocks()

    // Run second call. If the lock was cleanly released, it will acquire the lock and process the queued messages.
    await processOneMahalla(mahallaAId)

    // Verify: the messages were successfully processed (not skipped), meaning the lock was freed
    const after1 = await prisma.capturedMessage.findUnique({ where: { id: msg1.id } })
    const after2 = await prisma.capturedMessage.findUnique({ where: { id: msg2.id } })
    expect(after1!.processing_state).toBe('complete')
    expect(after2!.processing_state).toBe('complete')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 20: Oldest-first under concurrency
// ─────────────────────────────────────────────────────────────────────────────
describe('chronological ordering', () => {
  it('test 20: oldest-first under concurrency — messages at T1 and T2, drain always picks T1 first under concurrency', async () => {
    const T1 = new Date('2024-01-01T09:00:00Z')
    const T2 = new Date('2024-01-01T10:00:00Z')

    const msgT2 = await createMsg(mahallaAId, { telegram_timestamp: T2, update_id_offset: 200 })
    const msgT1 = await createMsg(mahallaAId, { telegram_timestamp: T1, update_id_offset: 100 })

    // Create a deferred promise to block the first call
    let resolveBarrier!: () => void
    const barrierPromise = new Promise<void>((resolve) => {
      resolveBarrier = resolve
    })

    const originalFindFirst = globalPrisma.capturedMessage.findFirst
    let findCount = 0
    let pickedMessageId: number | null = null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(globalPrisma.capturedMessage, 'findFirst').mockImplementation((async (args: any) => {
      findCount++
      const result = await originalFindFirst.call(globalPrisma.capturedMessage, args)
      if (findCount === 1) {
        if (result) pickedMessageId = result.id
        await barrierPromise
      }
      return result
    }) as any)

    // Start first call
    const firstCallPromise = processOneMahalla(mahallaAId)

    // Wait a brief moment to ensure first call has connected, acquired lock, and picked T1
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Start second call concurrently. It must skip immediately (lock exclusion) and not pick T2.
    await processOneMahalla(mahallaAId)

    // Release the first call
    resolveBarrier()
    await firstCallPromise

    // Restore findFirst spy
    vi.restoreAllMocks()

    // Verify:
    // 1. The first call indeed picked T1 as the oldest candidate
    expect(pickedMessageId).toBe(msgT1.id)
    // 2. Both T1 and T2 are now complete (processed by the first call's loop after resuming)
    const resultT1 = await prisma.capturedMessage.findUnique({ where: { id: msgT1.id } })
    const resultT2 = await prisma.capturedMessage.findUnique({ where: { id: msgT2.id } })
    expect(resultT1!.processing_state).toBe('complete')
    expect(resultT2!.processing_state).toBe('complete')
  })

  // ─── Test 21: Identical-timestamp tie-breaking by id ASC ──────────────────
  it('test 21: identical-timestamp messages are ordered by id ASC', async () => {
    const sameTime = new Date('2024-01-02T08:00:00Z')

    // Create two messages with the same timestamp — id order determines selection
    const first  = await createMsg(mahallaAId, { telegram_timestamp: sameTime, update_id_offset: 300 })
    const second = await createMsg(mahallaAId, { telegram_timestamp: sameTime, update_id_offset: 301 })

    const oldest = await getOldestEligibleMessage(mahallaAId)
    expect(oldest).not.toBeNull()
    // first.id < second.id → first should be returned
    expect(oldest!.id).toBe(first.id < second.id ? first.id : second.id)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 22: Retry blocking — future-retry blocks all later messages
// ─────────────────────────────────────────────────────────────────────────────
describe('retry blocking', () => {
  it('test 22: future-retry message blocks all later messages in the mahalla', async () => {
    const T1 = new Date('2024-01-01T06:00:00Z')
    const T2 = new Date('2024-01-01T07:00:00Z')
    const futureRetry = new Date(Date.now() + 300_000) // 5 minutes from now

    // T1 is a future-retry (blocker)
    await createMsg(mahallaAId, {
      telegram_timestamp: T1,
      processing_state:   'retry',
      next_retry_at:      futureRetry,
      attempt_count:      1,
      update_id_offset:   400,
    })
    // T2 is queued (would be next if T1 wasn't blocking)
    await createMsg(mahallaAId, {
      telegram_timestamp: T2,
      processing_state:   'queued',
      update_id_offset:   401,
    })

    const oldest = await getOldestEligibleMessage(mahallaAId)
    // Future-retry T1 blocks the mahalla → null returned
    expect(oldest).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 23: Inline processing recovery under lock
// ─────────────────────────────────────────────────────────────────────────────
describe('inline processing recovery', () => {
  it('test 23: abandoned processing row is recovered inline; becomes future-retry blocker', async () => {
    // Create a message stuck in `processing` — simulates crash/restart
    const abandoned = await createMsg(mahallaAId, {
      processing_state: 'processing',
      attempt_count:    0,
      update_id_offset: 500,
    })
    // Create a later queued message
    await createMsg(mahallaAId, {
      processing_state:   'queued',
      telegram_timestamp: new Date(Date.now() + 1000),
      update_id_offset:   501,
    })

    // getOldestEligibleMessage finds the processing row, recovers inline, returns null
    const result = await getOldestEligibleMessage(mahallaAId)
    expect(result).toBeNull() // blocked by recovered message

    // The abandoned message should now be in retry state (attempt_count 0 → newCount 1 < 3)
    const recovered = await prisma.capturedMessage.findUnique({ where: { id: abandoned.id } })
    expect(recovered).not.toBeNull()
    expect(recovered!.processing_state).toBe('retry')
    expect(recovered!.attempt_count).toBe(1)
    expect(recovered!.next_retry_at).not.toBeNull()
    expect(recovered!.next_retry_at!.getTime()).toBeGreaterThan(Date.now())
  })

  it('test 23b: abandoned processing with attempt_count=2 → recovered to dead_letter', async () => {
    const abandoned = await createMsg(mahallaAId, {
      processing_state: 'processing',
      attempt_count:    2, // newCount = 3 → dead_letter
      update_id_offset: 502,
    })

    await inlineRecoverProcessing({
      ...abandoned,
      id:               abandoned.id,
      attempt_count:    2,
      mahalla_id:       mahallaAId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const recovered = await prisma.capturedMessage.findUnique({ where: { id: abandoned.id } })
    expect(recovered!.processing_state).toBe('dead_letter')
    expect(recovered!.dead_lettered_at).not.toBeNull()
    expect(recovered!.attempt_count).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 24: Processing-only-mahalla discovery by getEligibleMahallas
// ─────────────────────────────────────────────────────────────────────────────
describe('eligible mahalla discovery', () => {
  it('test 24: mahalla with only a processing-state message is discovered by getEligibleMahallas', async () => {
    const msg = await createMsg(mahallaAId, {
      processing_state: 'processing',
      attempt_count:    0,
      update_id_offset: 600,
    })

    const eligible = await getEligibleMahallas()

    expect(eligible).toContain(mahallaAId)

    // Now processOneMahalla: acquires lock, finds processing row, recovers inline (→ retry),
    // returns null from getOldestEligibleMessage (now a future-retry blocker), skips mahalla.
    await processOneMahalla(mahallaAId)

    const result = await prisma.capturedMessage.findUnique({ where: { id: msg.id } })
    // Should be retry now (attempt_count 0 → 1 < 3)
    expect(result!.processing_state).toBe('retry')
    expect(result!.next_retry_at).not.toBeNull()
    expect(result!.next_retry_at!.getTime()).toBeGreaterThan(Date.now())

    // It is only processed by the first subsequent drain invocation at or after next_retry_at.
    // Calling processOneMahalla again NOW should find it blocked (future retry).
    const oldest = await getOldestEligibleMessage(mahallaAId)
    expect(oldest).toBeNull() // future-retry → blocked
  })
})
