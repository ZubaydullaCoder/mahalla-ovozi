// apps/web/src/api/signals.ts
// Intentional frontend API-boundary mirror of apps/server/src/shared/types.ts
// DO NOT import server source into apps/web

import { useQuery } from '@tanstack/react-query'
import { fetchJson } from './client.ts'
import type { Signal } from '@mahalla-ovozi/contracts'
export type { Signal }

interface SignalsQueryParams {
  from?: string   // ISO 8601 with timezone
  to?: string     // ISO 8601 with timezone
}

async function fetchSignals(params?: SignalsQueryParams): Promise<Signal[]> {
  const url = new URL('/api/signals', window.location.origin)
  if (params?.from) url.searchParams.set('from', params.from)
  if (params?.to) url.searchParams.set('to', params.to)

  return fetchJson<Signal[]>(url.toString())
}

export function useSignals(params?: SignalsQueryParams) {
  return useQuery({
    queryKey: ['signals', params ?? {}],
    queryFn: () => fetchSignals(params),
    refetchInterval: 10000,
  })
}

interface SignalContextQueryParams {
  from?: string   // ISO 8601 with timezone
  to?: string     // ISO 8601 with timezone
}

async function fetchSignalContext(
  signalId: number,
  params?: SignalContextQueryParams,
): Promise<Signal[]> {
  const url = new URL(`/api/signals/${signalId}/context`, window.location.origin)
  if (params?.from) url.searchParams.set('from', params.from)
  if (params?.to)   url.searchParams.set('to', params.to)

  return fetchJson<Signal[]>(url.toString())
}

export function useSignalContext(
  signalId: number | null,
  params?: SignalContextQueryParams,
) {
  return useQuery({
    queryKey: ['signal-context', signalId, params ?? {}],
    queryFn:  () => fetchSignalContext(signalId!, params),
    enabled:  signalId !== null,
    // No refetchInterval — drawer context is fetched on demand only
  })
}
