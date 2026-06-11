import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { classifyBatch } from './batch-processor.js'

let isRunning = false

export async function runClassifyBatchWithLock(trigger: 'cron' | 'manual'): Promise<void> {
  if (isRunning) {
    logger.warn({ trigger, event: 'batch_skipped_already_running' }, 'Classify batch already running; skipped')
    return
  }

  isRunning = true

  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })

    if (!district) {
      logger.warn({ trigger }, 'No active district found; classify batch skipped')
      return
    }

    await classifyBatch(district.id)
  } finally {
    isRunning = false
  }
}

export { purgeOldSignals } from './purge.js'
