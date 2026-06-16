// apps/web/src/api/mahallas.ts
import { useQuery } from '@tanstack/react-query'

// Frontend-boundary type — DO NOT import from apps/server/src/shared/types.ts
export interface Mahalla {
  id: number
  districtId: number
  name: string
}

async function fetchMahallas(): Promise<Mahalla[]> {
  const res = await fetch('/api/mahallas', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/mahallas failed: ${res.status}`)
  return res.json() as Promise<Mahalla[]>
}

export function useMahallas() {
  return useQuery({
    queryKey: ['mahallas'],
    queryFn: fetchMahallas,
    // No refetchInterval — mahalla list is static during a user session
  })
}
