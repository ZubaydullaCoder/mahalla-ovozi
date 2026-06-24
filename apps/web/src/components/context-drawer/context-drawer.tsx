// apps/web/src/components/context-drawer/context-drawer.tsx
// Overlay drawer showing corroborating signals for a clicked signal.
// DO NOT: push mode, global Escape listener, destroyOnClose, refetchInterval.
import { useRef, useEffect } from 'react'
import { Drawer, Skeleton, theme } from 'antd'
import { useSignalContext } from '../../api/signals.ts'
import { DrawerSignalCard } from './drawer-signal-card.tsx'
import { CATEGORY_COLORS } from '../../theme.ts'
import { strings } from '../../strings.ts'
import type { Signal } from '../../api/signals.ts'

// Uzbek Cyrillic service category names for breadcrumb.
// NOTE: 'hokim' is NOT a Signal.category value — signals always carry a service category.
// hokimRelated signals use their actual category (gas, water, etc.) in the breadcrumb — NOT 'Ҳокимга тегишли' (AC-2).
const CATEGORY_LABELS: Record<Signal['category'], string> = {
  water:       strings.dashboard.lanes.water,
  electricity: strings.dashboard.lanes.electricity,
  gas:         strings.dashboard.lanes.gas,
  waste:       strings.dashboard.lanes.waste,
}

// Format a Date as HH:MM in UTC+5. Captured once at click time — NOT recomputed on re-render.
function formatUTC5Time(date: Date): string {
  const utc5 = new Date(date.getTime() + 5 * 3600000)
  const hh = String(utc5.getUTCHours()).padStart(2, '0')
  const mm = String(utc5.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Build breadcrumb: CategoryName · MahallaName · HH:MM (AC-2)
function buildBreadcrumb(signal: Signal, clickedAt: Date | null): string {
  const categoryName = CATEGORY_LABELS[signal.category]
  const clickTime = clickedAt ? formatUTC5Time(clickedAt) : ''
  return `${categoryName} · ${signal.mahallaName} · ${clickTime}`
}

export interface ContextDrawerProps {
  anchorSignal: Signal | null
  anchorClickedAt: Date | null
  isOpen: boolean
  onClose: () => void
  onAfterOpenChange?: (open: boolean) => void
  contextParams?: { from?: string; to?: string }
}

export function ContextDrawer({
  anchorSignal,
  anchorClickedAt,
  isOpen,
  onClose,
  onAfterOpenChange,
  contextParams,
}: ContextDrawerProps) {
  const { token } = theme.useToken()
  const anchorRef = useRef<HTMLDivElement | null>(null)

  // Call with computedApiParams forwarded from DashboardPage (AC-11)
  const { data: contextSignals = [], isLoading } = useSignalContext(
    anchorSignal?.id ?? null,
    contextParams,
  )

  // Scroll anchor to center when context data loads (AC-4)
  useEffect(() => {
    if (!isLoading && anchorRef.current) {
      anchorRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [isLoading, anchorSignal?.id])

  // Only-anchor empty state: context returned only the clicked signal (AC-9)
  const isOnlyAnchor =
    contextSignals.length === 1 &&
    anchorSignal !== null &&
    contextSignals[0]?.id === anchorSignal.id

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      afterOpenChange={onAfterOpenChange}
      placement="right"
      title={anchorSignal ? buildBreadcrumb(anchorSignal, anchorClickedAt) : ''}
      className="context-drawer"
      // AntD v6: styles.mask replaces legacy maskStyle (AC-1)
      styles={{ mask: { background: 'rgba(15,12,10,0.06)' } }}
      // Keep mounted so 4.5 card-swap stays smooth; do NOT use destroyOnClose (AC-7 note)
      destroyOnHidden={false}
    >
      {isLoading ? (
        // 3-row skeleton while context resolves (AC-3)
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <>
          {/* Context signals in ascending chronological order — oldest at top (AC-3) */}
          {contextSignals.map((signal) => (
            <div
              key={signal.id}
              ref={signal.id === anchorSignal?.id ? anchorRef : undefined}
            >
              <DrawerSignalCard
                signal={signal}
                isActive={signal.id === anchorSignal?.id}
                categoryColor={CATEGORY_COLORS[signal.category]}
              />
            </div>
          ))}
          {/* Only-anchor empty state (AC-9) — anchor is still shown above */}
          {isOnlyAnchor && (
            <div style={{ fontSize: 12, color: token.colorTextPlaceholder, padding: '8px 0' }}>
              {strings.drawer.onlyAnchorMessage}
            </div>
          )}
        </>
      )}
    </Drawer>
  )
}
