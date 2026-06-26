import type {
  LoginSuccessResponse,
  LogoutSuccessResponse,
  CurrentSessionResponse,
  ApiErrorResponse,
} from '../types.ts'

function fallbackError(status: number, message: string): ApiErrorResponse {
  return {
    statusCode: status,
    error: 'Error',
    message,
  }
}

async function readJson<T>(res: Response, fallback: T): Promise<T> {
  return res.json().catch(() => fallback) as Promise<T>
}

export class AuthError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorResponse,
  ) {
    super(data.message)
    this.name = 'AuthError'
  }
}

export async function login(credentials: {
  username: string
  password: string
}): Promise<LoginSuccessResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(credentials),
  })

  if (!res.ok) {
    const data = await readJson<ApiErrorResponse>(
      res,
      fallbackError(res.status, 'Login failed'),
    )
    throw new AuthError(res.status, data)
  }

  return readJson<LoginSuccessResponse>(res, { ok: true })
}

export async function logout(): Promise<LogoutSuccessResponse> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  })

  if (!res.ok) {
    const data = await readJson<ApiErrorResponse>(
      res,
      fallbackError(res.status, 'Logout failed'),
    )
    throw new AuthError(res.status, data)
  }

  return readJson<LogoutSuccessResponse>(res, { ok: true })
}

export async function getCurrentSession(): Promise<CurrentSessionResponse> {
  const res = await fetch('/api/auth/me', {
    method:      'GET',
    credentials: 'same-origin',
  })

  if (!res.ok) {
    const data = await readJson<ApiErrorResponse>(
      res,
      fallbackError(res.status, 'Authentication required'),
    )
    throw new AuthError(res.status, data)
  }

  return res.json() as Promise<CurrentSessionResponse>
}
