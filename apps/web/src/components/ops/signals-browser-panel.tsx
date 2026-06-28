// apps/web/src/components/ops/signals-browser-panel.tsx
import { useState } from 'react'
import {
  Alert, Badge, Button, Card, Empty, Popconfirm,
  Radio, Select, Space, Spin, Table, Tag, Tooltip, Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  useOpsSignals,
  useRawMessages,
  useDeleteSimulatedSignals,
  useDeleteSimulatedRawMessages,
  useDeleteSignal,
  useDeleteRawMessage,
  useMahallas,
  type OpsSignal,
  type RawMessageRow,
  type OpsSignalsFilters,
} from '../../api/ops.ts'

const CATEGORY_COLORS: Record<string, string> = {
  water:       'blue',
  electricity: 'orange',
  gas:         'cyan',
  waste:       'green',
}

const SIMULATED_DELETE_TOOLTIP = 'Deletes only rows where telegram_update_id < 0 (simulated/demo messages). Real Telegram messages are not affected.'

function RawMessagesSection() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, refetch, isFetching } = useRawMessages(page)
  const deleteSimulated  = useDeleteSimulatedRawMessages()
  const deleteRawMessage = useDeleteRawMessage()

  const columns: TableColumnsType<RawMessageRow> = [
    { title: 'ID',      dataIndex: 'id',       key: 'id',       width: 60 },
    { title: 'Mahalla', dataIndex: 'mahallaName', key: 'mahalla', width: 140 },
    {
      title: 'Text', key: 'text', ellipsis: true,
      render: (_: unknown, r: RawMessageRow) => (
        <Typography.Text style={{ fontSize: 11 }}>
          {r.text.slice(0, 100)}
        </Typography.Text>
      ),
    },
    {
      title: 'Source', key: 'source', width: 80,
      render: (_: unknown, r: RawMessageRow) => <Tag>{r.textSource}</Tag>,
    },
    {
      title: 'Keyword', key: 'keyword', width: 80,
      render: (_: unknown, r: RawMessageRow) => (
        <Tag color={r.keywordMatched ? 'success' : 'default'}>{r.keywordMatched ? 'yes' : 'no'}</Tag>
      ),
    },
    {
      title: 'Matched kw', key: 'matchedKw', width: 120,
      render: (_: unknown, r: RawMessageRow) => r.matchedKeyword ?? '-',
    },
    {
      title: 'Captured at', key: 'ts', width: 150,
      render: (_: unknown, r: RawMessageRow) =>
        new Date(r.telegramTimestamp).toLocaleString('en-GB', { timeZone: 'UTC' }),
    },
    {
      title: 'Simulated?', key: 'simulated', width: 90,
      render: (_: unknown, r: RawMessageRow) =>
        r.isSimulated ? <Badge status="warning" text="Sim" /> : null,
    },
    {
      title: 'Action', key: 'action', width: 70, fixed: 'right',
      render: (_: unknown, r: RawMessageRow) => (
        <Popconfirm
          title="Delete this raw message?"
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={() => deleteRawMessage.mutate(r.id)}
        >
          <Button
            size="small"
            danger
            loading={deleteRawMessage.isPending}
            aria-label={`Delete raw message ${r.id}`}
            title={`Delete raw message ${r.id}`}
          >
            ×
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <Card
      title="Raw Messages Queue"
      size="small"
      extra={
        <Space>
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>
            Refresh
          </Button>
          <Tooltip title={SIMULATED_DELETE_TOOLTIP}>
            <Popconfirm
              title="Delete all simulated raw messages?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => deleteSimulated.mutate()}
            >
              <Button size="small" danger loading={deleteSimulated.isPending}>
                Delete Simulated
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      }
    >
      {isLoading && <Spin />}
      {isError && <Alert type="error" title="Failed to load raw messages" />}
      {!isLoading && !isError && (
        <Table<RawMessageRow>
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            current:  page,
            pageSize: 50,
            total:    data?.total ?? 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => `${total} messages`,
          }}
          locale={{ emptyText: <Empty description="No raw messages pending" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}
    </Card>
  )
}

function SignalsBrowserSection() {
  const [page, setPage]       = useState(1)
  const [filters, setFilters] = useState<OpsSignalsFilters>({})
  const { data: mahallas }    = useMahallas()
  const { data, isLoading, isError, refetch, isFetching } = useOpsSignals(filters, page)
  const deleteSimulated = useDeleteSimulatedSignals()
  const deleteSignal    = useDeleteSignal()

  const columns: TableColumnsType<OpsSignal> = [
    { title: 'ID',       dataIndex: 'id',          key: 'id',       width: 60 },
    { title: 'Mahalla',  dataIndex: 'mahallaName',  key: 'mahalla',  width: 140 },
    {
      title: 'Text', key: 'text', ellipsis: true,
      render: (_: unknown, r: OpsSignal) => (
        <Typography.Text style={{ fontSize: 11 }}>{r.rawText.slice(0, 100)}</Typography.Text>
      ),
    },
    {
      title: 'Category', key: 'category', width: 100,
      render: (_: unknown, r: OpsSignal) => (
        <Tag color={CATEGORY_COLORS[r.category] ?? 'default'}>{r.category}</Tag>
      ),
    },
    {
      title: 'Hokim', key: 'hokim', width: 60,
      render: (_: unknown, r: OpsSignal) => r.hokimRelated ? '★' : null,
    },
    {
      title: 'Keyword', key: 'keyword', width: 80,
      render: (_: unknown, r: OpsSignal) => (
        <Tag color={r.keywordMatched ? 'success' : 'default'}>{r.keywordMatched ? 'yes' : 'no'}</Tag>
      ),
    },
    {
      title: 'Matched kw', key: 'matchedKw', width: 120,
      render: (_: unknown, r: OpsSignal) => r.matchedKeyword ?? '—',
    },
    { title: 'Short label', dataIndex: 'shortLabel', key: 'label', width: 120 },
    {
      title: 'Source', key: 'src', width: 75,
      render: (_: unknown, r: OpsSignal) => <Tag>{r.textSource}</Tag>,
    },
    {
      title: 'Classified at', key: 'classifiedAt', width: 150,
      render: (_: unknown, r: OpsSignal) =>
        new Date(r.classifiedAt).toLocaleString('en-GB', { timeZone: 'UTC' }),
    },
    {
      title: 'Action', key: 'action', width: 70, fixed: 'right',
      render: (_: unknown, r: OpsSignal) => (
        <Popconfirm
          title="Delete this signal?"
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={() => deleteSignal.mutate(r.id)}
        >
          <Button
            size="small"
            danger
            loading={deleteSignal.isPending}
            aria-label={`Delete signal ${r.id}`}
            title={`Delete signal ${r.id}`}
          >
            ×
          </Button>
        </Popconfirm>
      ),
    },
  ]

  function handleFilterChange(patch: Partial<OpsSignalsFilters>) {
    setFilters(prev => ({ ...prev, ...patch }))
    setPage(1)  // reset to page 1 on filter change
  }

  return (
    <Card
      title="Signals Browser"
      size="small"
      extra={
        <Space>
          <Button size="small" loading={isFetching} onClick={() => void refetch()}>
            Refresh
          </Button>
          <Tooltip title={SIMULATED_DELETE_TOOLTIP}>
            <Popconfirm
              title="Delete all simulated signals (telegram_update_id < 0)?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => deleteSimulated.mutate()}
            >
              <Button size="small" danger loading={deleteSimulated.isPending}>
                Delete Simulated
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      }
    >
      {/* Filter bar */}
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          placeholder="Category"
          allowClear
          style={{ width: 140 }}
          options={[
            { value: 'water',       label: 'Water' },
            { value: 'electricity', label: 'Electricity' },
            { value: 'gas',         label: 'Gas' },
            { value: 'waste',       label: 'Waste' },
          ]}
          onChange={(val) => handleFilterChange({ category: (val as OpsSignalsFilters['category']) ?? '' })}
        />
        <Select
          placeholder="Mahalla"
          allowClear
          style={{ width: 180 }}
          options={(mahallas ?? []).map(m => ({ value: m.id, label: m.name }))}
          onChange={(val) => handleFilterChange({ mahallaId: (val as number | undefined) ?? null })}
        />
        <Radio.Group
          value={filters.hokimRelated === true ? 'true' : filters.hokimRelated === false ? 'false' : 'all'}
          optionType="button"
          size="small"
          options={[
            { value: 'all',   label: 'All' },
            { value: 'true',  label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          onChange={(e) => {
            const value = e.target.value as 'all' | 'true' | 'false'
            handleFilterChange({ hokimRelated: value === 'true' ? true : value === 'false' ? false : undefined })
          }}
        />
      </Space>
      {isLoading && <Spin />}
      {isError && <Alert type="error" title="Failed to load signals" />}
      {!isLoading && !isError && (
        <Table<OpsSignal>
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            current:  page,
            pageSize: 50,
            total:    data?.total ?? 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => `${total} signals`,
          }}
          locale={{ emptyText: <Empty description="No signals found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      )}
    </Card>
  )
}

export function SignalsBrowserPanel() {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <RawMessagesSection />
      <SignalsBrowserSection />
    </Space>
  )
}
