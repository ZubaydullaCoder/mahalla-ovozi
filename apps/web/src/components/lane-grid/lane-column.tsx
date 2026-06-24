// apps/web/src/components/lane-grid/lane-column.tsx
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { theme, Badge } from 'antd'
import { strings } from '../../strings.ts'
import { CATEGORY_COLORS } from '../../theme.ts'
import { SignalCard } from '../signal-card/signal-card.tsx'
import type { Signal } from '../../api/signals.ts'

export type LaneKey = 'hokim' | 'water' | 'electricity' | 'gas' | 'waste'

const LANE_LABELS: Record<LaneKey, string> = {
  hokim:       strings.dashboard.lanes.hokim,
  water:       strings.dashboard.lanes.water,
  electricity: strings.dashboard.lanes.electricity,
  gas:         strings.dashboard.lanes.gas,
  waste:       strings.dashboard.lanes.waste,
}

function getLaneLabel(key: LaneKey): string {
  return LANE_LABELS[key]
}

const VIRTUALIZE_THRESHOLD = 50

export interface LaneColumnProps {
  laneKey: LaneKey
  signals: Signal[]
  activeSignalId?: number | null  // which signal card is currently highlighted
  onCardClick: (signal: Signal) => void
  isKeywordSearch?: boolean   // when true, shows keyword-search-specific empty state
  isDrawerOpen?: boolean      // when true, freeze scroll (AC-8)
}

function EmptyLane({
  token,
  isKeywordSearch,
}: {
  token: ReturnType<typeof theme.useToken>['token']
  isKeywordSearch?: boolean
}) {
  const message = isKeywordSearch
    ? strings.dashboard.searchEmptyLane
    : strings.dashboard.emptyLane
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px 16px',
        gap: 8,
      }}
    >
      {/* Muted icon — 28px, 35% opacity */}
      <span
        aria-hidden="true"
        style={{ fontSize: 28, opacity: 0.35, lineHeight: 1 }}
      >
        {isKeywordSearch ? '🔍' : '📭'}
      </span>
      <span
        style={{
          fontSize: 12,
          color: token.colorTextPlaceholder,
          textAlign: 'center',
        }}
      >
        {message}
      </span>
    </div>
  )
}

export function LaneColumn({ laneKey, signals, activeSignalId, onCardClick, isKeywordSearch, isDrawerOpen }: LaneColumnProps) {
  const { token } = theme.useToken()
  const parentRef = useRef<HTMLDivElement>(null)

  // Always call useVirtualizer — conditionally render virtual vs non-virtual below
  const virtualizer = useVirtualizer({
    count: signals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated card height in px
    overscan: 5,
  })

  const laneLabel = getLaneLabel(laneKey)
  const useVirtual = signals.length > VIRTUALIZE_THRESHOLD

  return (
    <div
      className="lane-column"
      role="feed"
      aria-label={laneLabel}
    >
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorder}`,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>
          {laneLabel}
        </span>
        <Badge count={signals.length} showZero style={{ backgroundColor: token.colorPrimary }} />
      </div>

      {/* Lane body */}
      <div
        ref={parentRef}
        style={{
          flex: 1,
          // Freeze lane scroll while drawer is open; browser preserves scroll position (AC-8)
          overflowY: isDrawerOpen ? 'hidden' : 'auto',
          padding: '8px 0',
        }}
      >
        {signals.length === 0 ? (
          <EmptyLane token={token} isKeywordSearch={isKeywordSearch} />
        ) : useVirtual ? (
          /* Virtual scroll — when signals > 50 */
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const signal = signals[item.index]!
              return (
                <div
                  key={item.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${item.start}px)`,
                    padding: '4px 8px',
                  }}
                >
                  <SignalCard
                    signal={signal}
                    isActive={signal.id === activeSignalId}
                    categoryColor={CATEGORY_COLORS[signal.category]}
                    onClick={onCardClick}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          /* Non-virtual — when signals ≤ 50 */
          signals.map((signal) => (
            <div key={signal.id} style={{ padding: '4px 8px' }}>
              <SignalCard
                signal={signal}
                isActive={signal.id === activeSignalId}
                categoryColor={CATEGORY_COLORS[signal.category]}
                onClick={onCardClick}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
