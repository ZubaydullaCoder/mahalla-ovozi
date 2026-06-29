import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { classifyBatch } from './batch-processor.js'

let isRunning = false
const CLASSIFIER_BATCH_LOCK_KEY = 79_102_026
const MAX_DRAIN_BATCHES = 50

export type ClassifierDrainTrigger = 'cron' | 'manual' | 'webhook' | 'startup'

export async function triggerClassifierDrain(trigger: ClassifierDrainTrigger): Promise<void> {
  if (isRunning) {
    logger.warn({ trigger, event: 'batch_skipped_already_running' }, 'Classify batch already running; skipped')
    return
  }

  isRunning = true
  let dbLockAcquired = false

  try {
    dbLockAcquired = await tryAcquireBatchLock()
    if (!dbLockAcquired) {
      logger.warn({ trigger, event: 'batch_skipped_db_lock' }, 'Classify batch already running in another process; skipped')
      return
    }

    const district = await prisma.district.findFirst({ where: { is_active: true } })

    if (!district) {
      logger.warn({ trigger }, 'No active district found; classify batch skipped')
      return
    }

    for (let batchesProcessed = 0; batchesProcessed < MAX_DRAIN_BATCHES; batchesProcessed += 1) {
      const result = await classifyBatch(district.id)
      const completedBatches = batchesProcessed + 1

      if (result.status === 'failed') {
        logger.warn(
          {
            trigger,
            event: 'drain_stopped_after_failed_batch',
            batchesProcessed: completedBatches,
            messagesFetched: result.messages_fetched,
            errorMessage: result.error_message,
          },
          'Classifier drain stopped after failed batch; raw messages remain retryable',
        )
        return
      }

      if (result.messages_fetched === 0) {
        logger.info(
          { trigger, event: 'drain_complete', batchesProcessed: completedBatches },
          'Classifier drain complete',
        )
        return
      }
    }

    logger.warn(
      { trigger, event: 'drain_cap_reached', batchesProcessed: MAX_DRAIN_BATCHES },
      'Classifier drain stopped at batch cap; remaining raw messages are deferred to the next trigger',
    )
  } finally {
    if (dbLockAcquired) {
      try {
        await releaseBatchLock()
      } catch (err) {
        logger.error({ err }, 'Failed to release classifier batch lock')
      }
    }
    isRunning = false
  }
}

/**
 * @deprecated Use triggerClassifierDrain() instead. Kept for compatibility with existing callers.
 */
export async function runClassifyBatchWithLock(trigger: 'cron' | 'manual'): Promise<void> {
  await triggerClassifierDrain(trigger)
}

export function isBatchRunning(): boolean {
  return isRunning
}

export { purgeOldSignals } from './purge.js'

async function tryAcquireBatchLock(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${CLASSIFIER_BATCH_LOCK_KEY}) AS locked
  `

  return rows[0]?.locked === true
}

async function releaseBatchLock(): Promise<void> {
  await prisma.$executeRaw`
    SELECT pg_advisory_unlock(${CLASSIFIER_BATCH_LOCK_KEY})
  `
}
