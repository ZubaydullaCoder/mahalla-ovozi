import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  usePipelineEvents,
  useBatchStatus,
  useTriggerBatch,
} from '../../api/ops.ts'
import type { PipelineEvent } from '../../api/ops.ts'

// ── Event type → AntD Tag color mapping ───────────────────────────────────────
// Known current event types produced by pipeline.ts:
//   prefilter_pass → success (green)
//   keyword_match  → processing (blue)
//   keyword_skip   → gold (yellow)
//   unknown future → default (neutral)
const EVENT_COLOR: Record<string, string> = {
  prefilter_pass: 'success',
  keyword_match:  'processing',
  keyword_skip:   'gold',
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' })
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function getEventDetail(event: PipelineEvent) {
  const detail = toRecord(event.detail)
  const textSnippet =
    typeof detail['textSnippet'] === 'string'
      ? detail['textSnippet'].slice(0, 80)
      : typeof detail['text'] === 'string'
        ? (detail['text'] as string).slice(0, 80)
        : ''

  return {
    textSnippet,
    mahalla:          typeof detail['mahallaName'] === 'string' ? detail['mahallaName'] : null,
    telegramUpdateId: event.telegramUpdateId ?? detail['telegramUpdateId'],
    rawMessageId:     event.rawMessageId ?? detail['rawMessageId'],
  }
}

// ── BatchStatusPanel ──────────────────────────────────────────────────────────

function BatchStatusPanel() {
  const { data, isLoading } = useBatchStatus()
  const triggerMutation = useTriggerBatch()

  const result = data?.lastBatchResult

  return (
    <Card title="Batch Processor Status" size="small">
      {isLoading ? (
        <Spin />
      ) : (
        <>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Scheduler">
              <Badge
                status={data?.schedulerStatus === 'running' ? 'processing' : 'default'}
                text={data?.schedulerStatus ?? 'unknown'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Queue Depth">{data?.queueDepth ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Last Batch At">
              {data?.lastBatchAt
                ? new Date(data.lastBatchAt).toLocaleString('en-GB', { timeZone: 'UTC' })
                : 'Never'}
            </Descriptions.Item>
            <Descriptions.Item label="Duration">
              {data?.lastBatchDuration != null ? `${data.lastBatchDuration}ms` : '—'}
            </Descriptions.Item>
            {result && (
              <>
                <Descriptions.Item label="Filter Mode">{result.filterMode}</Descriptions.Item>
                <Descriptions.Item label="Messages">{result.messagesFetched} fetched</Descriptions.Item>
                <Descriptions.Item label="Results">
                  {result.signalsWritten} signals / {result.ignoredCount} ignored
                </Descriptions.Item>
                <Descriptions.Item label="Pre-filter Discards">{result.preFilterDiscards}</Descriptions.Item>
                <Descriptions.Item label="Keyword Matched">{result.keywordMatchedCount}</Descriptions.Item>
                <Descriptions.Item label="Keyword Skipped">{result.keywordSkippedCount}</Descriptions.Item>
                <Descriptions.Item label="Keyword AI Signal">{result.keywordAiSignalCount}</Descriptions.Item>
                <Descriptions.Item label="Keyword AI Ignore">{result.keywordAiIgnoreCount}</Descriptions.Item>
                <Descriptions.Item label="No-keyword AI Signal">{result.noKeywordAiSignalCount}</Descriptions.Item>
                <Descriptions.Item label="No-keyword AI Ignore">{result.noKeywordAiIgnoreCount}</Descriptions.Item>
                <Descriptions.Item label="Batch Errors">{result.errors ?? 'None'}</Descriptions.Item>
              </>
            )}
          </Descriptions>
          {data?.recentErrors && data.recentErrors.length > 0 && (
            <Alert
              type="error"
              title={`${data.recentErrors.length} recent error(s)`}
              description={data.recentErrors[0]?.message}
              style={{ marginTop: 8 }}
            />
          )}
          <Button
            type="primary"
            style={{ marginTop: 12 }}
            loading={triggerMutation.isPending}
            onClick={() => triggerMutation.mutate()}
          >
            ▶ Trigger Batch Now
          </Button>
          {triggerMutation.isSuccess && (
            <Tag color="success" style={{ marginLeft: 8 }}>
              {'status' in (triggerMutation.data ?? {}) ? 'Already running' : 'Triggered'}
            </Tag>
          )}
        </>
      )}
    </Card>
  )
}

// ── EventLogPanel ─────────────────────────────────────────────────────────────

function EventLogPanel() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { data: events, isLoading, isError, refetch, isFetching } = usePipelineEvents(autoRefresh)

  const columns: TableColumnsType<PipelineEvent> = [
    {
      title: 'Time',
      key:   'time',
      width: 90,
      render: (_value, event) => (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {formatTime(event.createdAt)}
        </Typography.Text>
      ),
    },
    {
      title: 'Type',
      key:   'type',
      width: 150,
      render: (_value, event) => (
        <Tag color={EVENT_COLOR[event.eventType] ?? 'default'} style={{ minWidth: 110, textAlign: 'center' }}>
          {event.eventType.toUpperCase().replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Identifier',
      key:   'identifier',
      width: 130,
      render: (_value, event) => {
        const detail = getEventDetail(event)
        if (detail.telegramUpdateId != null) {
          return <Typography.Text code style={{ fontSize: 11 }}>update={String(detail.telegramUpdateId)}</Typography.Text>
        }
        if (detail.rawMessageId != null) {
          return <Typography.Text code style={{ fontSize: 11 }}>raw={String(detail.rawMessageId)}</Typography.Text>
        }
        return null
      },
    },
    {
      title: 'Mahalla',
      key:   'mahalla',
      width: 140,
      render: (_value, event) => {
        const detail = getEventDetail(event)
        return detail.mahalla ? <Typography.Text style={{ fontSize: 11 }}>{detail.mahalla}</Typography.Text> : null
      },
    },
    {
      title: 'Text',
      key:   'text',
      render: (_value, event) => {
        const detail = getEventDetail(event)
        return detail.textSnippet ? (
          <Typography.Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            &quot;{detail.textSnippet}&quot;
          </Typography.Text>
        ) : null
      },
    },
  ]

  return (
    <Card
      title="Pipeline Event Log"
      size="small"
      extra={
        <Space>
          <span>Auto-refresh</span>
          <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>
            Refresh
          </Button>
        </Space>
      }
    >
      {isLoading && <Spin />}
      {isError && <Alert type="error" title="Failed to load pipeline events" />}
      {!isLoading && !isError && (!events || events.length === 0) && (
        <Empty description="No pipeline events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {events && events.length > 0 && (
        <Table<PipelineEvent>
          size="small"
          rowKey="id"
          dataSource={events}
          columns={columns}
          pagination={false}
          tableLayout="fixed"
        />
      )}
    </Card>
  )
}

// ── PipelineLogPanel (exported) ───────────────────────────────────────────────

export function PipelineLogPanel() {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <BatchStatusPanel />
      <EventLogPanel />
    </Space>
  )
}
