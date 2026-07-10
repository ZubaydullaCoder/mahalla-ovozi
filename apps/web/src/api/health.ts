import { useQuery } from '@tanstack/react-query'
import { fetchJson } from './client.ts'
import type { HealthStatus } from '@mahalla-ovozi/contracts'

export type DashboardHealthStatus = HealthStatus

async function fetchHealth(): Promise<DashboardHealthStatus> {
  return fetchJson<DashboardHealthStatus>('/api/health')
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 60000,
  })
}
