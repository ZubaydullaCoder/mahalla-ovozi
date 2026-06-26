import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getCurrentSession } from '../api/auth.ts'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let isMounted = true

    getCurrentSession()
      .then(() => {
        if (isMounted) setStatus('authenticated')
      })
      .catch(() => {
        // Network error — treat as unauthenticated for safety.
        if (isMounted) setStatus('unauthenticated')
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (status === 'loading') return null // render nothing; do NOT flash dashboard content
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  return <>{children}</>
}
