import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { classifyBatch } from './batch-processor.js'

let isRunning = false
const CLASSIFIER_BATCH_LOCK_KEY = 79_102_026

export async function runClassifyBatchWithLock(trigger: 'cron' | 'manual'): Promise<void> {
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

    await classifyBatch(district.id)
  } finally {
    if (dbLockAcquired) {
      await releaseBatchLock()
    }
    isRunning = false
  }
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
