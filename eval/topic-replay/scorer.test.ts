import { describe, expect, it } from 'vitest'

import { scoreReplayCase } from './scorer.js'
import { ReplayCaseSchema } from './schema.js'
import type { ReplayCaseResult } from './runner.js'

const replayCase = ReplayCaseSchema.parse({
  id: 'score-001',
  scope: { districtKey: 'd1', mahallaKey: 'h1', telegramChatKey: 'c1' },
  activeHokimKeywords: ['ҳоким', 'туман раҳбари'],
  tags: ['keywordless-new-topic', 'multi-category', 'anchor'],
  messages: [
    {
      key: 'm1',
      telegramTimestamp: '2026-07-18T05:00:00.000Z',
      senderKey: 'r1',
      text: 'Тест: ҳоким, сув ва газ йўқ',
      textSource: 'text',
      tags: ['keywordless-new-topic'],
    },
    {
      key: 'm2',
      telegramTimestamp: '2026-07-18T05:01:00.000Z',
      senderKey: 'r2',
      text: 'Тест: бизда ҳам',
      textSource: 'text',
      tags: ['keywordless-follow-up'],
    },
    {
      key: 'm3',
      telegramTimestamp: '2026-07-18T05:02:00.000Z',
      senderKey: null,
      text: 'Тест: об-ҳаво',
      textSource: 'text',
      tags: ['unsupported-category'],
    },
  ],
  expected: {
    dispositions: { m1: 'new_topic', m2: 'attached', m3: 'irrelevant' },
    topics: [{
      key: 't1',
      messageKeys: ['m1', 'm2'],
      categories: ['water', 'gas'],
      hokimRelated: true,
      anchorMessageKey: 'm1',
      distinctResidentCount: 2,
      summaryAssertions: [{
        property: 'attribution',
        operator: 'required_terms',
        values: ['аҳоли'],
      }],
    }],
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
          categories: ['gas', 'water'],
          anchorMessageKey: 'm1',
        }],
        promotionEvents: [],
        telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
      },
      {
        messageKey: 'm2',
        disposition: 'attached',
        topicUpdates: [{
          topicKey: 'p1',
          messageKeys: ['m1', 'm2'],
          categories: ['water', 'gas'],
          anchorMessageKey: 'm1',
        }],
        promotionEvents: [],
        telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
        summaryText: 'Аҳоли сув ва газ йўқлигини хабар қилди.',
      },
      {
        messageKey: 'm3',
        disposition: 'irrelevant',
        topicUpdates: [{
          topicKey: 'p1',
          messageKeys: ['m1', 'm2'],
          categories: ['water', 'gas'],
          anchorMessageKey: 'm1',
        }],
        promotionEvents: [],
        telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
      },
    ],
  },
})

const perfectResult: ReplayCaseResult = {
  caseId: 'score-001',
  dispositions: { m1: 'new_topic', m2: 'attached', m3: 'irrelevant' },
  topics: [{
    topicKey: 'p1',
    messageKeys: ['m1', 'm2'],
    categories: ['water', 'gas'],
    anchorMessageKey: 'm1',
  }],
  promotions: [],
  summaries: { p1: 'Аҳоли сув ва газ йўқлигини хабар қилди.' },
  stepTelemetry: [],
  telemetry: { attempts: 3, retries: 0, terminalFailures: 0, latencyMs: 3 },
}

describe('scoreReplayCase', () => {
  it('scores exact sets, alignment, attribution, anchor, Hokim, and tagged metrics', () => {
    const score = scoreReplayCase(replayCase, perfectResult)

    expect(score.metrics.supportedSignalPrecision.value).toBe(1)
    expect(score.metrics.supportedSignalRecall.value).toBe(1)
    expect(score.metrics.keywordlessNewTopicRecall.value).toBe(1)
    expect(score.metrics.keywordlessFollowUpAttachment.value).toBe(1)
    expect(score.metrics.multiCategoryExactSetAccuracy.value).toBe(1)
    expect(score.metrics.unsupportedCategoryRejection.value).toBe(1)
    expect(score.metrics.residentCountAttributionAccuracy.value).toBe(1)
    expect(score.metrics.anchorSelectionAccuracy.value).toBe(1)
    expect(score.metrics.hokimKeywordAccuracy.value).toBe(1)
    expect(score.metrics.overMergeRate.value).toBe(0)
    expect(score.summaryOutcomes[0]?.status).toBe('pass')
  })

  it('keeps over-merge and over-split denominators distinct', () => {
    const split = structuredClone(perfectResult)
    split.topics = [
      { topicKey: 'p1', messageKeys: ['m1'], categories: ['water', 'gas'], anchorMessageKey: 'm1' },
      { topicKey: 'p2', messageKeys: ['m2'], categories: ['water', 'gas'], anchorMessageKey: 'm2' },
    ]

    const score = scoreReplayCase(replayCase, split)

    expect(score.metrics.overSplitRate).toMatchObject({ numerator: 1, denominator: 1, value: 1 })
    expect(score.metrics.overMergeRate.status).toBe('not_available')
  })

  it('uses stable IDs to break equal-overlap alignment ties', () => {
    const result = structuredClone(perfectResult)
    result.topics = [
      { topicKey: 'z-topic', messageKeys: ['m1'], categories: ['water'], anchorMessageKey: 'm1' },
      { topicKey: 'a-topic', messageKeys: ['m2'], categories: ['water'], anchorMessageKey: 'm2' },
    ]

    const score = scoreReplayCase(replayCase, result)

    expect(score.alignment[0]).toMatchObject({ expectedTopicKey: 't1', predictedTopicKey: 'a-topic' })
  })

  it('penalizes merges of expected-irrelevant messages and omitted expected clusters', () => {
    const mergeCase = structuredClone(replayCase)
    mergeCase.messages.push({
      key: 'm4',
      telegramTimestamp: '2026-07-18T05:03:00.000Z',
      senderKey: null,
      text: 'Тест: яна об-ҳаво',
      textSource: 'text',
      tags: [],
    })
    mergeCase.expected.dispositions.m4 = 'irrelevant'
    const merged = structuredClone(perfectResult)
    merged.dispositions.m3 = 'attached'
    merged.dispositions.m4 = 'attached'
    merged.topics.push({
      topicKey: 'p2',
      messageKeys: ['m3', 'm4'],
      categories: ['water'],
      anchorMessageKey: 'm4',
    })

    const mergeScore = scoreReplayCase(mergeCase, merged)
    expect(mergeScore.metrics.overMergeRate.numerator).toBe(1)

    const omitted = structuredClone(perfectResult)
    omitted.topics = []
    const splitScore = scoreReplayCase(replayCase, omitted)
    expect(splitScore.metrics.overSplitRate).toMatchObject({
      numerator: 1,
      denominator: 1,
      value: 1,
    })
  })

  it('counts aligned multi-category overprediction as an exact-set failure', () => {
    const singleCategoryCase = structuredClone(replayCase)
    singleCategoryCase.expected.topics[0]!.categories = ['water']
    const overpredicted = structuredClone(perfectResult)
    overpredicted.topics[0]!.categories = ['water', 'gas']

    expect(scoreReplayCase(singleCategoryCase, overpredicted)
      .metrics.multiCategoryExactSetAccuracy).toMatchObject({
      numerator: 0,
      denominator: 1,
      value: 0,
    })
  })

  it('does not count unavailable unsupported-claim checks as non-violations', () => {
    const unavailableCase = structuredClone(replayCase)
    unavailableCase.expected.topics[0]!.summaryAssertions = [{
      property: 'unsupported_claim',
      operator: 'forbidden_terms',
      values: ['аниқ сабаб'],
    }]
    const unavailableResult = structuredClone(perfectResult)
    unavailableResult.summaries = {}

    expect(scoreReplayCase(unavailableCase, unavailableResult)
      .metrics.speculativeFactViolationRate).toMatchObject({
      numerator: 0,
      denominator: 0,
      value: null,
      status: 'not_available',
    })
  })

  it('scores promotion history in chronological order rather than as a set', () => {
    const orderedCase = ReplayCaseSchema.parse({
      id: 'ordered-promotions',
      scope: { districtKey: 'd1', mahallaKey: 'h1', telegramChatKey: 'c1' },
      activeHokimKeywords: [],
      messages: [
        { key: 'm1', telegramTimestamp: '2026-07-18T05:00:00.000Z', text: 'А', textSource: 'text' },
        { key: 'm2', telegramTimestamp: '2026-07-18T05:01:00.000Z', text: 'Б', textSource: 'text' },
        { key: 'm3', telegramTimestamp: '2026-07-18T05:02:00.000Z', text: 'Сув', textSource: 'text' },
        { key: 'm4', telegramTimestamp: '2026-07-18T05:03:00.000Z', text: 'Газ', textSource: 'text' },
      ],
      expected: {
        dispositions: {
          m1: 'irrelevant',
          m2: 'irrelevant',
          m3: 'new_topic',
          m4: 'new_topic',
        },
        topics: [
          {
            key: 't1',
            messageKeys: ['m1', 'm3'],
            categories: ['water'],
            hokimRelated: false,
            anchorMessageKey: 'm3',
            distinctResidentCount: 0,
            summaryAssertions: [],
          },
          {
            key: 't2',
            messageKeys: ['m2', 'm4'],
            categories: ['gas'],
            hokimRelated: false,
            anchorMessageKey: 'm4',
            distinctResidentCount: 0,
            summaryAssertions: [],
          },
        ],
        promotionEvents: [
          {
            originMessageKey: 'm1',
            triggerMessageKey: 'm3',
            topicKey: 't1',
            tags: ['promotion'],
          },
          {
            originMessageKey: 'm2',
            triggerMessageKey: 'm4',
            topicKey: 't2',
            tags: ['promotion'],
          },
        ],
      },
      adapterScript: {
        steps: [{
          messageKey: 'm1',
          disposition: 'irrelevant',
          topicUpdates: [],
          promotionEvents: [],
          telemetry: { attempts: 1, retries: 0, terminalFailure: false, latencyMs: 1 },
        }],
      },
    })
    const reversedResult: ReplayCaseResult = {
      caseId: orderedCase.id,
      dispositions: orderedCase.expected.dispositions,
      topics: [
        { topicKey: 'p1', messageKeys: ['m1', 'm3'], categories: ['water'], anchorMessageKey: 'm3' },
        { topicKey: 'p2', messageKeys: ['m2', 'm4'], categories: ['gas'], anchorMessageKey: 'm4' },
      ],
      promotions: [
        { originMessageKey: 'm2', triggerMessageKey: 'm4', topicKey: 'p2' },
        { originMessageKey: 'm1', triggerMessageKey: 'm3', topicKey: 'p1' },
      ],
      summaries: {},
      stepTelemetry: [],
      telemetry: { attempts: 0, retries: 0, terminalFailures: 0, latencyMs: 0 },
    }

    expect(scoreReplayCase(orderedCase, reversedResult).metrics.promotionAccuracy.value).toBe(0)
  })
})
