// apps/web/src/components/ops/simulator-panel.tsx
import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  useMahallas,
  useSimulateWebhook,
  useSimulateMessage,
} from '../../api/ops.ts'
import type { SimulateWebhookResult } from '../../api/ops.ts'

const { Text } = Typography

// Decision badge colors
const DECISION_COLORS: Record<SimulateWebhookResult['decision'], string> = {
  queued:            'success',
  structural_discard: 'error',
  keyword_skip:      'warning',
}

const DECISION_LABELS: Record<SimulateWebhookResult['decision'], string> = {
  queued:            'Queued',
  structural_discard: 'Structural Discard',
  keyword_skip:      'Keyword Skip',
}

export function SimulatorPanel() {
  const [messageApi, contextHolder] = message.useMessage()

  // Mode: 'webhook' = Mode A, 'message' = Mode B
  const [mode, setMode] = useState<'webhook' | 'message'>('webhook')

  // Shared fields
  const [mahallaId, setMahallaId]             = useState<number | undefined>()
  const [text, setText]                       = useState('')
  const [senderDisplayName, setSenderDisplayName] = useState('Test User')
  const [textSource, setTextSource]           = useState<'text' | 'caption'>('text')
  const [simulatedTimestamp, setSimulatedTimestamp] = useState<string | undefined>()

  // Mode B only
  const [senderUsername, setSenderUsername]   = useState('')
  const [bulkCount, setBulkCount]             = useState<number>(10)
  const [bulkProgress, setBulkProgress]       = useState<string | null>(null)

  // Feedback
  const [lastResult, setLastResult]           = useState<SimulateWebhookResult | null>(null)
  const [error, setError]                     = useState<string | null>(null)

  const { data: mahallas, isLoading: mahallasLoading } = useMahallas()

  // Auto-select first mahalla once list loads (no user selection yet)
  useEffect(() => {
    if (mahallas && mahallas.length > 0 && mahallaId === undefined) {
      setMahallaId(mahallas[0]!.id)
    }
  }, [mahallas, mahallaId])
  const webhookMutation  = useSimulateWebhook()
  const messageMutation  = useSimulateMessage()

  const isLoading = webhookMutation.isPending || messageMutation.isPending

  // Validation: mahalla and text required
  const canSubmit = mahallaId !== undefined && text.trim().length > 0

  function resetAfterSuccess() {
    setText('')
    setLastResult(null)
    setError(null)
    setBulkProgress(null)
  }

  async function handleInject() {
    if (!canSubmit) return
    setError(null)
    setLastResult(null)

    const basePayload = {
      mahallaId:          mahallaId!,
      senderDisplayName:  senderDisplayName || undefined,
      text:               text.trim(),
      textSource,
      simulatedTimestamp,
    }

    try {
      if (mode === 'webhook') {
        const result = await webhookMutation.mutateAsync(basePayload)
        setLastResult(result)
        messageApi.success('Simulated webhook injected')
        setText('')
        setError(null)
      } else {
        const result = await messageMutation.mutateAsync({
          ...basePayload,
          senderUsername: senderUsername || undefined,
        })
        messageApi.success(`Message seeded (ID: ${result.rawMessageId})`)
        resetAfterSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Injection failed')
    }
  }

  async function handleBulkInject() {
    if (!canSubmit) return
    setError(null)
    setBulkProgress(null)

    const CIVIC_PHRASES = [
      'Suv yo\'q', 'Gaz muammo', 'Elektr o\'chdi', 'Ko\'cha yoritilmagan',
      'Axlat olib ketilmaydi', 'Yo\'l buzilgan', 'Suv bosqini', 'Gaz hidi bor',
      'Issiqlik yo\'q', 'Telefon aloqasi yo\'q',
    ]

    const count   = Math.min(Math.max(bulkCount ?? 10, 1), 50)
    let succeeded = 0

    for (let i = 0; i < count; i++) {
      const bulkText = CIVIC_PHRASES[Math.floor(Math.random() * CIVIC_PHRASES.length)]!
      try {
        await messageMutation.mutateAsync({
          mahallaId:         mahallaId!,
          senderDisplayName: senderDisplayName || undefined,
          senderUsername:    senderUsername || undefined,
          text:              bulkText,
          textSource,
          simulatedTimestamp,
        })
        succeeded++
        setBulkProgress(`${succeeded}/${count} injected…`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk inject failed')
        break
      }
    }

    if (succeeded === count) {
      messageApi.success(`${succeeded} messages seeded`)
      setBulkProgress(`${succeeded}/${count} injected`)
    }
  }

  const mahallaOptions = mahallas?.map(m => ({ value: m.id, label: m.name })) ?? []
  const visibleBulkCount = Math.min(Math.max(bulkCount ?? 10, 1), 50)

  return (
    <div style={{ maxWidth: 680 }}>
      {contextHolder}

      {/* Mode selector */}
      <Form.Item label="Simulation Mode" style={{ marginBottom: 16 }}>
        <Segmented
          id="sim-mode-toggle"
          value={mode}
          onChange={v => {
            setMode(v as 'webhook' | 'message')
            setLastResult(null)
            setError(null)
            setBulkProgress(null)
          }}
          options={[
            { label: 'Webhook Simulation (Mode A)', value: 'webhook' },
            { label: 'Raw Queue Seeding (Mode B)',  value: 'message' },
          ]}
        />
      </Form.Item>

      <Form layout="vertical">
        {/* Mahalla select */}
        <Form.Item label="Mahalla" required>
          <Select
            id="sim-mahalla-select"
            placeholder="Select mahalla"
            loading={mahallasLoading}
            value={mahallaId}
            onChange={v => setMahallaId(v)}
            options={mahallaOptions}
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* Sender display name */}
        <Form.Item label="Sender display name">
          <Input
            id="sim-sender-name"
            value={senderDisplayName}
            onChange={e => setSenderDisplayName(e.target.value)}
            placeholder="Test User"
          />
        </Form.Item>

        {/* Sender username — Mode B only */}
        {mode === 'message' && (
          <Form.Item label="Sender username (optional)">
            <Input
              id="sim-sender-username"
              value={senderUsername}
              onChange={e => setSenderUsername(e.target.value)}
              placeholder="@username"
            />
          </Form.Item>
        )}

        {/* Message text */}
        <Form.Item label="Message text" required>
          <Input.TextArea
            id="sim-message-text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter civic message text…"
            rows={3}
          />
        </Form.Item>

        {/* Text source */}
        <Form.Item label="Text source">
          <Radio.Group
            id="sim-text-source"
            value={textSource}
            onChange={e => setTextSource(e.target.value as 'text' | 'caption')}
          >
            <Radio value="text">text</Radio>
            <Radio value="caption">caption</Radio>
          </Radio.Group>
        </Form.Item>

        {/* Simulated timestamp */}
        <Form.Item label="Simulated timestamp (optional)">
          <DatePicker
            id="sim-timestamp"
            showTime
            style={{ width: '100%' }}
            onChange={date => setSimulatedTimestamp(date?.toISOString())}
          />
        </Form.Item>

        {/* Inject button(s) */}
        <Form.Item>
          <Space>
            <Button
              id="sim-inject-button"
              type="primary"
              loading={isLoading && !bulkProgress}
              disabled={!canSubmit || isLoading}
              onClick={() => void handleInject()}
            >
              Inject Message
            </Button>

            {/* Bulk inject — Mode B only */}
            {mode === 'message' && (
              <>
                <InputNumber
                  id="sim-bulk-count"
                  min={1}
                  max={50}
                  value={bulkCount}
                  onChange={v => setBulkCount(v ?? 10)}
                  style={{ width: 80 }}
                />
                <Button
                  id="sim-bulk-inject-button"
                  disabled={!canSubmit || isLoading}
                  loading={isLoading && Boolean(bulkProgress)}
                  onClick={() => void handleBulkInject()}
                >
                  Inject Bulk ({visibleBulkCount})
                </Button>
              </>
            )}
          </Space>
        </Form.Item>
      </Form>

      {/* Bulk progress indicator */}
      {bulkProgress && (
        <div style={{ marginBottom: 12 }}>
          <Spin size="small" style={{ marginRight: 8 }} />
          <Text type="secondary">{bulkProgress}</Text>
        </div>
      )}

      {/* Error feedback — inline Alert */}
      {error && (
        <Alert
          id="sim-error-alert"
          type="error"
          title={error}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}

      {/* Mode A result display */}
      {mode === 'webhook' && lastResult && (
        <Descriptions
          id="sim-webhook-result"
          size="small"
          bordered
          column={1}
          title="Pipeline Result"
          style={{ marginTop: 16 }}
        >
          <Descriptions.Item label="Decision">
            <Tag color={DECISION_COLORS[lastResult.decision]}>
              {DECISION_LABELS[lastResult.decision]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Filter mode">{lastResult.filterMode}</Descriptions.Item>
          <Descriptions.Item label="Keyword matched">
            {lastResult.keywordMatched ? 'Yes' : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="Matched phrase">
            {lastResult.matchedPhrase ?? '—'}
          </Descriptions.Item>
          {lastResult.reason && (
            <Descriptions.Item label="Reason">{lastResult.reason}</Descriptions.Item>
          )}
        </Descriptions>
      )}
    </div>
  )
}
