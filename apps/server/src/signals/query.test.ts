// apps/server/src/signals/query.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock env before any module import ───────────────────────────────────────
const mockEnv = vi.hoisted(() => ({
  DATABASE_URL:            'postgresql://test:test@localhost:5432/test',
  NODE_ENV:                'test' as const,
  PORT:                    3001,
  BOT_TOKEN:               'test-token',
  TELEGRAM_WEBHOOK_SECRET: 'test-secret',
  FILTER_MODE:             'keyword_gate' as const,
  AI_API_KEY:              'test-key',
  AI_MODEL:                'gemini-2.5-flash',
  SESSION_SECRET:          'test-session-secret',
}))

vi.mock('../shared/env.js', () => ({ env: mockEnv }))

// ─── Mock prisma — do not hit a real database ─────────────────────────────────
const mockFindMany = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    signalMessage: {
      findMany: mockFindMany,
    },
  },
}))

import { getTodayUTC5Range, querySignals } from './query.js'

// ─── getTodayUTC5Range ────────────────────────────────────────────────────────

describe('getTodayUTC5Range', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns UTC+5 same-day range (morning UTC, still same UTC+5 day)', () => {
    // UTC 10:30 → UTC+5 15:30 on 2026-06-14 (same day)
    // UTC+5 midnight for 2026-06-14 = 2026-06-13T19:00:00.000Z
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T10:30:00.000Z'))

    const { from, to } = getTodayUTC5Range()

    expect(from.toISOString()).toBe('2026-06-13T19:00:00.000Z')
    expect(to.toISOString()).toBe('2026-06-14T10:30:00.000Z')
  })

  it('returns UTC+5 rollover boundary (late UTC, next UTC+5 day)', () => {
    // UTC 19:30 → UTC+5 00:30 on 2026-06-15 (next UTC+5 day)
    // UTC+5 midnight for 2026-06-15 = 2026-06-14T19:00:00.000Z
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T19:30:00.000Z'))

    const { from, to } = getTodayUTC5Range()

    expect(from.toISOString()).toBe('2026-06-14T19:00:00.000Z')
    expect(to.toISOString()).toBe('2026-06-14T19:30:00.000Z')
  })

  it('returns "to" equal to the mocked "now"', () => {
    vi.useFakeTimers()
    const now = new Date('2026-06-14T12:00:00.000Z')
    vi.setSystemTime(now)

    const { to } = getTodayUTC5Range()
    expect(to.toISOString()).toBe(now.toISOString())
  })
})

// ─── querySignals ─────────────────────────────────────────────────────────────

describe('querySignals', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it('calls prisma.signalMessage.findMany with correct where, include, and orderBy', async () => {
    mockFindMany.mockResolvedValueOnce([])

    const from = new Date('2026-06-13T19:00:00.000Z')
    const to   = new Date('2026-06-14T10:30:00.000Z')

    await querySignals(42, from, to)

    expect(mockFindMany).toHaveBeenCalledOnce()
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        district_id: 42,
        telegram_timestamp: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [
        { telegram_timestamp: 'desc' },
        { id: 'desc' },
      ],
      include: {
        mahalla: {
          select: {
            name: true,
            telegram_chat_id: true,
          },
        },
      },
    })
  })

  it('passes district_id from the districtId argument, not from anywhere else', async () => {
    mockFindMany.mockResolvedValueOnce([])

    const from = new Date('2026-06-13T19:00:00.000Z')
    const to   = new Date('2026-06-14T10:30:00.000Z')

    await querySignals(99, from, to)

    const call = mockFindMany.mock.calls[0]?.[0] as { where: { district_id: number } }
    expect(call.where.district_id).toBe(99)
  })

  it('returns the results from prisma.signalMessage.findMany', async () => {
    const mockRows = [{ id: 1 }, { id: 2 }]
    mockFindMany.mockResolvedValueOnce(mockRows)

    const result = await querySignals(1, new Date(), new Date())
    expect(result).toStrictEqual(mockRows)
  })
})
