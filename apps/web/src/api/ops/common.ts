export const OPS_QUERY_KEY = ['ops'] as const

export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ message: res.statusText }))
  return (err as { message?: string }).message ?? fallback
}
