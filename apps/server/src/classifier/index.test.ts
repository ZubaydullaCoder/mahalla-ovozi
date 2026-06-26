import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  districtFindFirst: vi.fn(),
  queryRaw:          vi.fn(),
  executeRaw:        vi.fn(),
}))

vi.mock('../shared/db.js', () => ({
  prisma: {
    district: {
      findFirst: prismaMocks.districtFindFirst,
    },
    $queryRaw:    prismaMocks.queryRaw,
    $executeRaw:  prismaMocks.executeRaw,
  },
}))

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: loggerMocks,
}))

const batchMocks = vi.hoisted(() => ({
  classifyBatch: vi.fn(),
}))

vi.mock('./batch-processor.js', () => ({
  classifyBatch: batchMocks.classifyBatch,
}))

import { isBatchRunning, runClassifyBatchWithLock } from './index.js'

describe('runClassifyBatchWithLock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.queryRaw.mockResolvedValue([{ locked: true }])
    prismaMocks.executeRaw.mockResolvedValue(1)
    prismaMocks.districtFindFirst.mockResolvedValue({ id: 7 })
    batchMocks.classifyBatch.mockResolvedValue({
      status:           'ok',
      messages_fetched: 0,
      signals_written:  0,
      ignored_count:    0,
      error_message:    null,
    })
  })

  it('acquires database lock, classifies active district, and releases lock', async () => {
    await runClassifyBatchWithLock('manual')

    expect(batchMocks.classifyBatch).toHaveBeenCalledWith(7)
    expect(prismaMocks.executeRaw).toHaveBeenCalledOnce()
    expect(isBatchRunning()).toBe(false)
  })

  it('skips when database advisory lock is already held elsewhere', async () => {
    prismaMocks.queryRaw.mockResolvedValueOnce([{ locked: false }])

    await runClassifyBatchWithLock('cron')

    expect(batchMocks.classifyBatch).not.toHaveBeenCalled()
    expect(prismaMocks.executeRaw).not.toHaveBeenCalled()
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      { trigger: 'cron', event: 'batch_skipped_db_lock' },
      'Classify batch already running in another process; skipped',
    )
  })

  it('releases database lock when no active district exists', async () => {
    prismaMocks.districtFindFirst.mockResolvedValueOnce(null)

    await runClassifyBatchWithLock('cron')

    expect(batchMocks.classifyBatch).not.toHaveBeenCalled()
    expect(prismaMocks.executeRaw).toHaveBeenCalledOnce()
  })

  it('releases database lock when classifyBatch throws', async () => {
    batchMocks.classifyBatch.mockRejectedValueOnce(new Error('provider down'))

    await expect(runClassifyBatchWithLock('manual')).rejects.toThrow('provider down')

    expect(prismaMocks.executeRaw).toHaveBeenCalledOnce()
    expect(isBatchRunning()).toBe(false)
  })
})
