import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadReplayJsonl } from './fixture-loader.js'

const validCase = {
  id: 'case-water-001',
  scope: {
    districtKey: 'district-a',
    mahallaKey: 'mahalla-a',
    telegramChatKey: 'chat-a',
  },
  activeHokimKeywords: ['ҳоким'],
  tags: ['keywordless-new-topic'],
  messages: [
    {
      key: 'm1',
      telegramTimestamp: '2026-07-18T05:00:00.000Z',
      senderKey: 'resident-1',
      text: 'Тест: 1-кўча сув йўқ',
      textSource: 'text',
      replyToKey: null,
      tags: ['keywordless-new-topic'],
    },
  ],
  expected: {
    dispositions: { m1: 'new_topic' },
    topics: [{
      key: 't1',
      messageKeys: ['m1'],
      categories: ['water'],
      hokimRelated: false,
      anchorMessageKey: 'm1',
      distinctResidentCount: 1,
      summaryAssertions: [{
        property: 'attribution',
        operator: 'required_terms',
        values: ['аҳоли'],
      }],
    }],
    promotionEvents: [],
  },
  adapterScript: {
    steps: [{
      messageKey: 'm1',
      disposition: 'new_topic',
      topicUpdates: [{
        topicKey: 'predicted-t1',
        messageKeys: ['m1'],
        categories: ['water'],
        anchorMessageKey: 'm1',
      }],
      promotionEvents: [],
      telemetry: {
        attempts: 1,
        retries: 0,
        terminalFailure: false,
        latencyMs: 2,
      },
      summaryText: 'Аҳоли сув йўқлигини хабар қилди.',
    }],
  },
}

describe('loadReplayJsonl', () => {
  it('loads a complete chronological replay case', () => {
    const [replayCase] = loadReplayJsonl(JSON.stringify(validCase))

    expect(replayCase?.id).toBe('case-water-001')
    expect(replayCase?.messages[0]?.tags).toContain('keywordless-new-topic')
    expect(replayCase?.adapterScript.steps[0]?.summaryText).toContain('Аҳоли')
  })

  it.each([
    ['duplicate_message_id', {
      ...validCase,
      messages: [...validCase.messages, { ...validCase.messages[0] }],
    }],
    ['nonchronological_messages', {
      ...validCase,
      messages: [
        { ...validCase.messages[0], key: 'm2', telegramTimestamp: '2026-07-18T06:00:00.000Z' },
        { ...validCase.messages[0], key: 'm1', telegramTimestamp: '2026-07-18T05:00:00.000Z' },
      ],
    }],
    ['broken_reply_reference', {
      ...validCase,
      messages: [{ ...validCase.messages[0], replyToKey: 'private-canary' }],
    }],
    ['duplicate_category', {
      ...validCase,
      expected: {
        ...validCase.expected,
        topics: [{ ...validCase.expected.topics[0], categories: ['water', 'water'] }],
      },
    }],
    ['invalid_resident_count_truth', {
      ...validCase,
      expected: {
        ...validCase.expected,
        topics: [{ ...validCase.expected.topics[0], distinctResidentCount: 2 }],
      },
    }],
    ['invalid_hokim_truth', {
      ...validCase,
      activeHokimKeywords: ['сув'],
    }],
    ['invalid_summary_assertion', {
      ...validCase,
      expected: {
        ...validCase.expected,
        topics: [{
          ...validCase.expected.topics[0],
          summaryAssertions: [{
            property: 'unsupported_claim',
            operator: 'required_terms',
            values: ['сабаб'],
          }],
        }],
      },
    }],
    ['unsafe_summary_pattern', {
      ...validCase,
      expected: {
        ...validCase.expected,
        topics: [{
          ...validCase.expected.topics[0],
          summaryAssertions: [{
            property: 'attribution',
            operator: 'required_patterns',
            values: ['(a+)+$'],
          }],
        }],
      },
    }],
  ])('reports privacy-safe %s diagnostics', (code, fixture) => {
    expect(() => loadReplayJsonl(JSON.stringify(fixture))).toThrow(
      expect.objectContaining({
        code,
        line: 1,
        caseId: 'case-water-001',
      }),
    )

    try {
      loadReplayJsonl(JSON.stringify(fixture))
    } catch (error) {
      expect(String(error)).not.toContain('private-canary')
      expect(String(error)).not.toContain('Тест:')
    }
  })

  it('reports malformed JSON without echoing its content', () => {
    expect(() => loadReplayJsonl('{"id":"private-canary"')).toThrow(
      expect.objectContaining({ code: 'invalid_json', line: 1 }),
    )
  })

  it('loads a synthetic corpus covering every required case family', () => {
    const corpus = loadReplayJsonl(fs.readFileSync(
      path.resolve('eval/fixtures/topic-replay.example.jsonl'),
      'utf8',
    ))
    const tags = new Set(corpus.flatMap(replayCase => [
      ...replayCase.tags,
      ...replayCase.messages.flatMap(message => message.tags),
    ]))

    expect(tags).toEqual(new Set([
      'keywordless-new-topic',
      'keyword-containing-irrelevant',
      'keywordless-follow-up',
      'context-fragment',
      'exact-reply-over-24h',
      'similar-category-distinct-situation',
      'multi-category',
      'unsupported-category',
      'ambiguous-cause',
      'contradiction',
      'restoration',
      'repeated-sender',
      'distinct-residents',
      'unavailable-sender',
      'promotion',
      'anchor',
      'cross-scope-rejection',
      'invalid-candidate',
      'invalid-provider-schema',
      'provider-unavailable',
    ]))

    const exactReply = corpus.find(replayCase => replayCase.id === 'keywordless-followup-001')!
    expect(Date.parse(exactReply.messages[1]!.telegramTimestamp)
      - Date.parse(exactReply.messages[0]!.telegramTimestamp)).toBeGreaterThan(24 * 60 * 60 * 1000)
    expect(exactReply.messages[1]!.replyToKey).toBe('m1')

    const distinct = corpus.find(replayCase => replayCase.id === 'distinct-situations-001')!
    expect(distinct.expected.topics).toHaveLength(2)

    const promotion = corpus.find(replayCase => replayCase.id === 'promotion-001')!
    expect(promotion.expected.promotionEvents[0]?.tags).toContain('promotion')
    expect(promotion.expected.topics[0]?.messageKeys).toEqual(['m1', 'm2'])

    const crossScope = corpus.find(replayCase => replayCase.id === 'cross-scope-rejection-001')!
    expect(crossScope.scope).not.toEqual(exactReply.scope)
    expect(crossScope.expected.dispositions.m1).toBe('irrelevant')
  })

  it('rejects unsafe case identifiers without echoing them', () => {
    expect(() => loadReplayJsonl(JSON.stringify({
      ...validCase,
      id: 'PRIVATE FIXTURE TEXT',
    }))).toThrow(expect.objectContaining({
      code: 'invalid_schema',
      caseId: undefined,
    }))
  })

  it('rejects adapter steps that are complete but out of chronological order', () => {
    const secondMessage = {
      ...validCase.messages[0],
      key: 'm2',
      telegramTimestamp: '2026-07-18T05:01:00.000Z',
      replyToKey: 'm1',
    }
    const secondStep = {
      ...structuredClone(validCase.adapterScript.steps[0]!),
      messageKey: 'm2',
      disposition: 'attached',
      topicUpdates: [{
        ...structuredClone(validCase.adapterScript.steps[0]!.topicUpdates[0]!),
        messageKeys: ['m1', 'm2'],
      }],
    }
    const fixture = {
      ...validCase,
      messages: [validCase.messages[0], secondMessage],
      expected: {
        ...validCase.expected,
        dispositions: { m1: 'new_topic', m2: 'attached' },
        topics: [{
          ...validCase.expected.topics[0],
          messageKeys: ['m1', 'm2'],
          distinctResidentCount: 1,
        }],
      },
      adapterScript: {
        steps: [secondStep, validCase.adapterScript.steps[0]],
      },
    }

    expect(() => loadReplayJsonl(JSON.stringify(fixture))).toThrow(
      expect.objectContaining({ code: 'invalid_adapter_step_reference' }),
    )
  })

  it('keeps the documented JSONL example executable', () => {
    const documentation = fs.readFileSync(
      path.resolve('docs/classifier-evaluation.md'),
      'utf8',
    )
    const example = documentation.match(/```json\r?\n([\s\S]*?)\r?\n```/u)?.[1]

    expect(example).toBeDefined()
    expect(loadReplayJsonl(JSON.stringify(JSON.parse(example!)))).toHaveLength(1)
  })
})
