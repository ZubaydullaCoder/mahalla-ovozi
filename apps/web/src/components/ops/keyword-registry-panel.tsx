import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Input, Popconfirm, Space, Spin, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  useFilteringMode,
  useKeywords,
  useAddKeyword,
  useToggleKeyword,
  useDeleteKeyword,
  type OpsKeyword,
} from '../../api/ops.ts'

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilteringModeSection() {
  const { data, isLoading } = useFilteringMode()

  return (
    <Card title="Filtering Mode" size="small">
      {isLoading ? <Spin /> : (
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Active Mode">
            <Tag color="blue">{data?.filterMode ?? '—'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Note">
            Mode changes require editing <code>.env</code> and restarting the server.
            Runtime mode switching is not supported in Phase 1.
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}

function AddKeywordForm() {
  const [phrase, setPhrase]   = useState('')
  const [error, setError]     = useState<string | null>(null)
  const addMutation = useAddKeyword()

  const handleAdd = () => {
    if (!phrase.trim()) return
    setError(null)
    addMutation.mutate(phrase.trim(), {
      onSuccess: () => setPhrase(''),
      onError:   (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to add keyword'),
    })
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={phrase}
          onChange={e => { setPhrase(e.target.value); setError(null) }}
          onPressEnter={handleAdd}
          placeholder="Enter keyword phrase (e.g. suv muammo)"
          maxLength={120}
          style={{ flexGrow: 1 }}
        />
        <Button
          type="primary"
          loading={addMutation.isPending}
          onClick={handleAdd}
          disabled={!phrase.trim()}
        >
          Add
        </Button>
      </Space.Compact>
      {error && (
        <Alert type="error" title={error} showIcon />
      )}
    </Space>
  )
}

function KeywordTable() {
  const { data: keywords, isLoading, isError } = useKeywords()
  const toggleMutation = useToggleKeyword()
  const deleteMutation = useDeleteKeyword()
  const [actionError, setActionError] = useState<string | null>(null)

  const showActionError = (err: unknown) => {
    setActionError(err instanceof Error ? err.message : 'Keyword action failed')
  }

  const columns: TableColumnsType<OpsKeyword> = [
    {
      title:     'Phrase',
      dataIndex: 'phrase',
      key:       'phrase',
    },
    {
      title:  'Status',
      key:    'isActive',
      width:  90,
      render: (_: unknown, record: OpsKeyword) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title:  'Created At',
      key:    'createdAt',
      width:  160,
      render: (_: unknown, record: OpsKeyword) =>
        new Date(record.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  180,
      render: (_: unknown, record: OpsKeyword) => (
        <Space>
          <Button
            size="small"
            loading={toggleMutation.isPending && toggleMutation.variables?.id === record.id}
            onClick={() => {
              setActionError(null)
              toggleMutation.mutate(
                { id: record.id, isActive: !record.isActive },
                { onError: showActionError },
              )
            }}
          >
            {record.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Popconfirm
            title={`Delete keyword phrase '${record.phrase}'?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => {
              setActionError(null)
              deleteMutation.mutate(record.id, { onError: showActionError })
            }}
          >
            <Button
              size="small"
              danger
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isLoading) return <Spin />
  if (isError)   return <Alert type="error" title="Failed to load keywords" />

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {actionError && <Alert type="error" title={actionError} showIcon />}
      <Table
        dataSource={keywords ?? []}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: <Empty description="No keywords in registry" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </Space>
  )
}

// ─── Exported panel ───────────────────────────────────────────────────────────

export function KeywordRegistryPanel() {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <FilteringModeSection />
      <Card title="Keyword Registry" size="small">
        <Space orientation="vertical" style={{ width: '100%' }}>
          <AddKeywordForm />
          <KeywordTable />
        </Space>
      </Card>
    </Space>
  )
}
