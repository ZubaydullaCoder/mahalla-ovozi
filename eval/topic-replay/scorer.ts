import type { ReplayCaseResult } from './runner.js'
import type { ExpectedTopic, ReplayCase, TopicState } from './schema.js'
import { computeHokimRelated } from './hokim.js'
import {
  evaluateSummaryAssertions,
  type SummaryAssertionOutcome,
} from './summary-assertions.js'

export interface RateMetric {
  numerator: number
  denominator: number
  value: number | null
  status: 'available' | 'not_available'
}

export interface TopicAlignment {
  expectedTopicKey: string
  predictedTopicKey: string
  overlap: number
}

export interface ReplayScore {
  caseId: string
  alignment: TopicAlignment[]
  unmatchedExpectedTopicKeys: string[]
  unmatchedPredictedTopicKeys: string[]
  metrics: {
    supportedSignalPrecision: RateMetric
    supportedSignalRecall: RateMetric
    keywordlessNewTopicRecall: RateMetric
    keywordlessFollowUpAttachment: RateMetric
    overMergeRate: RateMetric
    overSplitRate: RateMetric
    multiCategoryExactSetAccuracy: RateMetric
    unsupportedCategoryRejection: RateMetric
    speculativeFactViolationRate: RateMetric
    residentCountAttributionAccuracy: RateMetric
    anchorSelectionAccuracy: RateMetric
    hokimKeywordAccuracy: RateMetric
    promotionAccuracy: RateMetric
  }
  summaryOutcomes: Array<SummaryAssertionOutcome & {
    expectedTopicKey: string
    predictedTopicKey?: string
  }>
}

export function scoreReplayCase(
  replayCase: ReplayCase,
  result: ReplayCaseResult,
): ReplayScore {
  const expectedSupported = Object.entries(replayCase.expected.dispositions)
    .filter(([, disposition]) => disposition !== 'irrelevant')
    .map(([key]) => key)
  const predictedSupported = Object.entries(result.dispositions)
    .filter(([, disposition]) => disposition !== 'irrelevant')
    .map(([key]) => key)
  const expectedSupportedSet = new Set(expectedSupported)
  const predictedSupportedSet = new Set(predictedSupported)
  const trueSupported = intersectionSize(expectedSupportedSet, predictedSupportedSet)
  const alignment = alignTopics(replayCase.expected.topics, result.topics)
  const alignedExpected = new Set(alignment.map(item => item.expectedTopicKey))
  const alignedPredicted = new Set(alignment.map(item => item.predictedTopicKey))
  const expectedMembership = membershipMap(
    replayCase.expected.topics.map(topic => ({ topicKey: topic.key, messageKeys: topic.messageKeys })),
  )
  const predictedMembership = membershipMap(result.topics)
  const pairs = messagePairs(replayCase.messages.map(message => message.key))
  const predictedTogether = pairs.filter(([a, b]) =>
    predictedMembership.get(a) !== undefined && predictedMembership.get(a) === predictedMembership.get(b))
  const expectedTogether = pairs.filter(([a, b]) =>
    expectedMembership.get(a) !== undefined && expectedMembership.get(a) === expectedMembership.get(b))
  const overMerged = predictedTogether.filter(([a, b]) =>
    !expectedMembership.has(a)
    || !expectedMembership.has(b)
    || expectedMembership.get(a) !== expectedMembership.get(b))
  const overSplit = expectedTogether.filter(([a, b]) =>
    !predictedMembership.has(a)
    || !predictedMembership.has(b)
    || predictedMembership.get(a) !== predictedMembership.get(b))

  const topicComparisons = alignment.map(item => {
    const expected = replayCase.expected.topics.find(topic => topic.key === item.expectedTopicKey)!
    const predicted = result.topics.find(topic => topic.topicKey === item.predictedTopicKey)!
    return { expected, predicted }
  })
  const multiCategory = topicComparisons.filter(({ expected, predicted }) =>
    expected.categories.length > 1 || predicted.categories.length > 1)
  const unsupportedMessages = replayCase.messages.filter(message => message.tags.includes('unsupported-category'))
  const keywordlessNew = replayCase.messages.filter(message => message.tags.includes('keywordless-new-topic'))
  const keywordlessFollowUp = replayCase.messages.filter(message => message.tags.includes('keywordless-follow-up'))

  const summaryOutcomes: ReplayScore['summaryOutcomes'] = topicComparisons.flatMap(({ expected, predicted }) =>
    evaluateSummaryAssertions(result.summaries[predicted.topicKey], expected.summaryAssertions)
      .map(assertion => ({
        ...assertion,
        expectedTopicKey: expected.key,
        predictedTopicKey: predicted.topicKey,
      })))
  for (const expected of replayCase.expected.topics.filter(topic => !alignedExpected.has(topic.key))) {
    summaryOutcomes.push(...evaluateSummaryAssertions(undefined, expected.summaryAssertions).map(assertion => ({
      ...assertion,
      expectedTopicKey: expected.key,
    })))
  }
  const speculative = summaryOutcomes.filter(item =>
    item.property === 'unsupported_claim'
    && (item.status === 'pass' || item.status === 'fail'))
  const speculativeFailures = speculative.filter(item => item.status === 'fail').length

  return {
    caseId: replayCase.id,
    alignment,
    unmatchedExpectedTopicKeys: replayCase.expected.topics
      .filter(topic => !alignedExpected.has(topic.key))
      .map(topic => topic.key),
    unmatchedPredictedTopicKeys: result.topics
      .filter(topic => !alignedPredicted.has(topic.topicKey))
      .map(topic => topic.topicKey),
    metrics: {
      supportedSignalPrecision: rate(trueSupported, predictedSupported.length),
      supportedSignalRecall: rate(trueSupported, expectedSupported.length),
      keywordlessNewTopicRecall: rate(
        keywordlessNew.filter(message => result.dispositions[message.key] === 'new_topic').length,
        keywordlessNew.length,
      ),
      keywordlessFollowUpAttachment: rate(
        keywordlessFollowUp.filter(message => result.dispositions[message.key] === 'attached').length,
        keywordlessFollowUp.length,
      ),
      overMergeRate: rate(overMerged.length, predictedTogether.length),
      overSplitRate: rate(overSplit.length, expectedTogether.length),
      multiCategoryExactSetAccuracy: rate(
        multiCategory.filter(({ expected, predicted }) =>
          expected.categories.length > 1
          && equalSets(expected.categories, predicted.categories)).length,
        multiCategory.length
          + replayCase.expected.topics.filter(topic =>
            !alignedExpected.has(topic.key) && topic.categories.length > 1).length
          + result.topics.filter(topic => !alignedPredicted.has(topic.topicKey) && topic.categories.length > 1).length,
      ),
      unsupportedCategoryRejection: rate(
        unsupportedMessages.filter(message => result.dispositions[message.key] === 'irrelevant').length,
        unsupportedMessages.length,
      ),
      speculativeFactViolationRate: rate(speculativeFailures, speculative.length),
      residentCountAttributionAccuracy: rate(
        topicComparisons.filter(({ expected, predicted }) =>
          countResidents(replayCase, predicted) === expected.distinctResidentCount).length,
        replayCase.expected.topics.length + result.topics.filter(topic => !alignedPredicted.has(topic.topicKey)).length,
      ),
      anchorSelectionAccuracy: rate(
        topicComparisons.filter(({ expected, predicted }) =>
          expected.anchorMessageKey === predicted.anchorMessageKey).length,
        replayCase.expected.topics.length + result.topics.filter(topic => !alignedPredicted.has(topic.topicKey)).length,
      ),
      hokimKeywordAccuracy: rate(
        topicComparisons.filter(({ expected, predicted }) =>
          expected.hokimRelated === computeHokimRelated(replayCase, predicted)).length,
        replayCase.expected.topics.length + result.topics.filter(topic => !alignedPredicted.has(topic.topicKey)).length,
      ),
      promotionAccuracy: exactEventRate(
        replayCase.expected.promotionEvents,
        result.promotions,
        alignment,
      ),
    },
    summaryOutcomes,
  }
}

export function alignTopics(
  expectedTopics: ExpectedTopic[],
  predictedTopics: TopicState[],
): TopicAlignment[] {
  const candidates = expectedTopics.flatMap(expected => predictedTopics.map(predicted => ({
    expectedTopicKey: expected.key,
    predictedTopicKey: predicted.topicKey,
    overlap: intersectionSize(new Set(expected.messageKeys), new Set(predicted.messageKeys)),
  })))
    .filter(candidate => candidate.overlap > 0)
    .sort((left, right) =>
      right.overlap - left.overlap
      || compareStableIds(left.expectedTopicKey, right.expectedTopicKey)
      || compareStableIds(left.predictedTopicKey, right.predictedTopicKey))
  const expectedUsed = new Set<string>()
  const predictedUsed = new Set<string>()
  const alignment: TopicAlignment[] = []

  for (const candidate of candidates) {
    if (expectedUsed.has(candidate.expectedTopicKey) || predictedUsed.has(candidate.predictedTopicKey)) continue
    expectedUsed.add(candidate.expectedTopicKey)
    predictedUsed.add(candidate.predictedTopicKey)
    alignment.push(candidate)
  }
  return alignment
}

function rate(numerator: number, denominator: number): RateMetric {
  return denominator === 0
    ? { numerator, denominator, value: null, status: 'not_available' }
    : { numerator, denominator, value: numerator / denominator, status: 'available' }
}

function exactEventRate(
  expected: ReplayCase['expected']['promotionEvents'],
  actual: ReplayCaseResult['promotions'],
  alignment: TopicAlignment[],
): RateMetric {
  const serialize = (event: {
    originMessageKey: string
    triggerMessageKey: string
    topicKey: string
  }) =>
    `${event.originMessageKey}|${event.triggerMessageKey}|${event.topicKey}`
  const predictedToExpected = new Map(alignment.map(item => [
    item.predictedTopicKey,
    item.expectedTopicKey,
  ]))
  const expectedSequence = expected.map(serialize)
  const actualSequence = actual.map(event => serialize({
    ...event,
    topicKey: predictedToExpected.get(event.topicKey) ?? event.topicKey,
  }))
  const denominator = Math.max(expectedSequence.length, actualSequence.length)
  const matches = expectedSequence.filter((event, index) => actualSequence[index] === event).length
  return rate(matches, denominator)
}

function membershipMap(topics: Array<{ topicKey: string; messageKeys: string[] }>): Map<string, string> {
  return new Map(topics.flatMap(topic => topic.messageKeys.map(key => [key, topic.topicKey] as const)))
}

function messagePairs(keys: string[]): Array<[string, string]> {
  return keys.flatMap((left, index) => keys.slice(index + 1).map(right => [left, right] as [string, string]))
}

function countResidents(replayCase: ReplayCase, topic: TopicState): number {
  return new Set(topic.messageKeys
    .map(key => replayCase.messages.find(message => message.key === key)?.senderKey)
    .filter((key): key is string => typeof key === 'string')).size
}

function equalSets(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index])
}

function intersectionSize<T>(left: Set<T>, right: Set<T>): number {
  return [...left].filter(value => right.has(value)).length
}

function compareStableIds(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}
