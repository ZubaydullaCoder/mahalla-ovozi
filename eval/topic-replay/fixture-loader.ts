import { computeHokimRelated } from './hokim.js'
import { isSafeSummaryPattern } from './summary-assertions.js'
import {
  ReplayCaseSchema,
  SAFE_ID_PATTERN,
  SUPPORTED_CATEGORIES,
  type ReplayCase,
} from './schema.js'

export class ReplayFixtureError extends Error {
  constructor(
    public readonly code: string,
    public readonly line: number,
    public readonly caseId?: string,
  ) {
    super(`Replay fixture error [${code}] at line ${line}${caseId ? ` (case ${caseId})` : ''}`)
    this.name = 'ReplayFixtureError'
  }
}

export function loadReplayJsonl(content: string): ReplayCase[] {
  const cases: ReplayCase[] = []
  const caseIds = new Set<string>()

  for (const [index, rawLine] of content.split(/\r?\n/u).entries()) {
    if (rawLine.trim() === '') continue
    const line = index + 1
    let unknownCase: unknown

    try {
      unknownCase = JSON.parse(rawLine)
    } catch {
      throw new ReplayFixtureError('invalid_json', line)
    }

    const caseId = getSafeCaseId(unknownCase)
    const parsed = ReplayCaseSchema.safeParse(unknownCase)
    if (!parsed.success) {
      throw new ReplayFixtureError(mapSchemaIssue(parsed.error.issues[0]?.path ?? []), line, caseId)
    }
    if (caseIds.has(parsed.data.id)) {
      throw new ReplayFixtureError('duplicate_case_id', line, parsed.data.id)
    }

    validateReplayCase(parsed.data, line)
    caseIds.add(parsed.data.id)
    cases.push(parsed.data)
  }

  if (cases.length === 0) {
    throw new ReplayFixtureError('empty_fixture', 0)
  }
  return cases
}

function validateReplayCase(replayCase: ReplayCase, line: number): void {
  const messageKeys = new Set<string>()
  let lastTimestamp = Number.NEGATIVE_INFINITY

  for (const message of replayCase.messages) {
    if (messageKeys.has(message.key)) {
      throw new ReplayFixtureError('duplicate_message_id', line, replayCase.id)
    }
    const timestamp = Date.parse(message.telegramTimestamp)
    if (timestamp < lastTimestamp) {
      throw new ReplayFixtureError('nonchronological_messages', line, replayCase.id)
    }
    if (message.replyToKey && !messageKeys.has(message.replyToKey)) {
      throw new ReplayFixtureError('broken_reply_reference', line, replayCase.id)
    }
    messageKeys.add(message.key)
    lastTimestamp = timestamp
  }

  const topicKeys = new Set<string>()
  const expectedMembership = new Set<string>()
  for (const topic of replayCase.expected.topics) {
    if (topicKeys.has(topic.key)) {
      throw new ReplayFixtureError('duplicate_topic_id', line, replayCase.id)
    }
    if (new Set(topic.categories).size !== topic.categories.length) {
      throw new ReplayFixtureError('duplicate_category', line, replayCase.id)
    }
    if (topic.categories.some(category => !SUPPORTED_CATEGORIES.includes(category))) {
      throw new ReplayFixtureError('unsupported_category', line, replayCase.id)
    }
    for (const messageKey of topic.messageKeys) {
      if (!messageKeys.has(messageKey)) {
        throw new ReplayFixtureError('broken_topic_reference', line, replayCase.id)
      }
      if (expectedMembership.has(messageKey)) {
        throw new ReplayFixtureError('multiple_topic_membership', line, replayCase.id)
      }
      expectedMembership.add(messageKey)
    }
    if (!topic.messageKeys.includes(topic.anchorMessageKey)) {
      throw new ReplayFixtureError('broken_anchor_reference', line, replayCase.id)
    }
    if (topic.distinctResidentCount !== countResidents(replayCase, topic.messageKeys)) {
      throw new ReplayFixtureError('invalid_resident_count_truth', line, replayCase.id)
    }
    if (topic.hokimRelated !== computeHokimRelated(replayCase, topic)) {
      throw new ReplayFixtureError('invalid_hokim_truth', line, replayCase.id)
    }
    for (const assertion of topic.summaryAssertions) {
      validateSummaryAssertion(assertion, line, replayCase.id)
    }
    topicKeys.add(topic.key)
  }

  if (!sameKeys(messageKeys, new Set(Object.keys(replayCase.expected.dispositions)))) {
    throw new ReplayFixtureError('incomplete_expected_dispositions', line, replayCase.id)
  }

  const scriptMessageKeys = new Set<string>()
  const processedMessageKeys = new Set<string>()
  for (const [stepIndex, step] of replayCase.adapterScript.steps.entries()) {
    const expectedMessage = replayCase.messages[stepIndex]
    if (
      !messageKeys.has(step.messageKey)
      || scriptMessageKeys.has(step.messageKey)
      || step.messageKey !== expectedMessage?.key
    ) {
      throw new ReplayFixtureError('invalid_adapter_step_reference', line, replayCase.id)
    }
    processedMessageKeys.add(step.messageKey)
    const predictedTopicKeys = new Set<string>()
    for (const update of step.topicUpdates) {
      if (predictedTopicKeys.has(update.topicKey)) {
        throw new ReplayFixtureError('duplicate_predicted_topic', line, replayCase.id)
      }
      if (new Set(update.categories).size !== update.categories.length) {
        throw new ReplayFixtureError('duplicate_category', line, replayCase.id)
      }
      if (
        new Set(update.messageKeys).size !== update.messageKeys.length
        || update.messageKeys.some(key => !processedMessageKeys.has(key))
      ) {
        throw new ReplayFixtureError('invalid_adapter_topic_reference', line, replayCase.id)
      }
      if (!update.messageKeys.includes(update.anchorMessageKey)) {
        throw new ReplayFixtureError('broken_anchor_reference', line, replayCase.id)
      }
      predictedTopicKeys.add(update.topicKey)
    }
    for (const event of step.promotionEvents) {
      const target = step.topicUpdates.find(topic => topic.topicKey === event.topicKey)
      if (
        event.triggerMessageKey !== step.messageKey
        || !processedMessageKeys.has(event.originMessageKey)
        || !target?.messageKeys.includes(event.originMessageKey)
        || !target.messageKeys.includes(event.triggerMessageKey)
      ) {
        throw new ReplayFixtureError('invalid_adapter_promotion', line, replayCase.id)
      }
    }
    scriptMessageKeys.add(step.messageKey)
  }
  if (!sameKeys(messageKeys, scriptMessageKeys)) {
    throw new ReplayFixtureError('incomplete_adapter_script', line, replayCase.id)
  }

  const promotedOrigins = new Set<string>()
  let previousPromotionTriggerIndex = Number.NEGATIVE_INFINITY
  for (const event of replayCase.expected.promotionEvents) {
    const target = replayCase.expected.topics.find(topic => topic.key === event.topicKey)
    const triggerIndex = messageIndex(replayCase, event.triggerMessageKey)
    if (
      !messageKeys.has(event.originMessageKey)
      || !messageKeys.has(event.triggerMessageKey)
      || !topicKeys.has(event.topicKey)
      || promotedOrigins.has(event.originMessageKey)
      || replayCase.expected.dispositions[event.originMessageKey] !== 'irrelevant'
      || replayCase.expected.dispositions[event.triggerMessageKey] === 'irrelevant'
      || !target?.messageKeys.includes(event.originMessageKey)
      || !target.messageKeys.includes(event.triggerMessageKey)
    ) {
      throw new ReplayFixtureError('broken_promotion_reference', line, replayCase.id)
    }
    if (
      triggerIndex <= messageIndex(replayCase, event.originMessageKey)
      || triggerIndex < previousPromotionTriggerIndex
    ) {
      throw new ReplayFixtureError('invalid_promotion_order', line, replayCase.id)
    }
    promotedOrigins.add(event.originMessageKey)
    previousPromotionTriggerIndex = triggerIndex
  }

  for (const [messageKey, disposition] of Object.entries(replayCase.expected.dispositions)) {
    const isMember = expectedMembership.has(messageKey)
    if (disposition !== 'irrelevant' && !isMember) {
      throw new ReplayFixtureError('supported_message_missing_topic', line, replayCase.id)
    }
    if (disposition === 'irrelevant' && isMember && !promotedOrigins.has(messageKey)) {
      throw new ReplayFixtureError('irrelevant_message_has_topic', line, replayCase.id)
    }
  }
  validateEligibilityTags(replayCase, line)
}

function messageIndex(replayCase: ReplayCase, key: string): number {
  return replayCase.messages.findIndex(message => message.key === key)
}

function sameKeys(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every(key => right.has(key))
}

function getSafeCaseId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined
  const id = (value as { id?: unknown }).id
  return typeof id === 'string' && SAFE_ID_PATTERN.test(id) ? id : undefined
}

function mapSchemaIssue(path: PropertyKey[]): string {
  const joined = path.map(String).join('.')
  if (joined.includes('categories')) return 'unsupported_category'
  if (joined.includes('text')) return 'invalid_message_text'
  if (joined.includes('promotionEvents')) return 'invalid_promotion'
  return 'invalid_schema'
}

function validateSummaryAssertion(
  assertion: ReplayCase['expected']['topics'][number]['summaryAssertions'][number],
  line: number,
  caseId: string,
): void {
  const compatibleOperators: Record<typeof assertion.property, Set<typeof assertion.operator>> = {
    uzbek_cyrillic: new Set(['required_patterns', 'manual_review']),
    attribution: new Set(['required_terms', 'required_patterns', 'manual_review']),
    uncertainty: new Set(['required_terms', 'required_patterns', 'manual_review']),
    contradiction: new Set(['required_terms', 'required_patterns', 'manual_review']),
    identity_omission: new Set(['forbidden_terms', 'forbidden_patterns', 'manual_review']),
    resident_count: new Set(['expected_distinct_resident_count', 'manual_review']),
    unsupported_claim: new Set(['forbidden_terms', 'forbidden_patterns', 'manual_review']),
    restoration_not_resolution: new Set(['forbidden_terms', 'forbidden_patterns', 'manual_review']),
  }
  if (!compatibleOperators[assertion.property].has(assertion.operator)) {
    throw new ReplayFixtureError('invalid_summary_assertion', line, caseId)
  }
  if (assertion.operator === 'manual_review') return
  if (assertion.operator === 'expected_distinct_resident_count') {
    if (assertion.expectedCount === undefined) {
      throw new ReplayFixtureError('invalid_summary_assertion', line, caseId)
    }
    return
  }
  if (!assertion.values || assertion.values.length === 0) {
    throw new ReplayFixtureError('invalid_summary_assertion', line, caseId)
  }
  if (assertion.operator.endsWith('_patterns')) {
    for (const source of assertion.values) {
      if (!isSafeSummaryPattern(source)) {
        throw new ReplayFixtureError('unsafe_summary_pattern', line, caseId)
      }
      try {
        new RegExp(source, 'iu')
      } catch {
        throw new ReplayFixtureError('invalid_summary_pattern', line, caseId)
      }
    }
  }
}

function countResidents(replayCase: ReplayCase, messageKeys: string[]): number {
  return new Set(messageKeys
    .map(key => replayCase.messages.find(message => message.key === key)?.senderKey)
    .filter((key): key is string => typeof key === 'string')).size
}

function validateEligibilityTags(replayCase: ReplayCase, line: number): void {
  const expectedByTag: Partial<Record<
    ReplayCase['messages'][number]['tags'][number],
    'new_topic' | 'attached' | 'irrelevant'
  >> = {
    'keywordless-new-topic': 'new_topic',
    'keywordless-follow-up': 'attached',
    'unsupported-category': 'irrelevant',
  }
  for (const message of replayCase.messages) {
    for (const tag of message.tags) {
      const expectedDisposition = expectedByTag[tag]
      if (
        expectedDisposition
        && replayCase.expected.dispositions[message.key] !== expectedDisposition
      ) {
        throw new ReplayFixtureError('invalid_metric_eligibility', line, replayCase.id)
      }
    }
  }
  for (const event of replayCase.expected.promotionEvents) {
    if (!event.tags.includes('promotion')) {
      throw new ReplayFixtureError('missing_event_eligibility', line, replayCase.id)
    }
  }
}
