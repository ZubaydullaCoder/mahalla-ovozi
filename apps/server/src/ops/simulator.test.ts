// apps/server/src/ops/simulator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── vi.hoisted mocks — must be declared before any imports ───────────────────

const mockDistrictFindFirst       = vi.hoisted(() => vi.fn())
const mockMahallaFindUnique       = vi.hoisted(() => vi.fn())
const mockRawMessageFindFirst     = vi.hoisted(() => vi.fn())
const mockRawMessageCreate        = vi.hoisted(() => vi.fn())
const mockPipelineEventFindFirst  = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    district:      { findFirst: mockDistrictFindFirst },
    mahalla:       { findUnique: mockMahallaFindUnique },
    rawMessage:    { findFirst: mockRawMessageFindFirst, create: mockRawMessageCreate },
    pipelineEvent: { findFirst: mockPipelineEventFindFirst },
  },
}))

vi.mock('../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Mock pipeline so we don't need the full bot setup
const mockPipeline = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../bot/filters/pipeline.js', () => ({ pipeline: mockPipeline }))

// Import AFTER mocks
import {
  nextSimulatedId,
  resetSimulatedIdCounterForTest,
  simulateWebhook,
  injectSimulatedMessage,
} from './simulator.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACTIVE_DISTRICT = { id: 1, is_active: true }
const MAHALLA_IN_DISTRICT = { district_id: 1, telegram_chat_id: BigInt(1001) }
const MAHALLA_OTHER_DISTRICT = { district_id: 2, telegram_chat_id: BigInt(2001) }

// ─── nextSimulatedId ─────────────────────────────────────────────────────────

describe('nextSimulatedId()', () => {
  beforeEach(() => {
    resetSimulatedIdCounterForTest()
  })

  it('returns unique, decrementing negative integers across calls', () => {
    // We can't control the global counter state from outside since it starts at -1
    // and other tests may have consumed IDs; instead we validate three consecutive
    // calls produce three strictly descending negative integers.
    const a = nextSimulatedId()
    const b = nextSimulatedId()
    const c = nextSimulatedId()

    expect(a).toBeLessThan(0)
    expect(b).toBeLessThan(a)
    expect(c).toBeLessThan(b)

    // Each decrement is exactly -1
    expect(b - a).toBe(-1)
    expect(c - b).toBe(-1)
  })

  it('always returns negative values', () => {
    for (let i = 0; i < 10; i++) {
      expect(nextSimulatedId()).toBeLessThan(0)
    }
  })
})

// ─── injectSimulatedMessage() ─────────────────────────────────────────────────

describe('injectSimulatedMessage()', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    resetSimulatedIdCounterForTest()
    mockDistrictFindFirst.mockResolvedValue(ACTIVE_DISTRICT)
    mockMahallaFindUnique.mockResolvedValue(MAHALLA_IN_DISTRICT)
    mockRawMessageFindFirst.mockResolvedValue(null)
    mockRawMessageCreate.mockResolvedValue({ id: 42 })
  })

  it('returns the rawMessageId from the created row', async () => {
    const result = await injectSimulatedMessage({ mahallaId: 1, text: 'Suv yo\'q' })
    expect(result).toBe(42)
  })

  it('writes a negative telegram_update_id (simulated IDs are always < 0)', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Test civic message' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData).toBeDefined()
    expect(typeof callData.telegram_update_id).toBe('number')
    expect(callData.telegram_update_id as number).toBeLessThan(0)
  })

  it('writes district_id from DB mahalla record, NOT from client body', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Test' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    // district_id must come from mahalla.district_id (1), never from request body
    expect(callData.district_id).toBe(MAHALLA_IN_DISTRICT.district_id)
  })

  it('writes correct mahalla_id', async () => {
    await injectSimulatedMessage({ mahallaId: 7, text: 'Elektr o\'chdi' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.mahalla_id).toBe(7)
  })

  it('writes correct text', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Gaz muammo' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.text).toBe('Gaz muammo')
  })

  it('writes correct text_source (default: "text")', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Test' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.text_source).toBe('text')
  })

  it('writes text_source "caption" when provided', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Test', textSource: 'caption' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.text_source).toBe('caption')
  })

  it('writes default sender_display_name "Test User" when not provided', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Test' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.sender_display_name).toBe('Test User')
  })

  it('writes custom sender_display_name when provided', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Test', senderDisplayName: 'Ali' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.sender_display_name).toBe('Ali')
  })

  it('writes sender_username when provided', async () => {
    await injectSimulatedMessage({ mahallaId: 1, text: 'Test', senderUsername: 'testuser' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.sender_username).toBe('testuser')
  })

  it('throws "No active district" when no active district found', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    await expect(injectSimulatedMessage({ mahallaId: 1, text: 'Test' }))
      .rejects.toThrow('No active district')
  })

  it('throws "Mahalla not found in active district" when mahalla belongs to different district', async () => {
    mockMahallaFindUnique.mockResolvedValue(MAHALLA_OTHER_DISTRICT)
    await expect(injectSimulatedMessage({ mahallaId: 99, text: 'Test' }))
      .rejects.toThrow('Mahalla not found in active district')
  })

  it('throws "Mahalla not found in active district" when mahalla does not exist', async () => {
    mockMahallaFindUnique.mockResolvedValue(null)
    await expect(injectSimulatedMessage({ mahallaId: 99, text: 'Test' }))
      .rejects.toThrow('Mahalla not found in active district')
  })

  it('generates unique telegram_update_id across multiple calls', async () => {
    const ids: number[] = []
    for (let i = 0; i < 3; i++) {
      await injectSimulatedMessage({ mahallaId: 1, text: `Message ${i}` })
      const callData = mockRawMessageCreate.mock.calls[i]?.[0]?.data as Record<string, unknown>
      ids.push(callData.telegram_update_id as number)
    }
    // All unique
    expect(new Set(ids).size).toBe(3)
    // All negative
    ids.forEach(id => expect(id).toBeLessThan(0))
  })

  it('starts below the smallest existing simulated raw-message ID after restart', async () => {
    mockRawMessageFindFirst.mockResolvedValueOnce({ telegram_update_id: -25 })

    await injectSimulatedMessage({ mahallaId: 1, text: 'Message after restart' })

    const callData = mockRawMessageCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(callData.telegram_update_id).toBe(-26)
    expect(mockRawMessageFindFirst).toHaveBeenCalledWith({
      where:   { telegram_update_id: { lt: 0 } },
      orderBy: { telegram_update_id: 'asc' },
      select:  { telegram_update_id: true },
    })
  })
})

// ─── simulateWebhook() ────────────────────────────────────────────────────────

describe('simulateWebhook()', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    resetSimulatedIdCounterForTest()
    mockDistrictFindFirst.mockResolvedValue(ACTIVE_DISTRICT)
    mockMahallaFindUnique.mockResolvedValue(MAHALLA_IN_DISTRICT)
    mockRawMessageFindFirst.mockResolvedValue(null)
    mockPipeline.mockResolvedValue(undefined)
    mockPipelineEventFindFirst.mockResolvedValue(null)
  })

  it('calls pipeline() with a correctly shaped Update', async () => {
    await simulateWebhook({ mahallaId: 1, text: 'Suv yo\'q' })

    expect(mockPipeline).toHaveBeenCalledOnce()
    const update = mockPipeline.mock.calls[0]?.[0] as Record<string, unknown>
    expect(typeof update.update_id).toBe('number')
    expect((update.update_id as number)).toBeLessThan(0)
    expect(update.message).toBeDefined()
  })

  it('returns decision "structural_discard" when no pipeline event is written (F0/F1/F2/F3 paths)', async () => {
    mockPipelineEventFindFirst.mockResolvedValue(null)
    const result = await simulateWebhook({ mahallaId: 1, text: 'Test' })
    expect(result.decision).toBe('structural_discard')
    expect(result.reason).toContain('No pipeline event was written')
  })

  it('returns decision "keyword_skip" when event_type is keyword_skip', async () => {
    mockPipelineEventFindFirst.mockResolvedValue({
      event_type: 'keyword_skip',
      detail:     { reason: 'No keyword match', filterMode: 'keyword_gate', keywordMatched: false, matchedPhrase: null },
    })
    const result = await simulateWebhook({ mahallaId: 1, text: 'Unmatched text' })
    expect(result.decision).toBe('keyword_skip')
  })

  it('returns decision "queued" when event_type is keyword_match', async () => {
    mockPipelineEventFindFirst.mockResolvedValue({
      event_type: 'keyword_match',
      detail:     { filterMode: 'keyword_gate', keywordMatched: true, matchedPhrase: 'suv' },
    })
    const result = await simulateWebhook({ mahallaId: 1, text: 'Suv yo\'q' })
    expect(result.decision).toBe('queued')
    expect(result.keywordMatched).toBe(true)
    expect(result.matchedPhrase).toBe('suv')
  })

  it('returns decision "queued" when event_type is prefilter_pass', async () => {
    mockPipelineEventFindFirst.mockResolvedValue({
      event_type: 'prefilter_pass',
      detail:     { filterMode: 'keyword_gate', keywordMatched: false, matchedPhrase: null },
    })
    const result = await simulateWebhook({ mahallaId: 1, text: 'Test' })
    expect(result.decision).toBe('queued')
  })

  it('includes filterMode from event detail', async () => {
    mockPipelineEventFindFirst.mockResolvedValue({
      event_type: 'keyword_match',
      detail:     { filterMode: 'keyword_gate', keywordMatched: true, matchedPhrase: 'gaz' },
    })
    const result = await simulateWebhook({ mahallaId: 1, text: 'Gaz muammo' })
    expect(result.filterMode).toBe('keyword_gate')
  })

  it('returns filterMode "keyword_gate" as fallback when not in detail', async () => {
    mockPipelineEventFindFirst.mockResolvedValue(null)
    const result = await simulateWebhook({ mahallaId: 1, text: 'Test' })
    expect(result.filterMode).toBe('keyword_gate')
  })

  it('throws "No active district" when no district found', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    await expect(simulateWebhook({ mahallaId: 1, text: 'Test' }))
      .rejects.toThrow('No active district')
  })

  it('throws "Mahalla not found in active district" when mahalla is in a different district', async () => {
    mockMahallaFindUnique.mockResolvedValue(MAHALLA_OTHER_DISTRICT)
    await expect(simulateWebhook({ mahallaId: 99, text: 'Test' }))
      .rejects.toThrow('Mahalla not found in active district')
  })

  it('throws "Mahalla not found in active district" when mahalla does not exist', async () => {
    mockMahallaFindUnique.mockResolvedValue(null)
    await expect(simulateWebhook({ mahallaId: 99, text: 'Test' }))
      .rejects.toThrow('Mahalla not found in active district')
  })
})
