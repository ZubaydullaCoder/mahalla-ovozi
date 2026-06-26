// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './auth-guard.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderGuard() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={(
            <AuthGuard>
              <div>Protected dashboard</div>
            </AuthGuard>
          )}
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthGuard', () => {
  it('checks /api/auth/me and renders children when authenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      authenticated: true,
      userId:        1,
      districtId:    2,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    renderGuard()

    await screen.findByText('Protected dashboard')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      method:      'GET',
      credentials: 'same-origin',
    })
  })

  it('redirects to login when unauthenticated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      statusCode: 401,
      error:      'Unauthorized',
      message:    'Authentication required',
    }), { status: 401 })))

    renderGuard()

    await screen.findByText('Login page')
    await waitFor(() => {
      expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument()
    })
  })
})
