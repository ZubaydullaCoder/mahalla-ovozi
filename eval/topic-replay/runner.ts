import {
  AdapterStepOutputSchema,
  type AdapterTelemetry,
  type Disposition,
  type ReplayCase,
  type TopicState,
} from './schema.js'
import type { ReplayAdapter, ReplayState } from './adapters/types.js'
import { AdapterOperationalError } from './adapters/types.js'

export class ReplayInvariantError extends Error {
  constructor(
    public readonly code: string,
    public readonly caseId: string,
    public readonly messageKey: string,
  ) {
    super(`Replay invariant [${code}] in case ${caseId}, message ${messageKey}`)
    this.name = 'ReplayInvariantError'
  }
}

export class ReplayCaseOperationalError extends Error {
  constructor(
    public readonly code: string,
    public readonly caseId: string,
    public readonly stepTelemetry: AdapterTelemetry[],
  ) {
    super(`Replay case operational failure [${code}] in case ${caseId}`)
    this.name = 'ReplayCaseOperationalError'
  }
}

export interface ReplayCaseResult {
  caseId: string
  dispositions: Record<string, Disposition>
  topics: TopicState[]
  promotions: Array<{
    originMessageKey: string
    triggerMessageKey: string
    topicKey: string
  }>
  summaries: Record<string, string>
  stepTelemetry: AdapterTelemetry[]
  telemetry: {
    attempts: number
    retries: number
    terminalFailures: number
    latencyMs: number
  }
}

export async function runReplayCase(
  replayCase: ReplayCase,
  adapter: ReplayAdapter,
): Promise<ReplayCaseResult> {
  const state: ReplayState = {
    dispositions: {},
    topics: [],
    promotedMessageKeys: [],
  }
  const promotions: ReplayCaseResult['promotions'] = []
  const summaries: Record<string, string> = {}
  const stepTelemetry: AdapterTelemetry[] = []

  for (const [messageIndex, message] of replayCase.messages.entries()) {
    let rawOutput: unknown
    try {
      rawOutput = await adapter.classifyStep({
        replayCase,
        message,
        messageIndex,
        priorMessages: replayCase.messages.slice(0, messageIndex),
        state: structuredClone(state),
      })
    } catch (error) {
      if (!(error instanceof AdapterOperationalError)) throw error
      const failedTelemetry: AdapterTelemetry = error.telemetry ?? {
        attempts: 1,
        retries: 0,
        terminalFailure: true,
        latencyMs: 0,
      }
      throw new ReplayCaseOperationalError(
        error.code,
        replayCase.id,
        [...stepTelemetry, failedTelemetry],
      )
    }
    const parsed = AdapterStepOutputSchema.safeParse(rawOutput)
    if (!parsed.success || parsed.data.messageKey !== message.key) {
      throw new ReplayInvariantError('invalid_adapter_output', replayCase.id, message.key)
    }
    const output = parsed.data

    validateTopicUpdates(
      replayCase,
      message.key,
      state,
      output.disposition,
      output.topicUpdates,
    )
    validatePromotions(replayCase, message.key, state, output.topicUpdates, output.promotionEvents)
    if (output.telemetry.terminalFailure) {
      throw new ReplayCaseOperationalError(
        'adapter_terminal_failure',
        replayCase.id,
        [...stepTelemetry, output.telemetry],
      )
    }

    state.dispositions[message.key] = output.disposition
    state.topics = structuredClone(output.topicUpdates)
    for (const event of output.promotionEvents) {
      state.promotedMessageKeys.push(event.originMessageKey)
      promotions.push(event)
    }
    if (output.summaryText) {
      const summaryTopic = output.topicUpdates.find(topic =>
        topic.messageKeys.includes(message.key))
      if (!summaryTopic) {
        throw new ReplayInvariantError('summary_topic_missing', replayCase.id, message.key)
      }
      summaries[summaryTopic.topicKey] = output.summaryText
    }
    stepTelemetry.push(output.telemetry)
  }

  return {
    caseId: replayCase.id,
    dispositions: state.dispositions,
    topics: state.topics,
    promotions,
    summaries,
    stepTelemetry,
    telemetry: {
      attempts: sum(stepTelemetry, 'attempts'),
      retries: sum(stepTelemetry, 'retries'),
      terminalFailures: stepTelemetry.filter(item => item.terminalFailure).length,
      latencyMs: sum(stepTelemetry, 'latencyMs'),
    },
  }
}

function validateTopicUpdates(
  replayCase: ReplayCase,
  currentMessageKey: string,
  state: ReplayState,
  disposition: Disposition,
  topics: TopicState[],
): void {
  const validMessageKeys = new Set([...Object.keys(state.dispositions), currentMessageKey])
  const memberships = new Set<string>()
  const topicKeys = new Set<string>()

  for (const topic of topics) {
    if (topicKeys.has(topic.topicKey)) {
      throw new ReplayInvariantError('duplicate_predicted_topic', replayCase.id, currentMessageKey)
    }
    if (new Set(topic.categories).size !== topic.categories.length) {
      throw new ReplayInvariantError('duplicate_category', replayCase.id, currentMessageKey)
    }
    for (const messageKey of topic.messageKeys) {
      if (!validMessageKeys.has(messageKey)) {
        throw new ReplayInvariantError('invalid_candidate_id', replayCase.id, currentMessageKey)
      }
      if (memberships.has(messageKey)) {
        throw new ReplayInvariantError('multiple_topic_membership', replayCase.id, currentMessageKey)
      }
      memberships.add(messageKey)
    }
    if (!topic.messageKeys.includes(topic.anchorMessageKey)) {
      throw new ReplayInvariantError('invalid_anchor', replayCase.id, currentMessageKey)
    }
    topicKeys.add(topic.topicKey)
  }

  const currentTopic = topics.find(topic => topic.messageKeys.includes(currentMessageKey))
  if (disposition === 'irrelevant' && currentTopic) {
    throw new ReplayInvariantError('irrelevant_message_has_topic', replayCase.id, currentMessageKey)
  }
  if (disposition !== 'irrelevant' && !currentTopic) {
    throw new ReplayInvariantError('supported_message_missing_topic', replayCase.id, currentMessageKey)
  }
  const priorTopicKeys = new Set(state.topics.map(topic => topic.topicKey))
  if (disposition === 'new_topic' && currentTopic && priorTopicKeys.has(currentTopic.topicKey)) {
    throw new ReplayInvariantError('new_topic_reused_existing_topic', replayCase.id, currentMessageKey)
  }
  if (disposition === 'attached' && currentTopic && !priorTopicKeys.has(currentTopic.topicKey)) {
    throw new ReplayInvariantError('attached_topic_does_not_exist', replayCase.id, currentMessageKey)
  }
  for (const priorTopic of state.topics) {
    const nextTopic = topics.find(topic => topic.topicKey === priorTopic.topicKey)
    if (!nextTopic || priorTopic.messageKeys.some(key => !nextTopic.messageKeys.includes(key))) {
      throw new ReplayInvariantError('topic_state_regressed', replayCase.id, currentMessageKey)
    }
  }
}

function validatePromotions(
  replayCase: ReplayCase,
  triggerMessageKey: string,
  state: ReplayState,
  topics: TopicState[],
  events: Array<{ originMessageKey: string; triggerMessageKey: string; topicKey: string }>,
): void {
  const topicKeys = new Set(topics.map(topic => topic.topicKey))
  const eventOrigins = new Set<string>()
  const promotedByEvent = new Set(events.map(event => event.originMessageKey))
  const priorMemberships = new Set(state.topics.flatMap(topic => topic.messageKeys))
  for (const topic of topics) {
    for (const messageKey of topic.messageKeys) {
      if (
        messageKey !== triggerMessageKey
        && !priorMemberships.has(messageKey)
        && state.dispositions[messageKey] === 'irrelevant'
        && !promotedByEvent.has(messageKey)
      ) {
        throw new ReplayInvariantError('promotion_event_missing', replayCase.id, triggerMessageKey)
      }
    }
  }
  for (const event of events) {
    if (event.triggerMessageKey !== triggerMessageKey) {
      throw new ReplayInvariantError('promotion_trigger_mismatch', replayCase.id, triggerMessageKey)
    }
    if (state.dispositions[event.originMessageKey] !== 'irrelevant') {
      throw new ReplayInvariantError('promotion_origin_not_irrelevant', replayCase.id, triggerMessageKey)
    }
    if (
      state.promotedMessageKeys.includes(event.originMessageKey)
      || eventOrigins.has(event.originMessageKey)
    ) {
      throw new ReplayInvariantError('duplicate_promotion', replayCase.id, triggerMessageKey)
    }
    const target = topics.find(topic => topic.topicKey === event.topicKey)
    if (
      !topicKeys.has(event.topicKey)
      || !target?.messageKeys.includes(event.originMessageKey)
      || !target.messageKeys.includes(triggerMessageKey)
    ) {
      throw new ReplayInvariantError('promotion_target_invalid', replayCase.id, triggerMessageKey)
    }
    eventOrigins.add(event.originMessageKey)
  }
}

function sum(items: AdapterTelemetry[], field: 'attempts' | 'retries' | 'latencyMs'): number {
  return items.reduce((total, item) => total + item[field], 0)
}
