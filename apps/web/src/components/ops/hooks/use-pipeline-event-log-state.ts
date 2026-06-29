import { useMemo, useState } from 'react'
import {
  useDeleteAllPipelineEvents,
  useDeleteSimulatedPipelineEvents,
  usePipelineEvents,
  type PipelineEvent,
} from '../../../api/ops.ts'

export interface MergedPipelineRow extends PipelineEvent {
  _merged?: PipelineEvent
}

function groupPipelineEvents(events: PipelineEvent[]): MergedPipelineRow[] {
  const asc = [...events].reverse()
  const grouped = new Map<string, PipelineEvent[]>()
  const order: string[] = []

  for (const event of asc) {
    const key =
      event.rawMessageId != null
        ? `raw-${event.rawMessageId}`
        : event.telegramUpdateId != null
          ? `update-${event.telegramUpdateId}`
          : `solo-${event.id}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
      order.push(key)
    }
    grouped.get(key)!.push(event)
  }

  const result: MergedPipelineRow[] = []

  for (const key of order) {
    const group = grouped.get(key)!
    const kwMatch = group.find(e => e.eventType === 'keyword_match')
    const classifier = group.find(e => e.eventType.startsWith('classifier_'))

    if (kwMatch && classifier) {
      result.push({ ...kwMatch, _merged: classifier })
      for (const e of group) {
        if (e.id !== kwMatch.id && e.id !== classifier.id) {
          result.push(e)
        }
      }
    } else {
      for (const e of group) {
        result.push(e)
      }
    }
  }

  return result.sort((a, b) => {
    const aCreatedAt = a._merged?.createdAt ?? a.createdAt
    const bCreatedAt = b._merged?.createdAt ?? b.createdAt
    return Date.parse(bCreatedAt) - Date.parse(aCreatedAt)
  })
}

export function usePipelineEventLogState() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { data: events, isLoading, isError, refetch, isFetching } = usePipelineEvents(autoRefresh)
  const deleteSimulated = useDeleteSimulatedPipelineEvents()
  const deleteAll = useDeleteAllPipelineEvents()
  const displayRows = useMemo(() => events ? groupPipelineEvents(events) : [], [events])

  return {
    autoRefresh,
    setAutoRefresh,
    events,
    isLoading,
    isError,
    refetch,
    isFetching,
    deleteSimulated,
    deleteAll,
    displayRows,
  }
}
