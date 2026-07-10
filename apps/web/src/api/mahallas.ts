import { useQuery } from '@tanstack/react-query'
import { fetchJson } from './client.ts'
import type { Mahalla } from '@mahalla-ovozi/contracts'
export type { Mahalla }

async function fetchMahallas(): Promise<Mahalla[]> {
  return fetchJson<Mahalla[]>('/api/mahallas')
}

export function useMahallas() {
  return useQuery({
    queryKey: ['mahallas'],
    queryFn: fetchMahallas,
    // No refetchInterval — mahalla list is static during a user session
  })
}
