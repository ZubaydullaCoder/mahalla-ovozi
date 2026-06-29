import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useMahallas,
  useSimulateMessage,
  useSimulateWebhook,
  type SimulateWebhookResult,
} from '../../../api/ops.ts'

type SimulatorMode = 'webhook' | 'message'
type TextSource = 'text' | 'caption'

interface UseSimulatorPanelStateOptions {
  onSuccessMessage: (content: string) => void
}

const CIVIC_PHRASES = [
  'Suv yo\'q',
  'Gaz muammo',
  'Elektr o\'chdi',
  'Ko\'cha yoritilmagan',
  'Axlat olib ketilmaydi',
  'Yo\'l buzilgan',
  'Suv bosqini',
  'Gaz hidi bor',
  'Issiqlik yo\'q',
  'Telefon aloqasi yo\'q',
] as const

export function useSimulatorPanelState({ onSuccessMessage }: UseSimulatorPanelStateOptions) {
  const [mode, setModeState] = useState<SimulatorMode>('webhook')
  const [mahallaId, setMahallaId] = useState<number | undefined>()
  const [text, setText] = useState('')
  const [senderDisplayName, setSenderDisplayName] = useState('Test User')
  const [textSource, setTextSource] = useState<TextSource>('text')
  const [simulatedTimestamp, setSimulatedTimestamp] = useState<string | undefined>()
  const [senderUsername, setSenderUsername] = useState('')
  const [bulkCount, setBulkCount] = useState<number>(10)
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SimulateWebhookResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: mahallas, isLoading: mahallasLoading } = useMahallas()
  const webhookMutation = useSimulateWebhook()
  const messageMutation = useSimulateMessage()

  useEffect(() => {
    if (mahallas && mahallas.length > 0 && mahallaId === undefined) {
      setMahallaId(mahallas[0]!.id)
    }
  }, [mahallas, mahallaId])

  const isLoading = webhookMutation.isPending || messageMutation.isPending
  const canSubmit = mahallaId !== undefined && text.trim().length > 0
  const visibleBulkCount = Math.min(Math.max(bulkCount ?? 10, 1), 50)
  const mahallaOptions = useMemo(
    () => mahallas?.map(m => ({ value: m.id, label: m.name })) ?? [],
    [mahallas],
  )

  const setMode = useCallback((nextMode: SimulatorMode) => {
    setModeState(nextMode)
    setLastResult(null)
    setError(null)
    setBulkProgress(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const resetAfterMessageSuccess = useCallback(() => {
    setText('')
    setLastResult(null)
    setError(null)
    setBulkProgress(null)
  }, [])

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setError(null)
    setLastResult(null)

    const basePayload = {
      mahallaId: mahallaId!,
      senderDisplayName: senderDisplayName || undefined,
      text: text.trim(),
      textSource,
      simulatedTimestamp,
    }

    try {
      if (mode === 'webhook') {
        const result = await webhookMutation.mutateAsync(basePayload)
        setLastResult(result)
        onSuccessMessage('Simulated webhook injected')
        setText('')
        setError(null)
      } else {
        const result = await messageMutation.mutateAsync({
          ...basePayload,
          senderUsername: senderUsername || undefined,
        })
        onSuccessMessage(`Message seeded (ID: ${result.rawMessageId})`)
        resetAfterMessageSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Injection failed')
    }
  }, [
    canSubmit,
    mahallaId,
    messageMutation,
    mode,
    onSuccessMessage,
    resetAfterMessageSuccess,
    senderDisplayName,
    senderUsername,
    simulatedTimestamp,
    text,
    textSource,
    webhookMutation,
  ])

  const bulkSubmit = useCallback(async () => {
    if (!canSubmit) return
    setError(null)
    setBulkProgress(null)

    const count = visibleBulkCount
    let succeeded = 0

    for (let i = 0; i < count; i++) {
      const bulkText = CIVIC_PHRASES[Math.floor(Math.random() * CIVIC_PHRASES.length)]!
      try {
        await messageMutation.mutateAsync({
          mahallaId: mahallaId!,
          senderDisplayName: senderDisplayName || undefined,
          senderUsername: senderUsername || undefined,
          text: bulkText,
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
      onSuccessMessage(`${succeeded} messages seeded`)
      setBulkProgress(`${succeeded}/${count} injected`)
    }
  }, [
    canSubmit,
    mahallaId,
    messageMutation,
    onSuccessMessage,
    senderDisplayName,
    senderUsername,
    simulatedTimestamp,
    textSource,
    visibleBulkCount,
  ])

  return {
    mode,
    setMode,
    mahallaId,
    setMahallaId,
    text,
    setText,
    senderDisplayName,
    setSenderDisplayName,
    textSource,
    setTextSource,
    simulatedTimestamp,
    setSimulatedTimestamp,
    senderUsername,
    setSenderUsername,
    bulkCount,
    setBulkCount,
    bulkProgress,
    lastResult,
    error,
    clearError,
    mahallaOptions,
    mahallasLoading,
    isLoading,
    canSubmit,
    visibleBulkCount,
    submit,
    bulkSubmit,
  }
}
