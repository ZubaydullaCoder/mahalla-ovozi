import cron from 'node-cron'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import { purgeOldSignals, triggerClassifierDrain } from '../classifier/index.js'

export function registerScheduler(): void {
  cron.schedule(env.CLASSIFIER_CRON, () => {
    void triggerClassifierDrain('cron').catch((err: unknown) => {
      logger.error({ err }, 'Unhandled error in classifier drain cron')
    })
  })

  cron.schedule('0 3 * * *', () => {
    void purgeOldSignals().catch((err: unknown) => {
      logger.error({ err }, 'Unhandled error in retention purge cron')
    })
  }, {
    timezone: 'UTC',
  })
}

export function triggerStartupDrain(): void {
  void triggerClassifierDrain('startup').catch((err: unknown) => {
    logger.error({ err }, 'Startup classifier drain trigger failed')
  })
}
