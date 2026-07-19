import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildEvaluationReport, formatHumanSummary, writeEvaluationReport } from './reporter.js'

const tempDirectories: string[] = []

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('privacy-safe reporting', () => {
  it('writes IDs, aggregates, provenance, and sourced telemetry without sensitive payloads', () => {
    const canaries = [
      'PRIVATE_FIXTURE_TEXT',
      'PRIVATE_PROMPT',
      'PRIVATE_SENDER',
      'PRIVATE_PROVIDER_RESPONSE',
    ]
    const report = buildEvaluationReport({
      mode: 'deterministic',
      authorityLabel: 'deterministic_fixture',
      fixtureVersion: 'topic-replay-v1',
      schemaVersion: 'topic-replay-v1',
      promptVersion: 'fixture-output-v1',
      startedAt: '2026-07-18T10:00:00.000Z',
      finishedAt: '2026-07-18T10:00:01.000Z',
      caseScores: [{
        caseId: 'safe-case-id',
        metrics: {
          supportedSignalRecall: {
            numerator: 1,
            denominator: 1,
            value: 1,
            status: 'available',
          },
        },
        alignment: [],
        unmatchedExpectedTopicKeys: [],
        unmatchedPredictedTopicKeys: [],
        summaryOutcomes: [{
          property: 'uncertainty',
          operator: 'manual_review',
          status: 'manual_review',
          expectedTopicKey: 't1',
          predictedTopicKey: 'p1',
        }],
      }],
      telemetry: [{
        caseId: 'safe-case-id',
        attempts: 1,
        retries: 0,
        terminalFailure: false,
        latencyMs: 20,
        loadDurationNs: 5,
        promptCharacters: 100,
        inputTokens: 10,
        outputTokens: 5,
        totalDurationNs: 100,
        promptEvalDurationNs: 30,
        evalDurationNs: 40,
      }],
      fixtureCaseCount: 2,
      caseFailures: [{
        caseId: 'failed-case-id',
        code: 'provider_http_error',
      }],
      runFailures: [],
      provenance: {
        adapter: 'fixture_output',
        ignoredSensitiveCanaries: canaries,
        modelDetails: {
          family: 'gemma4',
          template: 'PRIVATE_PROVIDER_RESPONSE',
        },
        runtimeOptions: {
          seed: 7,
          running: 'PRIVATE_PROVIDER_RESPONSE',
        },
      },
      hostSamples: {
        cpuUserMicros: 10,
        cpuSystemMicros: 5,
        memoryRssBytes: 1024,
      },
    })
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-replay-'))
    tempDirectories.push(directory)
    const filePath = writeEvaluationReport(report, directory)
    const structured = fs.readFileSync(filePath, 'utf8')
    const human = formatHumanSummary(report)
    const combined = `${filePath}\n${structured}\n${human}`

    for (const canary of canaries) {
      expect(combined).not.toContain(canary)
    }
    expect(report.telemetry.latencyMs).toMatchObject({
      source: 'adapter_call',
      availability: 'available',
      p50: 20,
    })
    expect(report.telemetry.cpu).toMatchObject({
      source: 'harness_process',
      availability: 'available',
    })
    expect(report.telemetry.coldLatencyMs.count).toBe(1)
    expect(report.telemetry.totalDurationNs).toMatchObject({
      source: 'ollama_native',
      count: 1,
      p50: 100,
    })
    expect(report.cases[0]?.summaryOutcomes[0]).toMatchObject({
      property: 'uncertainty',
      status: 'manual_review',
    })
    expect(report.aggregates).toMatchObject({
      caseCount: 2,
      failedCaseCount: 1,
      manualReviewAssertions: 1,
    })
    expect(filePath).toMatch(/contextual-topic-replay-\d{8}T\d{6}\d{3}Z\.json$/u)
    expect(human).toContain('Contextual Topic Replay')
    expect(human).toContain('safe-case-id')
  })

  it('does not overwrite reports that finish in the same millisecond', () => {
    const report = buildEvaluationReport({
      mode: 'deterministic',
      authorityLabel: 'deterministic_fixture',
      fixtureVersion: 'topic-replay-v1',
      schemaVersion: 'topic-replay-v1',
      promptVersion: 'fixture-output-v1',
      startedAt: '2026-07-18T10:00:00.000Z',
      finishedAt: '2026-07-18T10:00:01.000Z',
      fixtureCaseCount: 0,
      caseScores: [],
      telemetry: [],
      caseFailures: [],
      runFailures: [],
      provenance: { adapter: 'fixture_output' },
      hostSamples: {
        cpuUserMicros: 0,
        cpuSystemMicros: 0,
        memoryRssBytes: 0,
      },
    })
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-replay-collision-'))
    tempDirectories.push(directory)

    const first = writeEvaluationReport(report, directory)
    const second = writeEvaluationReport(report, directory)

    expect(second).not.toBe(first)
    expect(path.basename(second)).toMatch(/-1\.json$/u)
    expect(fs.existsSync(first)).toBe(true)
    expect(fs.existsSync(second)).toBe(true)
  })
})
