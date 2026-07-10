import { prisma } from '../shared/db.js'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import { writeBatchHealth, type BatchStatus } from './batch-health.js'
import { writeClassifierEvent } from './events.js'
import { aggregateIntakeMetrics, zeroIntakeMetrics } from './intake-metrics.js'
import { persistSignals } from './persist-signals.js'
import { classifyMessageWithRetry } from './retry.js'
import { generateSignalSummary } from './summary-generator.js'

export { aggregateIntakeMetrics } from './intake-metrics.js'
export { classifyMessageWithRetry } from './retry.js'

export type BatchResult = {
  status: BatchStatus
  messages_fetched: number
  signals_written: number
  ignored_count: number
  error_message: string | null
}

type ClassifyBatchOptions = {
  sleep?: (ms: number) => Promise<void>
}

export async function classifyBatch(
  districtId: number,
  options: ClassifyBatchOptions = {},
): Promise<BatchResult> {
  const startedAt = new Date()
  const sleepFn = options.sleep ?? sleep
  let messagesFetched = 0
  let signalsWritten = 0
  let ignoredCount = 0
  let intakeWindowFrom: Date | null = null
  const intakeWindowTo = startedAt
  let intakeMetrics = zeroIntakeMetrics

  logger.info({ districtId }, 'Classify batch started')

  try {
    const previousBatch = await prisma.batchHealth.findFirst({
      where:   { district_id: districtId, completed_at: { not: null } },
      orderBy: { started_at: 'desc' },
    })

    intakeWindowFrom = previousBatch?.started_at ?? null
    intakeMetrics = await aggregateIntakeMetrics({
      districtId,
      from: intakeWindowFrom ?? new Date(0),
      to:   intakeWindowTo,
    })

    const now = new Date()
    const rawMessages = await prisma.rawMessage.findMany({
      where: {
        district_id: districtId,
        dead_lettered_at: null,
        OR: [
          { next_retry_at: null },
          { next_retry_at: { lte: now } },
        ],
      },
      orderBy: { id: 'asc' },
      take:    env.CLASSIFIER_BATCH_SIZE,
    })

    messagesFetched = rawMessages.length
    const failedRawMessageIds: number[] = []

    for (const rawMessage of rawMessages) {
      try {
        const aiResult = await classifyMessageWithRetry(rawMessage.text, 3, sleepFn)

        if (aiResult.decision === 'signal') {
          // Generate AI summary (best-effort — never blocks signal write)
          let aiSummary: string | null = null
          try {
            aiSummary = await generateSignalSummary(
              rawMessage.text,
              rawMessage.sender_display_name ?? rawMessage.sender_username ?? null,
              aiResult.categories.join(', '),
            )
          } catch (err) {
            logger.warn(
              { rawMessageId: rawMessage.id, err },
              'Summary generation unexpected error; using null',
            )
          }

          const persistResult = await persistSignals(rawMessage, aiResult, aiResult.categories, aiSummary)
          signalsWritten += persistResult.signalsWritten

          await writeClassifierEvent({
            eventType: 'classifier_signal',
            rawMessage,
            signalId:  persistResult.lastSignalId,
            detail:    {
              decision:       'signal',
              categories:     aiResult.categories,
              signalsWritten: persistResult.signalsWritten,
              hokimRelated:   aiResult.hokim_related ?? false,
              classifyReason: aiResult.classify_reason ?? null,
            },
          })
        } else {
          await prisma.rawMessage.delete({ where: { id: rawMessage.id } })
          ignoredCount += 1
          await writeClassifierEvent({
            eventType: 'classifier_ignore',
            rawMessage,
            signalId:  null,
            detail:    {
              decision:       'ignore',
              classifyReason: aiResult.classify_reason ?? null,
            },
          })
        }
      } catch (err) {
        failedRawMessageIds.push(rawMessage.id)
        const errorMsg = getErrorMessage(err)
        await writeClassifierEvent({
          eventType: 'classifier_error',
          rawMessage,
          signalId:  null,
          detail:    {
            decision: 'error',
            error:    errorMsg,
          },
        })

        const nextAttempts = (rawMessage.attempt_count ?? 0) + 1
        const now = new Date()

        if (nextAttempts >= 5) {
          // Dead lettered
          await prisma.rawMessage.update({
            where: { id: rawMessage.id },
            data: {
              attempt_count: nextAttempts,
              last_error: errorMsg,
              last_attempted_at: now,
              next_retry_at: null,
              dead_lettered_at: now,
            },
          })
          logger.error(
            { districtId, rawMessageId: rawMessage.id, attempts: nextAttempts, err },
            'AI classification failed and reached max attempts; message is dead-lettered',
          )
        } else {
          // Schedule next retry (linear backoff: attempt_count * 5 minutes)
          const nextRetryAt = new Date(now.getTime() + nextAttempts * 5 * 60 * 1000)
          await prisma.rawMessage.update({
            where: { id: rawMessage.id },
            data: {
              attempt_count: nextAttempts,
              last_error: errorMsg,
              last_attempted_at: now,
              next_retry_at: nextRetryAt,
            },
          })
          logger.error(
            { districtId, rawMessageId: rawMessage.id, attempts: nextAttempts, err },
            `AI classification failed; scheduled next retry at ${nextRetryAt.toISOString()}`,
          )
        }
      }
    }

    const status: BatchStatus = failedRawMessageIds.length === 0 ? 'ok' : 'failed'
    const errorMessage = failedRawMessageIds.length === 0
      ? null
      : `${failedRawMessageIds.length} message(s) failed after retries; raw message IDs: ${failedRawMessageIds.join(', ')}`

    await writeBatchHealth({
      districtId,
      status,
      startedAt,
      completedAt: new Date(),
      intakeWindowFrom,
      intakeWindowTo,
      messagesFetched,
      signalsWritten,
      ignoredCount,
      intakeMetrics,
      errorMessage,
    })

    logger.info(
      { districtId, status, messagesFetched, signalsWritten, ignoredCount },
      'Classify batch complete',
    )

    return {
      status,
      messages_fetched: messagesFetched,
      signals_written:  signalsWritten,
      ignored_count:    ignoredCount,
      error_message:    errorMessage,
    }
  } catch (err) {
    const errorMessage = getErrorMessage(err)

    logger.error({ districtId, err }, 'Classify batch failed')

    try {
      await writeBatchHealth({
        districtId,
        status: 'failed',
        startedAt,
        completedAt: new Date(),
        intakeWindowFrom,
        intakeWindowTo,
        messagesFetched,
        signalsWritten,
        ignoredCount,
        intakeMetrics,
        errorMessage,
      })
    } catch (healthErr) {
      logger.error(
        { districtId, healthErr },
        'writeBatchHealth also failed in error path — batch health record not written',
      )
    }

    return {
      status:           'failed',
      messages_fetched: messagesFetched,
      signals_written:  signalsWritten,
      ignored_count:    ignoredCount,
      error_message:    errorMessage,
    }
  }
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown batch failure'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
