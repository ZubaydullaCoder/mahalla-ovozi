import fs from 'node:fs'
import path from 'node:path'

import type { RateMetric, TopicAlignment } from './scorer.js'
import type { SummaryAssertionOutcome } from './summary-assertions.js'

type Mode = 'deterministic' | 'provisional'
type AuthorityLabel = 'deterministic_fixture' | 'provisional_pre_triage'

interface CaseScoreInput {
  caseId: string
  metrics: Record<string, RateMetric>
  alignment: TopicAlignment[]
  unmatchedExpectedTopicKeys: string[]
  unmatchedPredictedTopicKeys: string[]
  summaryOutcomes: Array<SummaryAssertionOutcome & {
    expectedTopicKey: string
    predictedTopicKey?: string
  }>
}

export interface StepTelemetryInput {
  caseId: string
  attempts: number
  retries: number
  terminalFailure: boolean
  latencyMs: number
  promptCharacters?: number
  inputTokens?: number
  outputTokens?: number
  totalDurationNs?: number
  loadDurationNs?: number
  promptEvalDurationNs?: number
  evalDurationNs?: number
}

interface FailureInput {
  caseId: string
  code: string
}

export interface EvaluationReportInput {
  mode: Mode
  authorityLabel: AuthorityLabel
  fixtureVersion: string
  schemaVersion: string
  promptVersion: string
  startedAt: string
  finishedAt: string
  fixtureCaseCount: number
  caseScores: CaseScoreInput[]
  telemetry: StepTelemetryInput[]
  caseFailures: FailureInput[]
  runFailures: Array<{ code: string }>
  provenance: Record<string, unknown>
  hostSamples: {
    cpuUserMicros: number
    cpuSystemMicros: number
    memoryRssBytes: number
  }
}

interface Distribution {
  source: string
  availability: 'available' | 'not_available'
  count: number
  min?: number
  p50?: number
  p95?: number
  max?: number
}

export interface EvaluationReport {
  reportVersion: 'contextual-topic-replay-report-v1'
  run: {
    mode: Mode
    authorityLabel: AuthorityLabel
    startedAt: string
    finishedAt: string
    fixtureVersion: string
    schemaVersion: string
    promptVersion: string
  }
  provenance: Record<string, unknown>
  cases: CaseScoreInput[]
  failures: {
    cases: FailureInput[]
    run: Array<{ code: string }>
  }
  aggregates: {
    caseCount: number
    measuredCaseCount: number
    failedCaseCount: number
    runFailureCount: number
    failureRate: number | null
    attempts: number
    retries: number
    terminalFailures: number
    schemaFailures: number
    throughputCasesPerSecond: number | null
    manualReviewAssertions: number
    unavailableAssertions: number
  }
  telemetry: {
    latencyMs: Distribution
    coldLatencyMs: Distribution
    warmLatencyMs: Distribution
    promptCharacters: Distribution
    inputTokens: Distribution
    outputTokens: Distribution
    totalDurationNs: Distribution
    loadDurationNs: Distribution
    promptEvalDurationNs: Distribution
    evalDurationNs: Distribution
    cpu: {
      source: 'harness_process'
      availability: 'available'
      userMicros: number
      systemMicros: number
    }
    memory: {
      source: 'harness_process'
      availability: 'available'
      rssBytes: number
    }
  }
}

export function buildEvaluationReport(input: EvaluationReportInput): EvaluationReport {
  const elapsedSeconds = (Date.parse(input.finishedAt) - Date.parse(input.startedAt)) / 1000
  const allowedProvenance = sanitizeProvenance(input.provenance)
  const ollamaSamples = input.telemetry.filter(item => item.loadDurationNs !== undefined)
  const cold = ollamaSamples.filter(item => (item.loadDurationNs ?? 0) > 0)
  const warm = ollamaSamples.filter(item => item.loadDurationNs === 0)
  const summaryOutcomes = input.caseScores.flatMap(score => score.summaryOutcomes)

  return {
    reportVersion: 'contextual-topic-replay-report-v1',
    run: {
      mode: input.mode,
      authorityLabel: input.authorityLabel,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      fixtureVersion: input.fixtureVersion,
      schemaVersion: input.schemaVersion,
      promptVersion: input.promptVersion,
    },
    provenance: allowedProvenance,
    cases: structuredClone(input.caseScores),
    failures: {
      cases: structuredClone(input.caseFailures),
      run: structuredClone(input.runFailures),
    },
    aggregates: {
      caseCount: input.fixtureCaseCount,
      measuredCaseCount: input.caseScores.length,
      failedCaseCount: input.caseFailures.length,
      runFailureCount: input.runFailures.length,
      failureRate: safeRate(input.caseFailures.length, input.fixtureCaseCount),
      attempts: sum(input.telemetry, 'attempts'),
      retries: sum(input.telemetry, 'retries'),
      terminalFailures: input.telemetry.filter(item => item.terminalFailure).length,
      schemaFailures: [
        ...input.caseFailures.map(failure => failure.code),
        ...input.runFailures.map(failure => failure.code),
      ].filter(code => code.includes('schema') || code === 'invalid_adapter_output').length,
      throughputCasesPerSecond: elapsedSeconds > 0
        ? input.fixtureCaseCount / elapsedSeconds
        : null,
      manualReviewAssertions: summaryOutcomes
        .filter(outcome => outcome.status === 'manual_review').length,
      unavailableAssertions: summaryOutcomes
        .filter(outcome => outcome.status === 'not_available').length,
    },
    telemetry: {
      latencyMs: distribution(input.telemetry.map(item => item.latencyMs), 'adapter_call'),
      coldLatencyMs: distribution(cold.map(item => item.latencyMs), 'ollama_load_duration'),
      warmLatencyMs: distribution(warm.map(item => item.latencyMs), 'ollama_load_duration'),
      promptCharacters: distribution(optionalValues(input.telemetry, 'promptCharacters'), 'adapter'),
      inputTokens: distribution(optionalValues(input.telemetry, 'inputTokens'), 'ollama_native'),
      outputTokens: distribution(optionalValues(input.telemetry, 'outputTokens'), 'ollama_native'),
      totalDurationNs: distribution(optionalValues(input.telemetry, 'totalDurationNs'), 'ollama_native'),
      loadDurationNs: distribution(optionalValues(input.telemetry, 'loadDurationNs'), 'ollama_native'),
      promptEvalDurationNs: distribution(
        optionalValues(input.telemetry, 'promptEvalDurationNs'),
        'ollama_native',
      ),
      evalDurationNs: distribution(optionalValues(input.telemetry, 'evalDurationNs'), 'ollama_native'),
      cpu: {
        source: 'harness_process',
        availability: 'available',
        userMicros: input.hostSamples.cpuUserMicros,
        systemMicros: input.hostSamples.cpuSystemMicros,
      },
      memory: {
        source: 'harness_process',
        availability: 'available',
        rssBytes: input.hostSamples.memoryRssBytes,
      },
    },
  }
}

export function writeEvaluationReport(report: EvaluationReport, directory: string): string {
  fs.mkdirSync(directory, { recursive: true })
  const timestamp = report.run.finishedAt.replaceAll('-', '').replaceAll(':', '').replace('.', '')
  const baseName = `contextual-topic-replay-${timestamp}`
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const fileName = suffix === 0 ? `${baseName}.json` : `${baseName}-${suffix}.json`
    const filePath = path.join(directory, fileName)
    try {
      const descriptor = fs.openSync(filePath, 'wx')
      try {
        fs.writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      } finally {
        fs.closeSync(descriptor)
      }
      return filePath
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error
    }
  }
  throw new Error('Unable to allocate a unique evaluation report filename')
}

export function formatHumanSummary(report: EvaluationReport): string {
  const caseLines = report.cases.map(item => `- ${item.caseId}: measured`)
  const failureLines = report.failures.cases
    .map(item => `- ${item.caseId}: operational failure (${item.code})`)
  const runFailureLines = report.failures.run
    .map(item => `- run: operational failure (${item.code})`)
  return [
    'Contextual Topic Replay',
    `Mode: ${report.run.mode}`,
    `Authority: ${report.run.authorityLabel}`,
    `Cases: ${report.aggregates.caseCount}`,
    `Operational failures: ${report.aggregates.failedCaseCount}`,
    `Run failures: ${report.aggregates.runFailureCount}`,
    `Manual-review assertions: ${report.aggregates.manualReviewAssertions}`,
    `Unavailable assertions: ${report.aggregates.unavailableAssertions}`,
    ...caseLines,
    ...failureLines,
    ...runFailureLines,
  ].join('\n')
}

function sanitizeProvenance(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (value.adapter === 'fixture_output' || value.adapter === 'provisional_ollama') {
    result.adapter = value.adapter
  }
  for (const key of ['ollamaVersion', 'model', 'modelDigest', 'warmColdPolicy'] as const) {
    if (typeof value[key] === 'string') result[key] = value[key]
  }
  if (typeof value.concurrency === 'number' && Number.isSafeInteger(value.concurrency)) {
    result.concurrency = value.concurrency
  }
  const modelDetails = sanitizeRecord(value.modelDetails, [
    'format',
    'family',
    'families',
    'parameterSize',
    'quantizationLevel',
    'capabilities',
  ])
  if (Object.keys(modelDetails).length > 0) result.modelDetails = modelDetails
  const runtimeOptions = sanitizeRecord(value.runtimeOptions, [
    'seed',
    'temperature',
    'numCtx',
    'numPredict',
    'think',
    'keepAlive',
    'loadedContextLength',
    'loadedSizeBytes',
    'loadedVramBytes',
  ])
  if (Object.keys(runtimeOptions).length > 0) result.runtimeOptions = runtimeOptions
  return result
}

function sanitizeRecord(value: unknown, allowedKeys: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return Object.fromEntries(allowedKeys.flatMap(key => {
    const item = record[key]
    if (
      typeof item === 'string'
      || typeof item === 'number'
      || typeof item === 'boolean'
      || (Array.isArray(item) && item.every(entry => typeof entry === 'string'))
    ) {
      return [[key, item]]
    }
    return []
  }))
}

function distribution(values: number[], source: string): Distribution {
  if (values.length === 0) {
    return { source, availability: 'not_available', count: 0 }
  }
  const sorted = [...values].sort((left, right) => left - right)
  return {
    source,
    availability: 'available',
    count: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1),
  }
}

function percentile(sorted: number[], quantile: number): number {
  return sorted[Math.ceil(quantile * sorted.length) - 1] ?? 0
}

function optionalValues(
  items: StepTelemetryInput[],
  field:
    | 'promptCharacters'
    | 'inputTokens'
    | 'outputTokens'
    | 'totalDurationNs'
    | 'loadDurationNs'
    | 'promptEvalDurationNs'
    | 'evalDurationNs',
): number[] {
  return items.map(item => item[field]).filter((value): value is number => value !== undefined)
}

function sum(items: StepTelemetryInput[], field: 'attempts' | 'retries'): number {
  return items.reduce((total, item) => total + item[field], 0)
}

function safeRate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'EEXIST'
}
