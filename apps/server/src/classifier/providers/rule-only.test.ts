import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnv = vi.hoisted(() => ({
  env: {
    AI_MODEL: 'gemini-2.5-flash',
  },
}))

vi.mock('../../shared/env.js', () => mockEnv)

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
}))

vi.mock('../../shared/logger.js', () => ({
  logger: loggerMocks,
}))

import { classifyWithRuleOnly } from './rule-only.js'

describe('classifyWithRuleOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.env.AI_MODEL = 'gemini-2.5-flash'
  })

  it('returns deterministic signal-shaped raw JSON for matched civic keywords', async () => {
    const result = await classifyWithRuleOnly('Hokim aka, gaz yoq')

    expect(result).toEqual({
      provider:  'rule-only',
      model:     'rule-only',
      latencyMs: expect.any(Number),
      rawJson:   {
        decision:      'signal',
        categories:    ['gas'],
        hokim_related: true,
        short_label:   'Possible gas issue',
      },
    })
    expect(loggerMocks.info).toHaveBeenCalledWith(
      {
        event:    'classifier_rule_only_used',
        provider: 'rule-only',
        model:    'rule-only',
      },
      'Rule-only classifier used',
    )
  })

  it('returns ignore-shaped raw JSON when no conservative rule matches', async () => {
    const result = await classifyWithRuleOnly('Salom hammaga')

    expect(result.rawJson).toEqual({ decision: 'ignore' })
  })

  it('uses configured model name for logging when explicitly set', async () => {
    mockEnv.env.AI_MODEL = 'local-rules-v1'

    const result = await classifyWithRuleOnly('suv yoq')

    expect(result.model).toBe('local-rules-v1')
    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'local-rules-v1',
      }),
      'Rule-only classifier used',
    )
  })
})
