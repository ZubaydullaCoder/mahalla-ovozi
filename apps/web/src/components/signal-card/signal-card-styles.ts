// apps/web/src/components/signal-card/signal-card-styles.ts
// Centralises all computed style objects for SignalCard.
// Keeping styles out of the JSX makes the layout logic in signal-card.tsx
// easier to scan and keeps each concern in one place.

import type { GlobalToken } from 'antd'

export interface SignalCardStyleOptions {
  isActive: boolean
  categoryColor: string
  hasFooter: boolean
  token: GlobalToken
}

export interface SignalCardStyles {
  card: React.CSSProperties
  headerRow: React.CSSProperties
  senderName: React.CSSProperties
  timestamp: React.CSSProperties
  mahalla: React.CSSProperties
  mahallaWithTimestamp: React.CSSProperties
  mahallaTimestamp: React.CSSProperties
  bodyText: React.CSSProperties
  footer: React.CSSProperties
  captionBadge: React.CSSProperties
  hokimStar: React.CSSProperties
  senderHighlight: React.CSSProperties
}

export function signalCardStyles({
  isActive,
  categoryColor,
  hasFooter,
  token,
}: SignalCardStyleOptions): SignalCardStyles {
  const border = isActive
    ? `1.5px solid ${categoryColor}`
    : '1.5px solid #E2E8F0'

  const bgColor = isActive
    ? `${categoryColor}0D`   // ~5% opacity (hex 0D ≈ 5%)
    : token.colorBgElevated

  const boxShadow = isActive
    ? `0 0 0 2px ${categoryColor}1F, 0 2px 10px rgba(0,0,0,0.10)`
    : '0 1px 3px rgba(0,0,0,0.06)'

  return {
    card: {
      border,
      borderRadius: token.borderRadius,
      background: bgColor,
      boxShadow,
      cursor: 'pointer',
      padding: '12px',      // overridden by responsive CSS at 1024–1279px
      marginBottom: 4,
      transition: 'box-shadow 0.15s ease, transform 0.10s ease, border-color 0.15s ease',
      outline: undefined,   // keyboard focus: visible browser outline, no outline:none
    },

    // Header layout when no AI summary (sender + timestamp row)
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 2,
    },

    senderName: {
      fontSize: 13,
      fontWeight: 600,
      color: token.colorText,
      lineHeight: 1.4,
    },

    timestamp: {
      fontSize: 11,
      color: token.colorTextSecondary,
      flexShrink: 0,
      marginLeft: 8,
    },

    mahalla: {
      fontSize: 12,
      color: token.colorTextSecondary,
      marginBottom: 4,
    },

    // Header layout when AI summary present (mahalla + timestamp in one row)
    mahallaWithTimestamp: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 4,
    },

    mahallaTimestamp: {
      fontSize: 11,
      color: token.colorTextSecondary,
      flexShrink: 0,
      marginLeft: 8,
    },

    bodyText: {
      fontSize: 13,
      color: token.colorText,
      lineHeight: 1.5,
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      marginBottom: hasFooter ? 6 : 0,
    },

    footer: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
    },

    captionBadge: {
      fontSize: 11,
      color: token.colorTextPlaceholder,
    },

    hokimStar: {
      fontSize: 12,
      color: token.colorWarning,
    },

    // Inline sender highlight inside AI summary text
    senderHighlight: {
      color: '#24a1de',
      fontWeight: 600,
    },
  }
}

/** Returns the hover box-shadow for an active card (used in onMouseEnter). */
export function activeHoverBoxShadow(categoryColor: string): string {
  return `0 0 0 2px ${categoryColor}1F, 0 4px 12px rgba(0,0,0,0.12)`
}
