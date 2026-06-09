/**
 * query.ts
 * Read-only active keyword registry query.
 *
 * Architecture AR15: `keywords/` owns read-only keyword access.
 * `ops/` will own keyword CRUD (Story 6.4) — nothing in this file mutates.
 *
 * Story 1.4 — Task 2
 */
import { prisma } from '../shared/db.js'
import type { Keyword } from '../generated/prisma/client.js'

/**
 * Returns all active keywords for the given district, ordered by insertion order (id ASC).
 * Stable ordering is required: matcher is first-match-wins, so without ORDER BY the matched
 * phrase is nondeterministic when multiple keywords match the same message text.
 * Uses the composite index `@@index([district_id, is_active])` for efficiency.
 */
export async function getActiveKeywords(districtId: number): Promise<Keyword[]> {
  return prisma.keyword.findMany({
    where: {
      district_id: districtId,
      is_active:   true,
    },
    orderBy: { id: 'asc' },
  })
}
