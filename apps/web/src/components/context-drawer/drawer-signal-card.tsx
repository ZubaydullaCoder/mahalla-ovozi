// apps/web/src/components/context-drawer/drawer-signal-card.tsx
// Non-interactive, full-text card for use inside the ContextDrawer.
// DO NOT add onClick, onKeyDown, WebkitLineClamp, or tabIndex — this is intentional.
import { theme } from 'antd'
import type { Signal } from '../../api/signals.ts'
import { formatSignalTimestamp, getSignalSenderName } from '../../utils/signal-display.ts'

export interface DrawerSignalCardProps {
  signal: Signal
  isActive: boolean
  categoryColor: string // hex — always service category color
}

export function DrawerSignalCard({ signal, isActive, categoryColor }: DrawerSignalCardProps) {
  const { token } = theme.useToken()
  const senderName = getSignalSenderName(signal)
  const timestamp = formatSignalTimestamp(signal.telegramTimestamp)

  const bgColor = isActive
    ? `${categoryColor}0D` // categoryColor at ~5% opacity (hex: 0D ≈ 5%)
    : token.colorBgElevated

  const borderLeft = isActive ? `4px solid ${categoryColor}` : `4px solid transparent`

  const hasFooter = signal.textSource === 'caption' || signal.hokimRelated || signal.telegramMessageUrl

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

      {/* Footer: source markers + Telegram link */}
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
          {signal.telegramMessageUrl && (
            <a
              href={signal.telegramMessageUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12 }}
            >
              Telegram
            </a>
          )}
        </div>
      )}
    </div>
  )
}
