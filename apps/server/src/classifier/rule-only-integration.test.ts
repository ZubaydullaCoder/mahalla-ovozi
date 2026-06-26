import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  env: {
    AI_PROVIDER: 'rule-only' as const,
    AI_MODEL:    'rule-only',
  },
}))

vi.mock('../shared/env.js', () => mockEnv)

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  info:  vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: loggerMocks,
}))

import { classifyMessage } from './ai-client.js'

describe('classifyMessage with rule-only provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.env.AI_PROVIDER = 'rule-only'
    mockEnv.env.AI_MODEL = 'rule-only'
  })

  it('accepts schema-valid rule-only signal output', async () => {
    const result = await classifyMessage('Hokim aka, gaz yoq')

    expect(result).toEqual({
      decision:      'signal',
      categories:    ['gas'],
      hokim_related: true,
      short_label:   'Possible gas issue',
    })
    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event:    'classifier_rule_only_used',
        provider: 'rule-only',
        model:    'rule-only',
      }),
      'Rule-only classifier used',
    )
    expect(loggerMocks.error).not.toHaveBeenCalled()
  })
})
