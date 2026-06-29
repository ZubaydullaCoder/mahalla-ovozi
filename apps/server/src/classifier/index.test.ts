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
  error: vi.fn(),
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

import { isBatchRunning, runClassifyBatchWithLock, triggerClassifierDrain } from './index.js'

describe('triggerClassifierDrain', () => {
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
    await triggerClassifierDrain('manual')

    expect(batchMocks.classifyBatch).toHaveBeenCalledWith(7)
    expect(prismaMocks.executeRaw).toHaveBeenCalledOnce()
    expect(isBatchRunning()).toBe(false)
  })

  it('skips when database advisory lock is already held elsewhere', async () => {
    prismaMocks.queryRaw.mockResolvedValueOnce([{ locked: false }])

    await triggerClassifierDrain('cron')

    expect(batchMocks.classifyBatch).not.toHaveBeenCalled()
    expect(prismaMocks.executeRaw).not.toHaveBeenCalled()
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      { trigger: 'cron', event: 'batch_skipped_db_lock' },
      'Classify batch already running in another process; skipped',
    )
  })

  it('releases database lock when no active district exists', async () => {
    prismaMocks.districtFindFirst.mockResolvedValueOnce(null)

    await triggerClassifierDrain('cron')

    expect(batchMocks.classifyBatch).not.toHaveBeenCalled()
    expect(prismaMocks.executeRaw).toHaveBeenCalledOnce()
  })

  it('releases database lock when classifyBatch throws', async () => {
    batchMocks.classifyBatch.mockRejectedValueOnce(new Error('provider down'))

    await expect(triggerClassifierDrain('manual')).rejects.toThrow('provider down')

    expect(prismaMocks.executeRaw).toHaveBeenCalledOnce()
    expect(isBatchRunning()).toBe(false)
  })

  it('clears the in-process running guard when advisory lock release fails', async () => {
    prismaMocks.executeRaw.mockRejectedValueOnce(new Error('connection lost'))

    await triggerClassifierDrain('cron')

    expect(loggerMocks.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Failed to release classifier batch lock',
    )
    expect(isBatchRunning()).toBe(false)
  })

  it('keeps draining batches until an empty batch is reached', async () => {
    batchMocks.classifyBatch
      .mockResolvedValueOnce({
        status:           'ok',
        messages_fetched: 100,
        signals_written:  4,
        ignored_count:    96,
        error_message:    null,
      })
      .mockResolvedValueOnce({
        status:           'ok',
        messages_fetched: 25,
        signals_written:  1,
        ignored_count:    24,
        error_message:    null,
      })
      .mockResolvedValueOnce({
        status:           'ok',
        messages_fetched: 0,
        signals_written:  0,
        ignored_count:    0,
        error_message:    null,
      })

    await triggerClassifierDrain('cron')

    expect(batchMocks.classifyBatch).toHaveBeenCalledTimes(3)
    expect(batchMocks.classifyBatch).toHaveBeenNthCalledWith(1, 7)
    expect(batchMocks.classifyBatch).toHaveBeenNthCalledWith(2, 7)
    expect(batchMocks.classifyBatch).toHaveBeenNthCalledWith(3, 7)
  })

  it('does not start overlapping drains while one is already running', async () => {
    const deferred = createDeferred<{
      status: 'ok'
      messages_fetched: number
      signals_written: number
      ignored_count: number
      error_message: null
    }>()
    batchMocks.classifyBatch.mockReturnValueOnce(deferred.promise)

    const firstDrain = triggerClassifierDrain('webhook')
    await waitForMockCall(batchMocks.classifyBatch)

    expect(batchMocks.classifyBatch).toHaveBeenCalledTimes(1)

    await triggerClassifierDrain('webhook')

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      { trigger: 'webhook', event: 'batch_skipped_already_running' },
      'Classify batch already running; skipped',
    )

    deferred.resolve({
      status:           'ok',
      messages_fetched: 0,
      signals_written:  0,
      ignored_count:    0,
      error_message:    null,
    })
    await firstDrain
    expect(isBatchRunning()).toBe(false)
  })

  it('stops after a failed batch so failed raw messages remain retryable', async () => {
    batchMocks.classifyBatch.mockResolvedValueOnce({
      status:           'failed',
      messages_fetched: 1,
      signals_written:  0,
      ignored_count:    0,
      error_message:    '1 message(s) failed after retries; raw message IDs: 10',
    })

    await triggerClassifierDrain('cron')

    expect(batchMocks.classifyBatch).toHaveBeenCalledTimes(1)
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'cron',
        event:   'drain_stopped_after_failed_batch',
      }),
      'Classifier drain stopped after failed batch; raw messages remain retryable',
    )
  })

  it('stops at the drain batch cap when messages keep arriving', async () => {
    batchMocks.classifyBatch.mockResolvedValue({
      status:           'ok',
      messages_fetched: 100,
      signals_written:  2,
      ignored_count:    98,
      error_message:    null,
    })

    await triggerClassifierDrain('webhook')

    expect(batchMocks.classifyBatch).toHaveBeenCalledTimes(50)
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      { trigger: 'webhook', event: 'drain_cap_reached', batchesProcessed: 50 },
      'Classifier drain stopped at batch cap; remaining raw messages are deferred to the next trigger',
    )
    expect(isBatchRunning()).toBe(false)
  })

  it('keeps the previous runClassifyBatchWithLock API as a compatibility wrapper', async () => {
    await runClassifyBatchWithLock('manual')

    expect(batchMocks.classifyBatch).toHaveBeenCalledWith(7)
  })
})

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

async function waitForMockCall(mock: { mock: { calls: unknown[] } }): Promise<void> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    if (mock.mock.calls.length > 0) return
    await Promise.resolve()
  }
  throw new Error('Expected mock to be called')
}
