// apps/web/src/components/context-drawer/drawer-signal-card.tsx
// Non-interactive, full-text card for use inside the ContextDrawer.
// DO NOT add onClick, onKeyDown, WebkitLineClamp, or tabIndex — this is intentional.
import { theme } from 'antd'
import type { Signal } from '../../api/signals.ts'

export interface DrawerSignalCardProps {
  signal: Signal
  isActive: boolean
  categoryColor: string // hex — always service category color
}

// Sender fallback chain: displayName → @username → Резидент
function getSenderName(signal: Signal): string {
  if (signal.senderDisplayName) return signal.senderDisplayName
  if (signal.senderUsername) return `@${signal.senderUsername}`
  return 'Резидент'
}

// UTC+5 HH:MM absolute timestamp — consistent with DrawerSignalCard context
function formatTimestamp(isoString: string): string {
  const now = new Date()
  const ts = new Date(isoString)
  const diffMs = now.getTime() - ts.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)

  if (diffMs < 0) {
    // Future timestamp (clock skew) — show absolute UTC+5
    const utc5 = new Date(ts.getTime() + 5 * 3600000)
    const hh = String(utc5.getUTCHours()).padStart(2, '0')
    const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  if (diffHr < 1 && diffMin < 60) {
    return `${diffMin} дақ. олдин`
  }
  if (diffMs <= 24 * 3600000) {
    return `${diffHr} соат олдин`
  }
  // >24h — show HH:MM absolute (UTC+5 local)
  const utc5 = new Date(ts.getTime() + 5 * 3600000)
  const hh = String(utc5.getUTCHours()).padStart(2, '0')
  const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function DrawerSignalCard({ signal, isActive, categoryColor }: DrawerSignalCardProps) {
  const { token } = theme.useToken()
  const senderName = getSenderName(signal)
  const timestamp = formatTimestamp(signal.telegramTimestamp)

  const bgColor = isActive
    ? `${categoryColor}0D` // categoryColor at ~5% opacity (hex: 0D ≈ 5%)
    : token.colorBgElevated

  const borderLeft = isActive ? `4px solid ${categoryColor}` : `4px solid transparent`

  const hasFooter = signal.textSource === 'caption' || signal.hokimRelated

  return (
    <div
      role="article"
      // No tabIndex — drawer cards are non-interactive (Story 4.5 handles card swap)
      // No onClick, onKeyDown — intentional per AC-6
      style={{
        borderLeft,
        borderRadius: token.borderRadius,
        background: bgColor,
        boxShadow: isActive ? '0 2px 10px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'default', // non-interactive
        padding: '12px 14px',
        marginBottom: 4,
      }}
    >
      {/* Row 1: sender + timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText, lineHeight: 1.4 }}>
          {senderName}
        </span>
        <span style={{ fontSize: 11, color: token.colorTextSecondary, flexShrink: 0, marginLeft: 8 }}>
          {timestamp}
        </span>
      </div>

      {/* Row 2: mahalla */}
      <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>
        {signal.mahallaName}
      </div>

      {/* Row 3: full raw text — NO WebkitLineClamp (AC-6) */}
      <div
        style={{
          fontSize: 13,
          color: token.colorText,
          lineHeight: 1.5,
          marginBottom: hasFooter ? 6 : 0,
          // Full text intentionally — no overflow hidden
        }}
      >
        {signal.rawText}
      </div>

      {/* Footer: CaptionBadge (📷) + HokimStar (★) */}
      {hasFooter && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {signal.textSource === 'caption' && (
            <span
              role="img"
              aria-label="Расм тавсифи"
              style={{ fontSize: 11, color: token.colorTextPlaceholder }}
            >
              📷
            </span>
          )}
          {signal.hokimRelated && (
            <span aria-hidden="true" style={{ fontSize: 12, color: token.colorWarning }}>
              ★
            </span>
          )}
        </div>
      )}
    </div>
  )
}
