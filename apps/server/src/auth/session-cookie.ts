import { env } from '../shared/env.js'

export const SESSION_COOKIE_NAME = 'connect.sid'
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure:   env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge:   SESSION_MAX_AGE_MS,
  }
}

export function getSessionClearCookieOptions() {
  return {
    path:     '/',
    httpOnly: true,
    secure:   env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  }
}
