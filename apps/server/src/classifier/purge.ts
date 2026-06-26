import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export async function purgeOldSignals(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_MS)
    const [signals, pipelineEvents, batchHealth] = await Promise.all([
      prisma.signalMessage.deleteMany({
        where: { created_at: { lt: cutoff } },
      }),
      prisma.pipelineEvent.deleteMany({
        where: { created_at: { lt: cutoff } },
      }),
      prisma.batchHealth.deleteMany({
        where: { started_at: { lt: cutoff } },
      }),
    ])

    logger.info({
      deletedSignals:        signals.count,
      deletedPipelineEvents: pipelineEvents.count,
      deletedBatchHealth:    batchHealth.count,
      event:                 'retention_purge',
    }, 'Retention purge complete')
  } catch (err) {
    logger.error({ err, event: 'retention_purge_error' }, 'Signal retention purge failed')
    throw err
  }
}
