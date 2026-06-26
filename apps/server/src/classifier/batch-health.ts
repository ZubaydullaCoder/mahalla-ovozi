import { prisma } from '../shared/db.js'
import { env } from '../shared/env.js'
import type { IntakeMetrics } from './intake-metrics.js'

export type BatchStatus = 'ok' | 'failed'

export async function writeBatchHealth(params: {
  districtId: number
  status: BatchStatus
  startedAt: Date
  completedAt: Date
  intakeWindowFrom: Date | null
  intakeWindowTo: Date
  messagesFetched: number
  signalsWritten: number
  ignoredCount: number
  intakeMetrics: IntakeMetrics
  errorMessage: string | null
}): Promise<void> {
  await prisma.batchHealth.create({
    data: {
      district_id:                params.districtId,
      status:                     params.status,
      started_at:                 params.startedAt,
      completed_at:               params.completedAt,
      intake_window_from:         params.intakeWindowFrom,
      intake_window_to:           params.intakeWindowTo,
      messages_fetched:           params.messagesFetched,
      signals_written:            params.signalsWritten,
      ignored_count:              params.ignoredCount,
      pre_filter_discards:        params.intakeMetrics.pre_filter_discards,
      filter_mode:                env.FILTER_MODE,
      keyword_matched_count:      params.intakeMetrics.keyword_matched_count,
      keyword_skipped_count:      params.intakeMetrics.keyword_skipped_count,
      keyword_ai_signal_count:    params.intakeMetrics.keyword_ai_signal_count,
      keyword_ai_ignore_count:    params.intakeMetrics.keyword_ai_ignore_count,
      no_keyword_ai_signal_count: params.intakeMetrics.no_keyword_ai_signal_count,
      no_keyword_ai_ignore_count: params.intakeMetrics.no_keyword_ai_ignore_count,
      error_message:              params.errorMessage,
    },
  })
}
