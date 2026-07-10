// apps/web/src/utils/group-signals.ts
import type { Signal } from '../api/signals.ts'
import type { SignalsByCategory } from '../components/lane-grid/lane-grid.tsx'

/**
 * Group raw Signal[] into 5 lanes.
 * Hokim lane duplication: signals with hokimRelated === true appear in BOTH
 * their service lane AND the hokim lane (same object reference — not a copy).
 */
export function groupSignals(signals: Signal[]): SignalsByCategory {
  const lanes: SignalsByCategory = {
    hokim:       [],
    water:       [],
    electricity: [],
    gas:         [],
    waste:       [],
  }

  for (const signal of signals) {
    if (signal.category in lanes) {
      lanes[signal.category].push(signal)
    }
    if (signal.hokimRelated) {
      lanes.hokim.push(signal)
    }
  }

  return lanes
}
