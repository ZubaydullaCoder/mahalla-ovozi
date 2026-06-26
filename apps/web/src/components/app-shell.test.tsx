// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './app-shell.tsx'

const authMocks = vi.hoisted(() => ({
  logout: vi.fn(),
}))

vi.mock('../api/auth.ts', () => authMocks)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderShell(queryClient = new QueryClient()) {
  render(
    <ConfigProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={(
                <AppShell filterBar={<div>Filters</div>}>
                  <div>Dashboard body</div>
                </AppShell>
              )}
            />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ConfigProvider>,
  )
}

describe('AppShell', () => {
  it('renders a visible logout action', () => {
    renderShell()

    expect(screen.getByRole('button', { name: 'Чиқиш' })).toBeInTheDocument()
  })

  it('logs out, clears cached data, and navigates to login', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['signals'], [{ id: 1 }])
    authMocks.logout.mockResolvedValue({ ok: true })

    renderShell(queryClient)
    await userEvent.click(screen.getByRole('button', { name: 'Чиқиш' }))

    await screen.findByText('Login page')
    await waitFor(() => {
      expect(authMocks.logout).toHaveBeenCalledOnce()
      expect(queryClient.getQueryCache().findAll()).toHaveLength(0)
    })
  })
})
