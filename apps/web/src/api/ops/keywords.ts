import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { OPS_QUERY_KEY, readErrorMessage } from './common.ts'

import type { OpsKeyword } from '@mahalla-ovozi/contracts'
export type { OpsKeyword }

async function fetchFilteringMode(): Promise<{ filterMode: string }> {
  const res = await fetch('/api/ops/filtering-mode', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/filtering-mode failed: ${res.status}`)
  return res.json() as Promise<{ filterMode: string }>
}

async function fetchKeywords(): Promise<OpsKeyword[]> {
  const res = await fetch('/api/ops/keywords', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`GET /api/ops/keywords failed: ${res.status}`)
  return res.json() as Promise<OpsKeyword[]>
}

async function postKeyword(phrase: string): Promise<OpsKeyword> {
  const res = await fetch('/api/ops/keywords', {
    method:      'POST',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ phrase }),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `POST /api/ops/keywords failed: ${res.status}`))
  }
  return res.json() as Promise<OpsKeyword>
}

async function patchKeyword(id: number, isActive: boolean): Promise<OpsKeyword> {
  const res = await fetch(`/api/ops/keywords/${id}`, {
    method:      'PATCH',
    credentials: 'same-origin',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ isActive }),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `PATCH /api/ops/keywords/${id} failed: ${res.status}`))
  }
  return res.json() as Promise<OpsKeyword>
}

async function deleteKeyword(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`/api/ops/keywords/${id}`, {
    method:      'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `DELETE /api/ops/keywords/${id} failed: ${res.status}`))
  }
  return res.json() as Promise<{ deleted: number }>
}

export function useFilteringMode() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'filtering-mode'],
    queryFn:  fetchFilteringMode,
    staleTime: Infinity,
  })
}

export function useKeywords() {
  return useQuery({
    queryKey: [...OPS_QUERY_KEY, 'keywords'],
    queryFn:  fetchKeywords,
  })
}

export function useAddKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postKeyword,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] }),
  })
}

export function useToggleKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => patchKeyword(id, isActive),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] }),
  })
}

export function useDeleteKeyword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteKeyword,
    onSuccess:  () => qc.invalidateQueries({ queryKey: [...OPS_QUERY_KEY, 'keywords'] }),
  })
}
