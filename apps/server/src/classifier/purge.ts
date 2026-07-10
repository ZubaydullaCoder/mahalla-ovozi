import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

const DAY_MS = 24 * 60 * 60 * 1000
const RAW_MESSAGE_RETENTION_DAYS = 30
const DEAD_LETTER_RETENTION_DAYS = 7
const SIGNAL_RETENTION_DAYS = 90
const PIPELINE_EVENT_RETENTION_DAYS = 14
const BATCH_HEALTH_RETENTION_DAYS = 60

export async function purgeOldSignals(): Promise<void> {
  try {
    const now = Date.now()
    const rawMessageCutoff = new Date(now - RAW_MESSAGE_RETENTION_DAYS * DAY_MS)
    const deadLetterCutoff = new Date(now - DEAD_LETTER_RETENTION_DAYS * DAY_MS)
    const signalCutoff = new Date(now - SIGNAL_RETENTION_DAYS * DAY_MS)
    const pipelineEventCutoff = new Date(now - PIPELINE_EVENT_RETENTION_DAYS * DAY_MS)
    const batchHealthCutoff = new Date(now - BATCH_HEALTH_RETENTION_DAYS * DAY_MS)

    const [deadLetters, rawMessages, signals, pipelineEvents, batchHealth] = await Promise.all([
      prisma.rawMessage.deleteMany({
        where: {
          dead_lettered_at: {
            not: null,
            lt:  deadLetterCutoff,
          },
        },
      }),
      prisma.rawMessage.deleteMany({
        where: {
          dead_lettered_at: null,
          created_at:      { lt: rawMessageCutoff },
        },
      }),
      prisma.signalMessage.deleteMany({
        where: { telegram_timestamp: { lt: signalCutoff } },
      }),
      prisma.pipelineEvent.deleteMany({
        where: { created_at: { lt: pipelineEventCutoff } },
      }),
      prisma.batchHealth.deleteMany({
        where: { started_at: { lt: batchHealthCutoff } },
      }),
    ])

    logger.info({
      deletedDeadLetters:    deadLetters.count,
      deletedRawMessages:    rawMessages.count,
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
