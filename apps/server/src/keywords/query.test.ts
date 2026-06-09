/**
 * query.test.ts
 * Unit tests for the active keyword registry query.
 *
 * Verifies that getActiveKeywords(districtId) calls
 * prisma.keyword.findMany({ where: { district_id, is_active: true }, orderBy: { id: 'asc' } })
 * and returns only active phrases in a stable, deterministic order.
 *
 * Story 1.4 — Task 2, Subtask 2.3 / AC #4, #5
 * CR patch: orderBy added (code review finding #2 — deterministic first-match-wins ordering)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Mock env (required by db.ts import chain)
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../shared/env.js', () => ({
  env: {
    DATABASE_URL:            'postgresql://mock',
    NODE_ENV:                'test',
    PORT:                    3001,
    BOT_TOKEN:               'mock-bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'mock-secret',
    FILTER_MODE:             'ai_full',
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Mock Prisma client
// ─────────────────────────────────────────────────────────────────────────────
const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}))

vi.mock('../shared/db.js', () => ({
  prisma: {
    keyword: { findMany: mockFindMany },
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// 3. Import module under test after mocks are set up
// ─────────────────────────────────────────────────────────────────────────────
import { getActiveKeywords } from './query.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────
const baseKeyword = {
  id:         1,
  district_id: 10,
  phrase:     'suv',
  is_active:  true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
}

describe('getActiveKeywords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls prisma.keyword.findMany with district_id, is_active:true, and orderBy id asc', async () => {
    mockFindMany.mockResolvedValue([])

    await getActiveKeywords(10)

    expect(mockFindMany).toHaveBeenCalledOnce()
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        district_id: 10,
        is_active:   true,
      },
      orderBy: { id: 'asc' },
    })
  })

  it('orderBy id:asc ensures deterministic first-match-wins ordering', async () => {
    mockFindMany.mockResolvedValue([])

    await getActiveKeywords(10)

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.orderBy).toEqual({ id: 'asc' })
  })

  it('returns only active keywords for the given district', async () => {
    const activeKeywords = [
      { ...baseKeyword, id: 1, phrase: 'suv' },
      { ...baseKeyword, id: 2, phrase: 'gaz' },
    ]
    mockFindMany.mockResolvedValue(activeKeywords)

    const result = await getActiveKeywords(10)

    expect(result).toHaveLength(2)
    expect(result[0].phrase).toBe('suv')
    expect(result[1].phrase).toBe('gaz')
    expect(result.every(k => k.is_active)).toBe(true)
  })

  it('returns empty array when no active keywords exist for district', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await getActiveKeywords(99)

    expect(result).toEqual([])
  })

  it('does NOT call findMany with is_active:false (inactive keywords must not be included)', async () => {
    mockFindMany.mockResolvedValue([])

    await getActiveKeywords(10)

    // The where clause must not include is_active:false or omit is_active entirely
    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.is_active).toBe(true)
  })

  it('uses the correct districtId passed to the function', async () => {
    mockFindMany.mockResolvedValue([])

    await getActiveKeywords(42)

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs.where.district_id).toBe(42)
  })
})
