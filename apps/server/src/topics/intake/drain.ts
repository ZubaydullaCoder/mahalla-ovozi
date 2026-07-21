// apps/server/src/topics/intake/drain.ts
//
// Chronological topic drain: per-mahalla advisory lock, oldest-first ordering,
// inline abandoned-processing recovery, retry/dead-letter promotion, stub triage.
//
// Architecture §4 / §7 (Chronological Drain and Failure Isolation)
// AC4–AC12 (Story 9.3)

import { Pool } from 'pg'
import { prisma } from '../../shared/db.js'
import { env } from '../../shared/env.js'
import { logger } from '../../shared/logger.js'
import type { CapturedMessage } from '../../generated/prisma/client.js'

// ─── Lock namespace ───────────────────────────────────────────────────────────
// Must not collide with classifier's 79_102_026 or other app locks.
export const TOPIC_DRAIN_LOCK_NAMESPACE = 420_000_000

// ─── Shared pg Pool (lazy) ───────────────────────────────────────────────────
// Created on first use — avoids module-load side effects in unit tests.
// The pool is a module-level singleton once initialized.
let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: env.DATABASE_URL })
    // F3: Register idle connection pool error handler to prevent Node crash
    if (_pool && typeof _pool.on === 'function') {
      _pool.on('error', (err) => {
        logger.error(
          { ...toSafeErrorMetadata(err) },
          'Unexpected error on idle client in dedicated topic drain pg Pool',
        )
      })
    }
  }
  return _pool
}

/** F3: Clean pool shutdown path for test cleanup and graceful server exit */
export async function closeTopicDrainPool(): Promise<void> {
  if (_pool) {
    if (typeof _pool.end === 'function') {
      await _pool.end()
    }
    _pool = null
  }
}

// ─── Trigger types ───────────────────────────────────────────────────────────
// F5: Expose manual trigger type
export type TopicDrainTrigger = 'cron' | 'startup' | 'webhook' | 'manual'

// ─── Safe error types ─────────────────────────────────────────────────────────

/**
 * Allowlist-safe error metadata for log entries.
 * Never copies raw err.message, stack traces, or any string that could contain
 * resident text (per AC10, AC12).
 */
export type SafeLogMeta = {
  errorCode?:    string
  errorCategory: string
}

/**
 * Allowlist-safe error record for `last_error` field (stored as JSON string).
 * - errorCode: known structural codes (Prisma P-codes, ECONNREFUSED, etc.)
 * - errorCategory: coarse class
 * - message: sanitized to 500 chars — NEVER raw user content
 */
type SafeErrorRecord = {
  errorCode?:    string
  errorCategory: string
  message:       string
}

/**
 * Extracts only known-safe structural fields from any error.
 * Never copies err.message unless it comes from a known operational allowlist.
 * Exported so pipeline.ts and scheduler.ts can use it in their catch blocks (AC12).
 */
export function toSafeErrorMetadata(err: unknown): SafeLogMeta {
  const errObj = err as Record<string, unknown>
  const code =
    typeof errObj?.code === 'string' ? errObj.code : undefined
  const errMeta = errObj?.meta as Record<string, unknown> | undefined
  const prismaCode =
    typeof errMeta?.code === 'string' ? errMeta.code : undefined
  const errorCode = code ?? prismaCode
  const errorCategory =
    errorCode?.startsWith('P') ? 'prisma' :
    errorCode === 'ECONNREFUSED' ? 'connection' :
    'unknown'
  return { ...(errorCode ? { errorCode } : {}), errorCategory }
}

/** Build a sanitized SafeErrorRecord for storage in `last_error`. */
function buildSafeErrorRecord(err: unknown): string {
  const meta = toSafeErrorMetadata(err)
  // Safe message: only use code/category text — never err.message content
  const safeMessage = meta.errorCode
    ? `Error code: ${meta.errorCode}`
    : 'Drain processing error'
  const record: SafeErrorRecord = {
    ...(meta.errorCode ? { errorCode: meta.errorCode } : {}),
    errorCategory: meta.errorCategory,
    message: safeMessage.slice(0, 500),
  }
  return JSON.stringify(record)
}

// ─── Single-flight Coalescing State (F4) ─────────────────────────────────────
let isDraining = false
let pendingDrain = false

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point (AC4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drains the captured-message queue across all eligible mahallas.
 * Exported as the single shared entry point for all trigger sources.
 * Also exported for the Story 9.7 manual Ops trigger.
 *
 * F1: Gated by env.TOPIC_DRAIN_ENABLED (except 'manual' trigger).
 * F4: In-process single-flight coalescing prevents concurrent global drain scans.
 * AC11: Promise.allSettled results are inspected — mahalla failures are logged,
 *       not silently discarded.
 */
export async function drainTopicQueue(trigger: TopicDrainTrigger): Promise<void> {
  // F1: Gated safety boundary
  if (!env.TOPIC_DRAIN_ENABLED && trigger !== 'manual') {
    logger.info({ trigger }, 'Topic drain is disabled via TOPIC_DRAIN_ENABLED — skipping')
    return
  }

  // F4: Single-flight coalescing
  if (isDraining) {
    logger.info({ trigger }, 'Topic drain already in progress — queueing next run')
    pendingDrain = true
    return
  }

  isDraining = true
  try {
    await runDrainTopicQueue(trigger)
  } finally {
    isDraining = false
    if (pendingDrain) {
      pendingDrain = false
      logger.info('Running queued pending topic drain')
      void drainTopicQueue('webhook')
    }
  }
}

/** Core drain runner logic */
async function runDrainTopicQueue(trigger: TopicDrainTrigger): Promise<void> {
  logger.info({ trigger }, 'Topic drain started')

  const eligibleMahallas = await getEligibleMahallas()
  if (eligibleMahallas.length === 0) {
    logger.info({ trigger }, 'Topic drain: no eligible mahallas — no-op')
    return
  }

  const results = await Promise.allSettled(
    eligibleMahallas.map((id) => processOneMahalla(id)),
  )

  // AC11: Inspect allSettled results — log rejections with safe metadata
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!
    if (result.status === 'rejected') {
      logger.error(
        { ...toSafeErrorMetadata(result.reason), mahallaId: eligibleMahallas[i] },
        'Unexpected error in per-mahalla drain — escaped inner handler',
      )
    }
  }

  // F8: Fixed metric log wording from mahallasProcessed to mahallasEligible
  logger.info({ trigger, mahallasEligible: eligibleMahallas.length }, 'Topic drain finished')
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligible mahalla discovery (AC5, AC6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns IDs of mahallas that have at least one message in queued, processing,
 * or due-retry state. `processing` rows are included so abandoned messages
 * (from a crashed worker) are also discovered (AC6).
 */
export async function getEligibleMahallas(): Promise<number[]> {
  // We need mahallas with queued, processing, or retry messages.
  // For retry, we include both due and future — processOneMahalla will skip future-retry.
  const rows = await prisma.capturedMessage.findMany({
    where: {
      processing_state: { in: ['queued', 'processing', 'retry'] },
    },
    select: { mahalla_id: true },
    distinct: ['mahalla_id'],
  })
  return rows.map((r) => r.mahalla_id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-mahalla processor — dedicated pg.Client with session-scoped advisory lock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a single mahalla under a session-scoped PostgreSQL advisory lock.
 *
 * AC7: Uses a dedicated pg.Client (not prisma.$queryRaw) to guarantee
 * same-session semantics for pg_try_advisory_lock / pg_advisory_unlock.
 *
 * F3: Registers connection-specific error handlers and aborts per-mahalla
 * loop if the DB connection is lost.
 *
 * AC8: Processes oldest-first in a loop until: queue empty, retry-blocked,
 * or TOPIC_DRAIN_MAX_PER_MAHALLA cap reached.
 *
 * AC5/AC6: If oldest message is `processing`, it is guaranteed abandoned
 * (we hold the advisory lock) → recover inline → block this iteration.
 */
export async function processOneMahalla(mahallaId: number): Promise<void> {
  const client = await getPool().connect()
  let isConnectionLost = false
  const clientErrorHandler = (err: Error) => {
    isConnectionLost = true
    logger.error(
      { ...toSafeErrorMetadata(err), mahallaId },
      'Database connection error on active topic drain client',
    )
  }
  if (client && typeof client.on === 'function') {
    client.on('error', clientErrorHandler)
  }

  let unlockSucceeded = false

  try {
    const lockKey = TOPIC_DRAIN_LOCK_NAMESPACE + mahallaId
    const lockRes = await client.query<{ ok: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS ok',
      [lockKey],
    )
    if (!lockRes.rows[0]?.ok) {
      // Another drain invocation already holds the lock for this mahalla — skip silently
      unlockSucceeded = true // no lock was acquired — safe to return connection normally
      return
    }

    try {
      // Loop: process oldest-first until empty, blocked, or cap reached
      let processed = 0
      while (processed < env.TOPIC_DRAIN_MAX_PER_MAHALLA) {
        if (isConnectionLost) {
          logger.warn({ mahallaId }, 'Connection lost on advisory lock client — aborting loop')
          break
        }
        const msg = await getOldestEligibleMessage(mahallaId)
        if (!msg) break // empty, retry-blocked, or inline-recovered (all block this iteration)

        await markProcessing(msg.id)
        try {
          // Stub processing — no AI in Story 9.3. Story 9.4 replaces this.
          await triageStub(msg)

          // Atomic terminal transition: markComplete + writeDrainEvent in a single
          // short Prisma $transaction. triageStub (future AI call in 9.4) stays OUTSIDE
          // the transaction so it doesn't reintroduce the long-transaction problem. (AC9)
          await prisma.$transaction([
            markCompleteOperation(msg.id),   // PrismaPromise — does NOT execute yet
            writeDrainEventOperation(msg),   // PrismaPromise — does NOT execute yet
          ])
        } catch (err) {
          await handleDrainError(msg, err)
          break // stop this mahalla's loop on failure (chronological blocking rule)
        }
        processed++
      }
    } finally {
      // Checked unlock: pg_advisory_unlock returns boolean.
      // If unlock fails or throws, destroy the connection (uncertain state).
      try {
        if (!isConnectionLost) {
          const unlockRes = await client.query<{ ok: boolean }>(
            'SELECT pg_advisory_unlock($1::bigint) AS ok',
            [lockKey],
          )
          unlockSucceeded = unlockRes.rows[0]?.ok === true
        }
      } catch {
        // unlock threw — unlockSucceeded remains false → connection will be destroyed
      }
    }
  } finally {
    if (client && typeof client.removeListener === 'function') {
      client.removeListener('error', clientErrorHandler)
    }
    // Pass !unlockSucceeded or isConnectionLost: true = destroy the connection (uncertain unlock state).
    // Pass false = return it to the pool normally (unlock confirmed or no lock held).
    client.release(!unlockSucceeded || isConnectionLost)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue selection — oldest-first with full blocking rule (AC5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the oldest eligible message for a mahalla, or null if:
 *   - Queue is empty
 *   - Oldest is a future-retry (retry.next_retry_at > now()) → block entire mahalla
 *   - Oldest is `processing` → guaranteed abandoned (advisory lock held) → recover inline → block
 *
 * AC5: Includes `processing` rows so they act as chronological blockers.
 * AC6: Inline recovery under lock — no timeout check, no separate sweep.
 */
export async function getOldestEligibleMessage(mahallaId: number): Promise<CapturedMessage | null> {
  // Include processing rows so they block — never skip over them.
  // Caller (processOneMahalla) holds the advisory lock, so any processing row found
  // here is guaranteed abandoned (no live worker can hold the same lock concurrently).
  const oldest = await prisma.capturedMessage.findFirst({
    where: {
      mahalla_id:       mahallaId,
      processing_state: { in: ['queued', 'retry', 'processing'] },
    },
    orderBy: [{ telegram_timestamp: 'asc' }, { id: 'asc' }],
  })
  if (!oldest) return null

  // Future-retry: block the entire mahalla (AC5)
  if (
    oldest.processing_state === 'retry' &&
    oldest.next_retry_at &&
    oldest.next_retry_at > new Date()
  ) {
    return null
  }

  // Abandoned processing row: caller holds the lock → guaranteed abandoned.
  // Recover inline — block this iteration (AC5, AC6).
  if (oldest.processing_state === 'processing') {
    await inlineRecoverProcessing(oldest)
    return null
  }

  return oldest
}

// ─────────────────────────────────────────────────────────────────────────────
// Failure transition policy logic (F6 - DRY)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deduplicated failure transition policy helper (F6).
 * Increments attempt count, applies backoff, and updates state in DB.
 */
async function applyFailureTransition(
  msgId: number,
  currentAttemptCount: number,
  lastErrorJson: string,
): Promise<{ processingState: 'dead_letter' | 'retry'; attemptCount: number; nextRetryAt: Date | null }> {
  const newAttemptCount = currentAttemptCount + 1
  let processingState: 'dead_letter' | 'retry'
  let nextRetryAt: Date | null = null
  let deadLetteredAt: Date | null = null

  if (newAttemptCount >= 3) {
    processingState = 'dead_letter'
    deadLetteredAt = new Date()
  } else {
    processingState = 'retry'
    const backoffMs = Math.pow(2, newAttemptCount) * 30_000
    nextRetryAt = new Date(Date.now() + backoffMs)
  }

  await prisma.capturedMessage.update({
    where: { id: msgId },
    data: {
      processing_state: processingState,
      attempt_count:    newAttemptCount,
      last_error:       lastErrorJson,
      ...(nextRetryAt ? { next_retry_at: nextRetryAt } : {}),
      ...(deadLetteredAt ? { dead_lettered_at: deadLetteredAt } : {}),
    },
  })

  return { processingState, attemptCount: newAttemptCount, nextRetryAt }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline abandoned-processing recovery (AC5, AC6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recovers an abandoned `processing` record under advisory lock ownership.
 * Applies the same retry/dead-letter invariant as AC10 — no timeout check
 * (the advisory lock itself proves no live worker holds this mahalla).
 *
 * If recovered to retry → remains chronological blocker until next_retry_at.
 * If recovered to dead_letter → not automatically reprocessed.
 */
export async function inlineRecoverProcessing(msg: CapturedMessage): Promise<void> {
  const lastErrorJson = JSON.stringify({
    errorCategory: 'abandoned_processing',
    message: 'Inline recovery under advisory lock',
  })
  const { attemptCount } = await applyFailureTransition(msg.id, msg.attempt_count, lastErrorJson)
  logger.warn(
    { capturedMessageId: msg.id, mahallaId: msg.mahalla_id, newAttemptCount: attemptCount },
    'Inline recovery: abandoned processing record confirmed by advisory lock',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// State transition helpers
// ─────────────────────────────────────────────────────────────────────────────

async function markProcessing(id: number): Promise<void> {
  await prisma.capturedMessage.update({
    where: { id },
    data: { processing_state: 'processing' },
  })
}

/**
 * Returns a PrismaPromise (not yet executed) for atomic $transaction use.
 * AC9: markComplete and writeDrainEvent are combined in a single short $transaction.
 *
 * STUB NOTE: `complete` + null `final_disposition` is intentionally invalid
 * under Story 9.2's invariant (complete implies non-null disposition).
 * These are pre-activation throw-away records. Story 9.4 replaces the stub
 * with real triage before any production activation. Do NOT treat these
 * `complete` + null records as valid production state.
 */
export function markCompleteOperation(id: number) {
  return prisma.capturedMessage.update({
    where: { id },
    data: { processing_state: 'complete' },
  })
}

/**
 * Returns a PrismaPromise (not yet executed) for atomic $transaction use.
 * AC9: Content-free pipeline event — never includes raw text, prompt, or model response.
 *
 * telegram_update_id: PipelineEvent.telegram_update_id is Int? (32-bit signed).
 * Production Telegram update IDs always fit in Int range; guard anyway.
 */
export function writeDrainEventOperation(msg: CapturedMessage) {
  const INT32_MAX = 2_147_483_647n
  const updateId = msg.telegram_update_id
  const telegramUpdateId =
    updateId !== null && updateId <= INT32_MAX ? Number(updateId) : null

  return prisma.pipelineEvent.create({
    data: {
      event_type:         'topic_drain_complete',
      district_id:        msg.district_id,
      mahalla_id:         msg.mahalla_id,
      telegram_update_id: telegramUpdateId,
      detail: {
        capturedMessageId:    msg.id,
        processingState:      'complete',
        // Content-free: no text, no prompt, no model response (AC9, AC12)
      },
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub processing (AC9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stub triage — no AI call in Story 9.3.
 * Story 9.4 replaces this with real bounded-context retrieval and Gemma triage.
 *
 * STUB NOTE: This is a pre-activation placeholder only. The stub state
 * (complete + null final_disposition) is not valid production state.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function triageStub(_msg: CapturedMessage): Promise<void> {
  // No-op stub: Story 9.4 will replace with Ollama/Gemma model call.
  // The AI call intentionally stays OUTSIDE the $transaction to avoid
  // reintroducing the long-transaction problem (AC9 note on transaction scope).
}

// ─────────────────────────────────────────────────────────────────────────────
// Error handling — retry/dead-letter invariant (AC10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles a drain failure by promoting the message to retry or dead_letter.
 *
 * Exact invariant (AC10):
 *   newCount = attempt_count + 1
 *   newCount < 3  → retry, next_retry_at = now + (2^newCount * 30_000 ms)
 *   newCount >= 3 → dead_letter, dead_lettered_at = now
 *
 * last_error uses the allowlist schema — never raw Error/stack/user content (AC10, AC12).
 */
export async function handleDrainError(msg: CapturedMessage, err: unknown): Promise<void> {
  const safeLastError = buildSafeErrorRecord(err)
  try {
    const { processingState, attemptCount, nextRetryAt } = await applyFailureTransition(
      msg.id,
      msg.attempt_count,
      safeLastError,
    )
    if (processingState === 'dead_letter') {
      logger.warn(
        { ...toSafeErrorMetadata(err), capturedMessageId: msg.id, mahallaId: msg.mahalla_id, newAttemptCount: attemptCount },
        'Captured message dead-lettered after max attempts',
      )
    } else {
      logger.warn(
        { ...toSafeErrorMetadata(err), capturedMessageId: msg.id, mahallaId: msg.mahalla_id, newAttemptCount: attemptCount, nextRetryAt },
        'Captured message scheduled for retry',
      )
    }
  } catch (updateErr) {
    // If the state update itself fails, log safely but don't re-throw
    logger.error(
      { ...toSafeErrorMetadata(updateErr), capturedMessageId: msg.id, mahallaId: msg.mahalla_id },
      'Failed to update captured message state after drain error',
    )
  }
}
