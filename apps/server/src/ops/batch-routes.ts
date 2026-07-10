import type { IRouter } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { isBatchRunning, triggerClassifierDrain } from '../classifier/index.js'
import { getActiveDistrict } from './route-helpers.js'

export function registerBatchRoutes(router: IRouter): void {
  router.get('/batch-status', async (_req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) {
        return res.status(503).json({ error: 'No active district' })
      }

      const [latestBatch, recentErrorBatches, queueDepth] = await Promise.all([
        prisma.batchHealth.findFirst({
          where: { district_id: district.id, completed_at: { not: null } },
          orderBy: { completed_at: 'desc' },
          select: {
            completed_at:               true,
            started_at:                 true,
            filter_mode:                true,
            messages_fetched:           true,
            signals_written:            true,
            ignored_count:              true,
            pre_filter_discards:        true,
            keyword_matched_count:      true,
            keyword_skipped_count:      true,
            keyword_ai_signal_count:    true,
            keyword_ai_ignore_count:    true,
            no_keyword_ai_signal_count: true,
            no_keyword_ai_ignore_count: true,
            error_message:              true,
          },
        }),
        prisma.batchHealth.findMany({
          where: {
            district_id:   district.id,
            completed_at:  { not: null },
            error_message: { not: null },
          },
          orderBy: { completed_at: 'desc' },
          take:    10,
          select:  { error_message: true, completed_at: true },
        }),
        prisma.rawMessage.count({
          where: {
            district_id:      district.id,
            dead_lettered_at: null,
          },
        }),
      ])

      const lastBatchAt = latestBatch?.completed_at?.toISOString() ?? null
      const lastBatchDuration =
        latestBatch?.completed_at != null && latestBatch?.started_at != null
          ? latestBatch.completed_at.getTime() - latestBatch.started_at.getTime()
          : null

      const lastBatchResult = latestBatch
        ? {
            filterMode:               latestBatch.filter_mode,
            messagesFetched:          latestBatch.messages_fetched,
            signalsWritten:           latestBatch.signals_written,
            ignoredCount:             latestBatch.ignored_count,
            preFilterDiscards:        latestBatch.pre_filter_discards,
            keywordMatchedCount:      latestBatch.keyword_matched_count,
            keywordSkippedCount:      latestBatch.keyword_skipped_count,
            keywordAiSignalCount:     latestBatch.keyword_ai_signal_count,
            keywordAiIgnoreCount:     latestBatch.keyword_ai_ignore_count,
            noKeywordAiSignalCount:   latestBatch.no_keyword_ai_signal_count,
            noKeywordAiIgnoreCount:   latestBatch.no_keyword_ai_ignore_count,
            errors:                   latestBatch.error_message ?? null,
          }
        : null

      const recentErrors = recentErrorBatches.flatMap(batch => {
        if (batch.completed_at === null) return []
        return [{
          message:    batch.error_message ?? 'Unknown error',
          occurredAt: batch.completed_at.toISOString(),
        }]
      })

      return res.json({
        schedulerStatus: isBatchRunning() ? 'running' : 'idle',
        lastBatchAt,
        lastBatchDuration,
        queueDepth,
        lastBatchResult,
        recentErrors,
      })
    } catch (err) {
      logger.error({ err }, 'Ops batch-status query failed')
      return res.status(500).json({
        statusCode: 500,
        error:      'Internal Server Error',
        message:    'Batch status query failed',
      })
    }
  })

  router.post('/trigger-batch', (_req, res) => {
    if (isBatchRunning()) {
      return res.json({ status: 'locked' })
    }
    void triggerClassifierDrain('manual').catch((err: unknown) =>
      logger.error({ err }, 'Manual batch trigger failed')
    )
    return res.json({ triggered: true })
  })
}
