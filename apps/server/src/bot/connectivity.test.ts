import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MyChatMemberContext } from './index.js'

vi.mock('../shared/env.js', () => ({
  env: {
    BOT_TOKEN:               'mock-bot-token',
    DATABASE_URL:            'postgresql://mock',
    FILTER_MODE:             'keyword_gate',
    NODE_ENV:                'test',
    PORT:                    3001,
    TELEGRAM_WEBHOOK_SECRET: 'mock-secret',
    AI_API_KEY:              'test-key',
    AI_MODEL:                'gemini-2.5-flash',
  },
}))

const { mockUpdateMany } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
}))

const { mockDebug, mockError, mockInfo } = vi.hoisted(() => ({
  mockDebug: vi.fn(),
  mockError: vi.fn(),
  mockInfo:  vi.fn(),
}))

vi.mock('../shared/db.js', () => ({
  prisma: {
    mahalla: { updateMany: mockUpdateMany },
  },
}))

vi.mock('../shared/logger.js', () => ({
  logger: {
    debug: mockDebug,
    error: mockError,
    info:  mockInfo,
  },
}))

import { handleMyChatMember } from './index.js'

const chatId = -1001234567890
const eventUnixSeconds = 1_700_000_000
const eventTimestamp = new Date(eventUnixSeconds * 1000)

function makeContext(
  status: MyChatMemberContext['myChatMember']['new_chat_member']['status'],
): MyChatMemberContext {
  return {
    chat: { id: chatId },
    from: { id: 777 },
    myChatMember: {
      date:            eventUnixSeconds,
      new_chat_member: { status },
    },
  }
}

describe('handleMyChatMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('updates bot_status to removed when bot is kicked', async () => {
    await handleMyChatMember(makeContext('kicked'))

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { telegram_chat_id: BigInt(chatId) },
      data:  { bot_status: 'removed', bot_last_seen_at: eventTimestamp },
    })
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        botStatus: 'removed',
        chatId:    chatId.toString(),
        newStatus: 'kicked',
      }),
      'Bot connectivity status updated',
    )
  })

  it('updates bot_status to removed when bot leaves', async () => {
    await handleMyChatMember(makeContext('left'))

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { telegram_chat_id: BigInt(chatId) },
      data:  { bot_status: 'removed', bot_last_seen_at: eventTimestamp },
    })
  })

  it('updates bot_status to active when bot rejoins as member', async () => {
    await handleMyChatMember(makeContext('member'))

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { telegram_chat_id: BigInt(chatId) },
      data:  { bot_status: 'active', bot_last_seen_at: eventTimestamp },
    })
  })

  it('updates bot_status to active when bot rejoins as administrator', async () => {
    await handleMyChatMember(makeContext('administrator'))

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { telegram_chat_id: BigInt(chatId) },
      data:  { bot_status: 'active', bot_last_seen_at: eventTimestamp },
    })
  })

  it('does not update the database for unknown membership statuses', async () => {
    await handleMyChatMember(makeContext('restricted'))

    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId:    chatId.toString(),
        newStatus: 'restricted',
      }),
      'Bot connectivity status ignored',
    )
  })

  it('does not throw when no registered mahalla matches the chat', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })

    await expect(handleMyChatMember(makeContext('member'))).resolves.not.toThrow()

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        matchedCount: 0,
        newStatus:    'member',
      }),
      'Bot connectivity status updated',
    )
  })

  it('logs database errors without throwing', async () => {
    const dbError = new Error('database unavailable')
    mockUpdateMany.mockRejectedValue(dbError)

    await expect(handleMyChatMember(makeContext('kicked'))).resolves.not.toThrow()

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: chatId.toString(),
        err:    dbError,
      }),
      'Bot connectivity status update failed',
    )
  })
})
