import { describe, expect, it, vi } from 'vitest'

import { createFixtureOutputAdapter } from './adapters/fixture-output.js'
import { runReplayCase } from './runner.js'
import { ReplayCaseSchema } from './schema.js'

const promotionCase = ReplayCaseSchema.parse({
  id: 'case-promotion-001',
  scope: {
    districtKey: 'district-a',
    mahallaKey: 'mahalla-a',
    telegramChatKey: 'chat-a',
  },
  activeHokimKeywords: ['ҳоким'],
  tags: ['promotion'],
  messages: [
    {
      key: 'm1',
      telegramTimestamp: '2026-07-18T05:00:00.000Z',
      senderKey: null,
      text: 'Тест: бу ерда ҳам',
      textSource: 'text',
      tags: ['promotion'],
    },
    {
      key: 'm2',
      telegramTimestamp: '2026-07-18T05:01:00.000Z',
      senderKey: 'resident-2',
      text: 'Тест: 1-кўчада сув йўқ, юқоридаги ҳам шу ҳақда',
      textSource: 'text',
      replyToKey: 'm1',
      tags: ['promotion'],
    },
  ],
  expected: {
    dispositions: { m1: 'irrelevant', m2: 'new_topic' },
    topics: [{
      key: 't1',
      messageKeys: ['m1', 'm2'],
      categories: ['water'],
      hokimRelated: false,
      anchorMessageKey: 'm2',
      distinctResidentCount: 1,
      summaryAssertions: [],
    }],
    promotionEvents: [{
      originMessageKey: 'm1',
      triggerMessageKey: 'm2',
      topicKey: 't1',
      tags: ['promotion'],
    }],
  },
  adapterScript: {
    steps: [
      {
        messageKey: 'm1',
        disposition: 'irrelevant',
        topicUpdates: [],
        promotionEvents: [],
        telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
      },
      {
        messageKey: 'm2',
        disposition: 'new_topic',
        topicUpdates: [{
          topicKey: 'p1',
          messageKeys: ['m1', 'm2'],
          categories: ['water'],
          anchorMessageKey: 'm2',
        }],
        promotionEvents: [{
          originMessageKey: 'm1',
          triggerMessageKey: 'm2',
          topicKey: 'p1',
        }],
        telemetry: { attempts: 2, retries: 1, terminalFailure: false, latencyMs: 2 },
      },
    ],
  },
})

describe('runReplayCase', () => {
  it('calls the adapter sequentially with runner-owned accumulated state', async () => {
    const fixtureAdapter = createFixtureOutputAdapter(promotionCase)
    const classifyStep = vi.spyOn(fixtureAdapter, 'classifyStep')

    const result = await runReplayCase(promotionCase, fixtureAdapter)

    expect(classifyStep).toHaveBeenCalledTimes(2)
    expect(classifyStep.mock.calls[0]?.[0].state.topics).toEqual([])
    expect(classifyStep.mock.calls[1]?.[0].state.dispositions).toEqual({ m1: 'irrelevant' })
    expect(result.topics).toEqual([{
      topicKey: 'p1',
      messageKeys: ['m1', 'm2'],
      categories: ['water'],
      anchorMessageKey: 'm2',
    }])
    expect(result.promotions).toHaveLength(1)
    expect(result.telemetry.retries).toBe(1)
  })

  it('rejects a promotion whose origin was not previously irrelevant', async () => {
    const invalid = structuredClone(promotionCase)
    invalid.adapterScript.steps[0]!.disposition = 'new_topic'
    invalid.adapterScript.steps[0]!.topicUpdates = [{
      topicKey: 'p1',
      messageKeys: ['m1'],
      categories: ['water'],
      anchorMessageKey: 'm1',
    }]
    invalid.adapterScript.steps[1]!.disposition = 'attached'

    await expect(runReplayCase(invalid, createFixtureOutputAdapter(invalid))).rejects.toMatchObject({
      code: 'promotion_origin_not_irrelevant',
      caseId: 'case-promotion-001',
      messageKey: 'm2',
    })
  })

  it('rejects future evidence before its chronological replay step', async () => {
    const invalid = structuredClone(promotionCase)
    invalid.adapterScript.steps[0]!.disposition = 'new_topic'
    invalid.adapterScript.steps[0]!.topicUpdates = [{
      topicKey: 'p1',
      messageKeys: ['m1', 'm2'],
      categories: ['water'],
      anchorMessageKey: 'm1',
    }]

    await expect(runReplayCase(invalid, createFixtureOutputAdapter(invalid))).rejects.toMatchObject({
      code: 'invalid_candidate_id',
      messageKey: 'm1',
    })
  })

  it('requires an auditable event when prior irrelevant evidence gains membership', async () => {
    const invalid = structuredClone(promotionCase)
    invalid.adapterScript.steps[1]!.promotionEvents = []

    await expect(runReplayCase(invalid, createFixtureOutputAdapter(invalid))).rejects.toMatchObject({
      code: 'promotion_event_missing',
      messageKey: 'm2',
    })
  })

  it('rejects duplicate promotions within one adapter step', async () => {
    const invalid = structuredClone(promotionCase)
    invalid.adapterScript.steps[1]!.promotionEvents.push(
      structuredClone(invalid.adapterScript.steps[1]!.promotionEvents[0]!),
    )

    await expect(runReplayCase(invalid, createFixtureOutputAdapter(invalid))).rejects.toMatchObject({
      code: 'duplicate_promotion',
      messageKey: 'm2',
    })
  })

  it('requires the promotion trigger to belong to the event target topic', async () => {
    const invalid = structuredClone(promotionCase)
    invalid.adapterScript.steps[1]!.topicUpdates = [
      {
        topicKey: 'p1',
        messageKeys: ['m1'],
        categories: ['water'],
        anchorMessageKey: 'm1',
      },
      {
        topicKey: 'p2',
        messageKeys: ['m2'],
        categories: ['water'],
        anchorMessageKey: 'm2',
      },
    ]

    await expect(runReplayCase(invalid, createFixtureOutputAdapter(invalid))).rejects.toMatchObject({
      code: 'promotion_target_invalid',
      messageKey: 'm2',
    })
  })

  it('associates a step summary only with the current message topic', async () => {
    const multiTopicCase = ReplayCaseSchema.parse({
      id: 'multi-topic-summary',
      scope: { districtKey: 'd1', mahallaKey: 'h1', telegramChatKey: 'c1' },
      activeHokimKeywords: [],
      messages: [
        {
          key: 'm1',
          telegramTimestamp: '2026-07-18T05:00:00.000Z',
          text: 'Тест: биринчи сув хабари',
          textSource: 'text',
        },
        {
          key: 'm2',
          telegramTimestamp: '2026-07-18T05:01:00.000Z',
          text: 'Тест: иккинчи газ хабари',
          textSource: 'text',
        },
      ],
      expected: {
        dispositions: { m1: 'new_topic', m2: 'new_topic' },
        topics: [],
        promotionEvents: [],
      },
      adapterScript: {
        steps: [
          {
            messageKey: 'm1',
            disposition: 'new_topic',
            topicUpdates: [{
              topicKey: 'p1',
              messageKeys: ['m1'],
              categories: ['water'],
              anchorMessageKey: 'm1',
            }],
            promotionEvents: [],
            telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
          },
          {
            messageKey: 'm2',
            disposition: 'new_topic',
            topicUpdates: [
              {
                topicKey: 'p1',
                messageKeys: ['m1'],
                categories: ['water'],
                anchorMessageKey: 'm1',
              },
              {
                topicKey: 'p2',
                messageKeys: ['m2'],
                categories: ['gas'],
                anchorMessageKey: 'm2',
              },
            ],
            promotionEvents: [],
            telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
            summaryText: 'Аҳоли газ йўқлигини хабар қилди.',
          },
        ],
      },
    })

    const result = await runReplayCase(
      multiTopicCase,
      createFixtureOutputAdapter(multiTopicCase),
    )

    expect(result.summaries).toEqual({
      p2: 'Аҳоли газ йўқлигини хабар қилди.',
    })
  })

  it('turns declared terminal telemetry into an operational case failure', async () => {
    const invalid = structuredClone(promotionCase)
    invalid.adapterScript.steps[0]!.telemetry.terminalFailure = true

    await expect(runReplayCase(invalid, createFixtureOutputAdapter(invalid))).rejects.toMatchObject({
      code: 'adapter_terminal_failure',
      caseId: 'case-promotion-001',
      stepTelemetry: [
        expect.objectContaining({ terminalFailure: true }),
      ],
    })
  })

  it('rejects provider-schema and foreign-scope candidate outputs', async () => {
    await expect(runReplayCase(promotionCase, {
      name: 'provisional_ollama',
      authorityLabel: 'provisional_pre_triage',
      async classifyStep() {
        return {}
      },
    })).rejects.toMatchObject({ code: 'invalid_adapter_output' })

    await expect(runReplayCase(promotionCase, {
      name: 'provisional_ollama',
      authorityLabel: 'provisional_pre_triage',
      async classifyStep(input) {
        return {
          messageKey: input.message.key,
          disposition: 'new_topic',
          topicUpdates: [{
            topicKey: 'foreign-topic',
            messageKeys: [input.message.key, 'foreign-message'],
            categories: ['water'],
            anchorMessageKey: input.message.key,
          }],
          promotionEvents: [],
          telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
        }
      },
    })).rejects.toMatchObject({ code: 'invalid_candidate_id' })
  })
})
