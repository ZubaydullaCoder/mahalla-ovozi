// apps/web/src/components/signal-card/signal-card.tsx
import { theme, Tooltip } from 'antd'
import type { Signal } from '../../api/signals.ts'
import { formatSignalTimestamp, getSignalSenderName } from '../../utils/signal-display.ts'

export interface SignalCardProps {
  signal: Signal
  isActive: boolean
  categoryColor: string   // hex — ALWAYS service category color, never hokim lane color
  onClick: (signal: Signal) => void
}

const SENDER_TRUNCATE_LEN = 30

export function SignalCard({ signal, isActive, categoryColor, onClick }: SignalCardProps) {
  const { token } = theme.useToken()
  const senderName = getSignalSenderName(signal)
  const isTruncated = senderName.length > SENDER_TRUNCATE_LEN
  const displaySender = isTruncated ? `${senderName.slice(0, SENDER_TRUNCATE_LEN)}…` : senderName
  const timestamp = formatSignalTimestamp(signal.telegramTimestamp)

  // Active state: category-tinted background + colored border
  // Inactive state: white background + light gray border (matches reference signal-card)
  const bgColor = isActive
    ? `${categoryColor}0D`  // categoryColor at ~5% opacity (hex: 0D ≈ 5%)
    : token.colorBgElevated

  const border = isActive
    ? `1.5px solid ${categoryColor}`
    : `1.5px solid #E2E8F0`

  const boxShadow = isActive
    ? `0 0 0 2px ${categoryColor}1F, 0 2px 10px rgba(0,0,0,0.10)` // ring + shadow
    : '0 1px 3px rgba(0,0,0,0.06)'

  const hasFooter = signal.textSource === 'caption' || signal.hokimRelated

  return (
    <div
      className="signal-card"
      role="article"
      tabIndex={0}
      aria-label={`${senderName}, ${signal.mahallaName}, ${timestamp}`}
      onClick={() => onClick(signal)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(signal)
        }
      }}
      style={{
        // Full border (not left-only) — matches reference signal-card style
        border,
        borderRadius: token.borderRadius,
        background: bgColor,
        boxShadow,
        cursor: 'pointer',
        padding: '12px', // overridden by responsive CSS at 1024–1279px
        marginBottom: 4,
        transition: 'box-shadow 0.15s ease, transform 0.10s ease, border-color 0.15s ease',
        // Keyboard focus: visible 2px outline, no outline:none
        outline: undefined,
      }}
      onMouseEnter={(e) => {
        // Hover lift handled by CSS (.signal-card:hover); box-shadow here for active override
        if (isActive) {
          ;(e.currentTarget as HTMLDivElement).style.boxShadow =
            `0 0 0 2px ${categoryColor}1F, 0 4px 12px rgba(0,0,0,0.12)`
        }
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = boxShadow
        ;(e.currentTarget as HTMLDivElement).style.transform = ''
      }}
    >
      {/* Card Header & Metadata */}
      {!signal.aiSummary ? (
        <>
          {/* Row 1: sender + timestamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <Tooltip title={isTruncated ? senderName : undefined} placement="top">
              <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText, lineHeight: 1.4 }}>
                {displaySender}
              </span>
            </Tooltip>
            <span style={{ fontSize: 11, color: token.colorTextSecondary, flexShrink: 0, marginLeft: 8 }}>
              {timestamp}
            </span>
          </div>

          {/* Row 2: mahalla */}
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }}>
            {signal.mahallaName}
          </div>
        </>
      ) : (
        /* Senders are mentioned in the summary, so we show only mahalla and timestamp in header to prevent redundancy */
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 500 }}>
            {signal.mahallaName}
          </span>
          <span style={{ fontSize: 11, color: token.colorTextSecondary, flexShrink: 0, marginLeft: 8 }}>
            {timestamp}
          </span>
        </div>
      )}

      {/* Row 3: summary (AI-generated) or raw text fallback (3-line clamp) */}
      <div
        style={{
          fontSize: 13,
          color: token.colorText,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginBottom: hasFooter ? 6 : 0,
        }}
      >
        {(() => {
          if (signal.aiSummary) {
            const suffix = ' исмли гуруҳ аъзоси'
            const suffixIdx = signal.aiSummary.indexOf(suffix)
            if (suffixIdx !== -1) {
              const senderName = signal.aiSummary.substring(0, suffixIdx)
              const rest = signal.aiSummary.substring(suffixIdx)
              return (
                <>
                  <span style={{ color: '#24a1de', fontWeight: 600 }}>{senderName}</span>
                  {rest}
                </>
              )
            }
          }
          return signal.aiSummary ?? signal.rawText
        })()}
      </div>

      {/* Footer: CaptionBadge + HokimStar */}
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
