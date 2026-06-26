import { prisma } from '../shared/db.js'

export type IntakeMetrics = {
  pre_filter_discards: number
  keyword_matched_count: number
  keyword_skipped_count: number
  keyword_ai_signal_count: number
  keyword_ai_ignore_count: number
  no_keyword_ai_signal_count: number
  no_keyword_ai_ignore_count: number
}

type PipelineEventCountRow = {
  event_type: string
  count: bigint
}

export const zeroIntakeMetrics: IntakeMetrics = {
  pre_filter_discards:        0,
  keyword_matched_count:      0,
  keyword_skipped_count:      0,
  keyword_ai_signal_count:    0,
  keyword_ai_ignore_count:    0,
  no_keyword_ai_signal_count: 0,
  no_keyword_ai_ignore_count: 0,
}

export async function aggregateIntakeMetrics(params: {
  districtId: number
  from: Date
  to: Date
}): Promise<IntakeMetrics> {
  const rows = await prisma.$queryRaw<Array<PipelineEventCountRow>>`
    SELECT event_type, COUNT(DISTINCT telegram_update_id) AS count
    FROM pipeline_events
    WHERE district_id = ${params.districtId}
      AND created_at >= ${params.from}
      AND created_at < ${params.to}
    GROUP BY event_type
  `

  const countByType = Object.fromEntries(
    rows.map((row) => [row.event_type, Number(row.count)]),
  )

  return {
    pre_filter_discards:        0,
    keyword_matched_count:      countByType.keyword_match ?? 0,
    keyword_skipped_count:      countByType.keyword_skip ?? 0,
    keyword_ai_signal_count:    0,
    keyword_ai_ignore_count:    0,
    no_keyword_ai_signal_count: 0,
    no_keyword_ai_ignore_count: 0,
  }
}
