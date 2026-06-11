import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

export async function purgeOldSignals(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const result = await prisma.signalMessage.deleteMany({
      where: { created_at: { lt: cutoff } },
    })

    logger.info({ deleted: result.count, event: 'retention_purge' }, 'Signal retention purge complete')
  } catch (err) {
    logger.error({ err, event: 'retention_purge_error' }, 'Signal retention purge failed')
    throw err
  }
}
