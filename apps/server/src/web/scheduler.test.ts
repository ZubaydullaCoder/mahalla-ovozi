import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSchedule = vi.hoisted(() => vi.fn())

vi.mock('node-cron', () => ({
  default: {
    schedule: mockSchedule,
  },
}))

const mockEnv = vi.hoisted(() => ({
  CLASSIFIER_CRON: '* * * * *',
  TOPIC_DRAIN_CRON: '*/2 * * * *',
  TOPIC_DRAIN_ENABLED: true,
}))

vi.mock('../shared/env.js', () => ({
  env: mockEnv,
}))

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  info:  vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: loggerMocks,
}))

const classifierMocks = vi.hoisted(() => ({
  triggerClassifierDrain: vi.fn().mockResolvedValue(undefined),
  purgeOldSignals:       vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../classifier/index.js', () => classifierMocks)

const topicDrainMocks = vi.hoisted(() => ({
  drainTopicQueue: vi.fn().mockResolvedValue(undefined),
  toSafeErrorMetadata: vi.fn().mockImplementation(() => ({ errorCategory: 'unknown' })),
}))

vi.mock('../topics/intake/drain.js', () => topicDrainMocks)

import { registerScheduler, triggerStartupDrain } from './scheduler.js'

describe('scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.CLASSIFIER_CRON = '* * * * *'
    mockEnv.TOPIC_DRAIN_CRON = '*/2 * * * *'
    mockEnv.TOPIC_DRAIN_ENABLED = true
    classifierMocks.triggerClassifierDrain.mockResolvedValue(undefined)
    classifierMocks.purgeOldSignals.mockResolvedValue(undefined)
    topicDrainMocks.drainTopicQueue.mockResolvedValue(undefined)
  })

  it('registers env-backed classifier, UTC retention cron, and topic drain cron', () => {
    mockEnv.CLASSIFIER_CRON = '*/5 * * * *'
    mockEnv.TOPIC_DRAIN_CRON = '*/10 * * * *'

    registerScheduler()

    expect(mockSchedule).toHaveBeenNthCalledWith(1, '*/5 * * * *', expect.any(Function))
    expect(mockSchedule).toHaveBeenNthCalledWith(2, '0 3 * * *', expect.any(Function), {
      timezone: 'UTC',
    })
    expect(mockSchedule).toHaveBeenNthCalledWith(3, '*/10 * * * *', expect.any(Function))
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

  it('topic drain cron triggers a background topic drain', async () => {
    registerScheduler()

    const topicCron = mockSchedule.mock.calls[2][1] as () => void
    topicCron()
    await Promise.resolve()

    expect(topicDrainMocks.drainTopicQueue).toHaveBeenCalledWith('cron')
  })

  it('startup drain triggers both classifier and topic drains with startup source', async () => {
    triggerStartupDrain()
    await Promise.resolve()

    expect(classifierMocks.triggerClassifierDrain).toHaveBeenCalledWith('startup')
    expect(topicDrainMocks.drainTopicQueue).toHaveBeenCalledWith('startup')
  })

  it('topic startup drain handles errors safely', async () => {
    const err = new Error('Startup DB crash')
    topicDrainMocks.drainTopicQueue.mockRejectedValueOnce(err)

    triggerStartupDrain()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(loggerMocks.error).toHaveBeenCalledWith(
      expect.any(Object),
      'Topic startup drain failed',
    )
  })
})
