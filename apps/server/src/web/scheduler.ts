import cron from 'node-cron'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import { purgeOldSignals, triggerClassifierDrain } from '../classifier/index.js'
import { drainTopicQueue, toSafeErrorMetadata } from '../topics/intake/drain.js'

// Re-export for Story 9.7 manual Ops trigger — wiring the Ops route is out of scope here.
// This story's DoD requires only that the export exists with the correct signature.
export type { TopicDrainTrigger } from '../topics/intake/drain.js'

export function registerScheduler(): void {
  // Existing: classifier cron — unchanged
  cron.schedule(env.CLASSIFIER_CRON, () => {
    void triggerClassifierDrain('cron').catch((err: unknown) => {
      logger.error({ ...toSafeErrorMetadata(err) }, 'Unhandled error in classifier drain cron')
    })
  })

  // Existing: retention purge cron — unchanged
  cron.schedule('0 3 * * *', () => {
    void purgeOldSignals().catch((err: unknown) => {
      logger.error({ ...toSafeErrorMetadata(err) }, 'Unhandled error in retention purge cron')
    })
  }, {
    timezone: 'UTC',
  })

  // NEW (AC4): Topic drain cron — fires on every TOPIC_DRAIN_CRON tick.
  // Uses toSafeErrorMetadata in error handler — never raw { err } (AC12).
  cron.schedule(env.TOPIC_DRAIN_CRON, () => {
    void triggerTopicDrain('cron').catch((err: unknown) => {
      logger.error({ ...toSafeErrorMetadata(err) }, 'Unhandled error in topic drain cron')
    })
  })
}

export function triggerStartupDrain(): void {
  // Existing: classifier startup drain — unchanged
  void triggerClassifierDrain('startup').catch((err: unknown) => {
    logger.error({ ...toSafeErrorMetadata(err) }, 'Startup classifier drain trigger failed')
  })

  // NEW (AC4, AC6): Topic startup drain.
  // Inline recovery runs automatically when processing mahallas are discovered by
  // getEligibleMahallas() → processOneMahalla() → getOldestEligibleMessage().
  // No separate recoverAbandonedProcessing() — the lock-safe inline path handles it.
  void triggerTopicDrain('startup').catch((err: unknown) => {
    logger.error({ ...toSafeErrorMetadata(err) }, 'Topic startup drain failed')
  })
}

/**
 * Exported entry point for topic drain — allows scheduler, webhook, and
 * future Story 9.7 Ops manual trigger to share the same drain function.
 * AC4: All three trigger sources call drainTopicQueue directly.
 */
export function triggerTopicDrain(trigger: 'cron' | 'startup' | 'webhook'): Promise<void> {
  return drainTopicQueue(trigger)
}
