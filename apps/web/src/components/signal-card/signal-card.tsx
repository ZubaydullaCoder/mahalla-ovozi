// apps/web/src/components/signal-card/signal-card.tsx
import { theme, Tooltip } from 'antd'
import type { Signal } from '../../api/signals.ts'
import { formatSignalTimestamp, getSignalSenderName } from '../../utils/signal-display.ts'
import { signalCardStyles, activeHoverBoxShadow } from './signal-card-styles.ts'

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

  const hasFooter = signal.textSource === 'caption' || signal.hokimRelated

  const styles = signalCardStyles({ isActive, categoryColor, hasFooter, token })

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
      style={styles.card}
      onMouseEnter={(e) => {
        if (isActive) {
          ;(e.currentTarget as HTMLDivElement).style.boxShadow =
            activeHoverBoxShadow(categoryColor)
        }
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = styles.card.boxShadow as string
        ;(e.currentTarget as HTMLDivElement).style.transform = ''
      }}
    >
      {/* Card Header & Metadata */}
      {!signal.aiSummary ? (
        <>
          {/* Row 1: sender + timestamp */}
          <div style={styles.headerRow}>
            <Tooltip title={isTruncated ? senderName : undefined} placement="top">
              <span style={styles.senderName}>{displaySender}</span>
            </Tooltip>
            <span style={styles.timestamp}>{timestamp}</span>
          </div>

          {/* Row 2: mahalla */}
          <div style={styles.mahalla}>{signal.mahallaName}</div>
        </>
      ) : (
        /* Senders are mentioned in the summary, so we show only mahalla and timestamp in header to prevent redundancy */
        <div style={styles.mahallaWithTimestamp}>
          <span style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 500 }}>
            {signal.mahallaName}
          </span>
          <span style={styles.mahallaTimestamp}>{timestamp}</span>
        </div>
      )}

      {/* Row 3: summary (AI-generated) or raw text fallback (3-line clamp) */}
      <div style={styles.bodyText}>
        {(() => {
          if (signal.aiSummary) {
            const suffix = ' исмли гуруҳ аъзоси'
            const suffixIdx = signal.aiSummary.indexOf(suffix)
            if (suffixIdx !== -1) {
              const senderName = signal.aiSummary.substring(0, suffixIdx)
              const rest = signal.aiSummary.substring(suffixIdx)
              return (
                <>
                  <span style={styles.senderHighlight}>{senderName}</span>
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
        <div style={styles.footer}>
          {signal.textSource === 'caption' && (
            <span
              role="img"
              aria-label="Расм тавсифи"
              style={styles.captionBadge}
            >
              📷
            </span>
          )}
          {signal.hokimRelated && (
            <span aria-hidden="true" style={styles.hokimStar}>
              ★
            </span>
          )}
        </div>
      )}
    </div>
  )
}
