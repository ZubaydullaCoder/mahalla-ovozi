import { useQuery } from '@tanstack/react-query'
import { OPS_QUERY_KEY } from './common.ts'

import type { OpsBatchStatus, OpsStatus } from '@mahalla-ovozi/contracts'
export type { OpsBatchStatus, OpsStatus }

async function fetchOpsStatus(): Promise<OpsStatus> {
  const res = await fetch('/api/ops/batch-status', {
    credentials: 'same-origin',
  })

  if (res.status === 404) {
    return { isEnabled: false, isForbidden: false, data: null }
  }

  if (res.status === 403) {
    return { isEnabled: true, isForbidden: true, data: null }
  }

  if (!res.ok) {
    throw new Error(`GET /api/ops/batch-status failed: ${res.status}`)
  }

  return {
    isEnabled: true,
    isForbidden: false,
    data: await res.json() as OpsBatchStatus,
  }
}

export function useOpsStatus() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'status-probe'],
    queryFn:  fetchOpsStatus,
    retry:    false,
  })
}
