import type { ReactNode } from 'react'
import { message, theme } from 'antd'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { logout } from '../api/auth.ts'
import { strings } from '../strings.ts'

interface AppShellProps {
  filterBar?: ReactNode       // Slot for FilterBar (Dashboard) or Segmented nav (Ops)
  children: ReactNode        // Slot for LaneGrid or Ops panel content
  showOpsLink?: boolean      // When true, renders an "Ops" nav button before the logout button
  contentOverflow?: 'hidden' | 'auto' // Content zone overflow; defaults to 'hidden' (dashboard)
  additionalLogoutQueryClients?: QueryClient[] // Extra isolated caches to clear on logout
}

// Logo SVG — chat-bubble icon matching Mahalla Ovozi brand (adapted from reference)
function LogoIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#EFF6FF" />
      <path
        d="M20 8C14.48 8 10 12.48 10 18C10 21.12 11.48 23.9 13.74 25.74L12 32L18.26 30.26C18.82 30.42 19.4 30.5 20 30.5C25.52 30.5 30 26.02 30 20.5C30 14.98 25.52 10.5 20 10.5"
        stroke="#2563EB"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 18H24M16 22H21"
        stroke="#2563EB"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Logout icon SVG
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 11.5L14 8L10.5 4.5M14 8H6M6 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H6"
        stroke="#64748B"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AppShell({
  filterBar,
  children,
  showOpsLink,
  contentOverflow,
  additionalLogoutQueryClients = [],
}: AppShellProps) {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function handleLogout() {
    try {
      await logout()
      queryClient.clear()
      additionalLogoutQueryClients.forEach((client) => {
        if (client !== queryClient) client.clear()
      })
      navigate('/login', { replace: true })
    } catch {
      message.error(strings.app.logoutError)
    }
  }

  return (
    <div className="app-shell">
      {/* Header: logo + filter bar + logout */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: 56,
          zIndex: 10,
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
        }}
      >
        {/* Logo: icon + wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 700,
            fontSize: 16,
            color: token.colorText,
            flexShrink: 0,
          }}
        >
          <LogoIcon />
          {strings.app.title}
        </div>

        {/* Vertical separator */}
        <div
          style={{
            width: 1,
            height: 20,
            background: token.colorBorder,
            flexShrink: 0,
          }}
        />

        {/* Filter bar slot — fills remaining space */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {filterBar}
        </div>

        {/* Ops nav link — visible only when showOpsLink is true (Dashboard → Ops) */}
        {showOpsLink && (
          <button
            id="header-ops-link"
            type="button"
            onClick={() => navigate('/ops')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              border: `1px solid ${token.colorBorder}`,
              borderRadius: token.borderRadius,
              background: token.colorBgElevated,
              fontSize: 13,
              fontWeight: 500,
              color: token.colorTextSecondary,
              cursor: 'pointer',
              fontFamily: token.fontFamily,
              transition: 'background 150ms, color 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = token.colorBgLayout
              e.currentTarget.style.color = token.colorText
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = token.colorBgElevated
              e.currentTarget.style.color = token.colorTextSecondary
            }}
          >
            Ops
          </button>
        )}

        {/* Logout button — styled per reference */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label={strings.app.logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadius,
            background: token.colorBgElevated,
            fontSize: 13,
            fontWeight: 500,
            color: token.colorTextSecondary,
            cursor: 'pointer',
            fontFamily: token.fontFamily,
            transition: 'background 150ms, color 150ms',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget
            btn.style.background = token.colorBgLayout
            btn.style.color = token.colorText
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget
            btn.style.background = token.colorBgElevated
            btn.style.color = token.colorTextSecondary
          }}
        >
          <LogoutIcon />
          {strings.app.logout}
        </button>
      </div>

      {/* Content zone — fills remaining viewport height; overflow controlled by caller */}
      <div
        style={{
          height: 'calc(100vh - 56px)',
          overflow: contentOverflow ?? 'hidden',
          background: token.colorBgLayout,
        }}
      >
        {children}
      </div>
    </div>
  )
}
