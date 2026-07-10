// apps/web/src/api/client.ts

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...init?.headers,
    },
  })

  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = undefined
    }
    throw new ApiError(`Request failed: ${res.status}`, res.status, body)
  }

  return res.json() as Promise<T>
}
