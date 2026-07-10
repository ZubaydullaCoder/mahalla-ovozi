import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  rawMessageDeleteMany:     vi.fn(),
  signalMessageDeleteMany:  vi.fn(),
  pipelineEventDeleteMany:  vi.fn(),
  batchHealthDeleteMany:    vi.fn(),
}))

vi.mock('../shared/db.js', () => ({
  prisma: {
    rawMessage: {
      deleteMany: prismaMocks.rawMessageDeleteMany,
    },
    signalMessage: {
      deleteMany: prismaMocks.signalMessageDeleteMany,
    },
    pipelineEvent: {
      deleteMany: prismaMocks.pipelineEventDeleteMany,
    },
    batchHealth: {
      deleteMany: prismaMocks.batchHealthDeleteMany,
    },
  },
}))

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  info:  vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: loggerMocks,
}))

import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { purgeOldSignals } from './purge.js'

describe('purgeOldSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    prismaMocks.rawMessageDeleteMany.mockResolvedValue({ count: 0 })
    prismaMocks.signalMessageDeleteMany.mockResolvedValue({ count: 0 })
    prismaMocks.pipelineEventDeleteMany.mockResolvedValue({ count: 0 })
    prismaMocks.batchHealthDeleteMany.mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls deleteMany with retention cutoffs from the policy', async () => {
    const now = new Date('2026-01-01T03:00:00.000Z')
    vi.setSystemTime(now)
    const dayMs = 24 * 60 * 60 * 1000

    vi.mocked(prisma.signalMessage.deleteMany).mockResolvedValueOnce({ count: 5 })

    await purgeOldSignals()

    expect(prisma.rawMessage.deleteMany).toHaveBeenCalledWith({
      where: {
        dead_lettered_at: {
          not: null,
          lt:  new Date(now.getTime() - 7 * dayMs),
        },
      },
    })
    expect(prisma.rawMessage.deleteMany).toHaveBeenCalledWith({
      where: {
        dead_lettered_at: null,
        created_at:      { lt: new Date(now.getTime() - 30 * dayMs) },
      },
    })
    expect(prisma.signalMessage.deleteMany).toHaveBeenCalledWith({
      where: { telegram_timestamp: { lt: new Date(now.getTime() - 90 * dayMs) } },
    })
    expect(prisma.pipelineEvent.deleteMany).toHaveBeenCalledWith({
      where: { created_at: { lt: new Date(now.getTime() - 14 * dayMs) } },
    })
    expect(prisma.batchHealth.deleteMany).toHaveBeenCalledWith({
      where: { started_at: { lt: new Date(now.getTime() - 60 * dayMs) } },
    })
  })

  it('logs info with deleted count and event key on success', async () => {
    vi.mocked(prisma.rawMessage.deleteMany)
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 4 })
    vi.mocked(prisma.signalMessage.deleteMany).mockResolvedValueOnce({ count: 12 })
    vi.mocked(prisma.pipelineEvent.deleteMany).mockResolvedValueOnce({ count: 8 })
    vi.mocked(prisma.batchHealth.deleteMany).mockResolvedValueOnce({ count: 3 })

    await purgeOldSignals()

    expect(logger.info).toHaveBeenCalledWith(
      {
        deletedDeadLetters:    2,
        deletedRawMessages:    4,
        deletedSignals:        12,
        deletedPipelineEvents: 8,
        deletedBatchHealth:    3,
        event:                 'retention_purge',
      },
      'Retention purge complete',
    )
  })

  it('logs info with deleted: 0 when no rows are purged', async () => {
    vi.mocked(prisma.signalMessage.deleteMany).mockResolvedValueOnce({ count: 0 })

    await purgeOldSignals()

    expect(logger.info).toHaveBeenCalledWith(
      {
        deletedDeadLetters:    0,
        deletedRawMessages:    0,
        deletedSignals:        0,
        deletedPipelineEvents: 0,
        deletedBatchHealth:    0,
        event:                 'retention_purge',
      },
      'Retention purge complete',
    )
  })

  it('logs error and rethrows on DB failure', async () => {
    const dbError = new Error('DB connection lost')
    vi.mocked(prisma.rawMessage.deleteMany).mockRejectedValueOnce(dbError)

    await expect(purgeOldSignals()).rejects.toThrow('DB connection lost')

    expect(logger.error).toHaveBeenCalledWith(
      { err: dbError, event: 'retention_purge_error' },
      'Signal retention purge failed',
    )
  })
})
