import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSchedule = vi.hoisted(() => vi.fn())

vi.mock('node-cron', () => ({
  default: {
    schedule: mockSchedule,
  },
}))

const mockEnv = vi.hoisted(() => ({
  CLASSIFIER_CRON: '* * * * *',
}))

vi.mock('../shared/env.js', () => ({
  env: mockEnv,
}))

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: loggerMocks,
}))

const classifierMocks = vi.hoisted(() => ({
  triggerClassifierDrain: vi.fn().mockResolvedValue(undefined),
  purgeOldSignals:       vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../classifier/index.js', () => classifierMocks)

import { registerScheduler, triggerStartupDrain } from './scheduler.js'

describe('scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.CLASSIFIER_CRON = '* * * * *'
    classifierMocks.triggerClassifierDrain.mockResolvedValue(undefined)
    classifierMocks.purgeOldSignals.mockResolvedValue(undefined)
  })

  it('registers env-backed classifier fallback cron and separate UTC retention cron', () => {
    mockEnv.CLASSIFIER_CRON = '*/5 * * * *'

    registerScheduler()

    expect(mockSchedule).toHaveBeenNthCalledWith(1, '*/5 * * * *', expect.any(Function))
    expect(mockSchedule).toHaveBeenNthCalledWith(2, '0 3 * * *', expect.any(Function), {
      timezone: 'UTC',
    })
  })

  it('classifier cron triggers a background drain', async () => {
    registerScheduler()

    const classifierCron = mockSchedule.mock.calls[0][1] as () => void
    classifierCron()
    await Promise.resolve()

    expect(classifierMocks.triggerClassifierDrain).toHaveBeenCalledWith('cron')
  })

  it('retention cron remains separate from classifier drain', async () => {
    registerScheduler()

    const retentionCron = mockSchedule.mock.calls[1][1] as () => void
    retentionCron()
    await Promise.resolve()

    expect(classifierMocks.purgeOldSignals).toHaveBeenCalledOnce()
    expect(classifierMocks.triggerClassifierDrain).not.toHaveBeenCalled()
  })

  it('startup drain triggers once with startup source', async () => {
    triggerStartupDrain()
    await Promise.resolve()

    expect(classifierMocks.triggerClassifierDrain).toHaveBeenCalledWith('startup')
  })
})
