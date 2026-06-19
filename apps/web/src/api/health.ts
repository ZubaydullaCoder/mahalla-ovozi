// apps/web/src/api/health.ts
// Intentional frontend API-boundary type — do NOT import from apps/server
import { useQuery } from '@tanstack/react-query'

export interface DashboardHealthStatus {
  status:            'current' | 'delayed' | 'no_data'
  lastBatchAt:       string | null   // ISO 8601 UTC
  lastBatchStatus:   'success' | 'failed' | null
  messagesProcessed: number | null
  signalsWritten:    number | null
  queueDepth:        number
}

async function fetchHealth(): Promise<DashboardHealthStatus> {
  const res = await fetch('/api/health', {
    credentials: 'same-origin',
  })

  if (!res.ok) {
    throw new Error(`GET /api/health failed: ${res.status}`)
  }

  return res.json() as Promise<DashboardHealthStatus>
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 60000,
  })
}
