import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createFixtureOutputAdapter } from './topic-replay/adapters/fixture-output.js'
import { createProvisionalOllamaAdapter } from './topic-replay/adapters/provisional-ollama.js'
import type { ReplayAdapter } from './topic-replay/adapters/types.js'
import { AdapterOperationalError } from './topic-replay/adapters/types.js'
import { loadReplayJsonl, ReplayFixtureError } from './topic-replay/fixture-loader.js'
import {
  HarnessConfigError,
  parseHarnessConfig,
} from './topic-replay/harness-config.js'
import {
  buildEvaluationReport,
  formatHumanSummary,
  type StepTelemetryInput,
  writeEvaluationReport,
} from './topic-replay/reporter.js'
import {
  ReplayCaseOperationalError,
  ReplayInvariantError,
  runReplayCase,
  type ReplayCaseResult,
} from './topic-replay/runner.js'
import { scoreReplayCase, type ReplayScore } from './topic-replay/scorer.js'
import type { ReplayCase } from './topic-replay/schema.js'

export interface EvaluationExecution {
  scores: ReplayScore[]
  results: ReplayCaseResult[]
  failures: Array<{ caseId: string; code: string }>
  telemetry: StepTelemetryInput[]
  exitCode: 0 | 1
}

export async function runEvaluation(
  cases: ReplayCase[],
  adapterForCase: (replayCase: ReplayCase) => ReplayAdapter,
): Promise<EvaluationExecution> {
  const scores: ReplayScore[] = []
  const results: ReplayCaseResult[] = []
  const failures: EvaluationExecution['failures'] = []
  const telemetry: StepTelemetryInput[] = []

  for (const replayCase of cases) {
    try {
      const result = await runReplayCase(replayCase, adapterForCase(replayCase))
      results.push(result)
      telemetry.push(...result.stepTelemetry.map(item => ({
        caseId: replayCase.id,
        ...item,
      })))
      scores.push(scoreReplayCase(replayCase, result))
    } catch (error) {
      if (!(error instanceof ReplayCaseOperationalError)) throw error
      telemetry.push(...error.stepTelemetry.map(item => ({
        caseId: replayCase.id,
        ...item,
      })))
      failures.push({
        caseId: replayCase.id,
        code: getSafeErrorCode(error),
      })
    }
  }

  return {
    scores,
    results,
    failures,
    telemetry,
    exitCode: failures.length > 0 ? 1 : 0,
  }
}

export interface EvaluationCliOptions {
  argv: string[]
  environment: Record<string, string | undefined>
  stdout?: (value: string) => void
  stderr?: (value: string) => void
  now?: () => Date
}

export interface EvaluationCliResult {
  exitCode: 0 | 1
  reportPath?: string
}

export async function runEvaluationCli(options: EvaluationCliOptions): Promise<EvaluationCliResult> {
  const stdout = options.stdout ?? console.log
  const stderr = options.stderr ?? console.error
  const now = options.now ?? (() => new Date())

  try {
    const config = parseHarnessConfig(options.argv, options.environment)
    const fixturePath = path.resolve(readFlag(options.argv, '--fixture')
      ?? 'eval/fixtures/topic-replay.example.jsonl')
    const resultsDirectory = path.resolve(readFlag(options.argv, '--results-dir')
      ?? 'eval/results')
    const cases = loadReplayJsonl(fs.readFileSync(fixturePath, 'utf8'))
    const startedAt = now().toISOString()
    const beforeCpu = process.cpuUsage()
    const sharedAdapter = config.mode === 'provisional'
      ? createProvisionalOllamaAdapter(config.ollama)
      : undefined
    let provenance: Record<string, unknown> = config.mode === 'deterministic'
      ? {
          adapter: 'fixture_output',
          concurrency: 1,
          warmColdPolicy: 'not_applicable',
        }
      : {
          adapter: 'provisional_ollama',
          model: config.ollama.model,
          concurrency: 1,
          warmColdPolicy: 'load_duration_gt_zero_is_cold',
        }
    const runFailures: Array<{ code: string }> = []
    if (sharedAdapter?.getProvenance) {
      try {
        provenance = await sharedAdapter.getProvenance()
      } catch (error) {
        runFailures.push({ code: getSafeErrorCode(error) })
      }
    }

    const execution = runFailures.length === 0
      ? await runEvaluation(cases, replayCase =>
          sharedAdapter ?? createFixtureOutputAdapter(replayCase))
      : {
          scores: [],
          results: [],
          failures: [],
          telemetry: [],
          exitCode: 1 as const,
        }
    const afterCpu = process.cpuUsage(beforeCpu)
    const finishedAt = now().toISOString()
    const report = buildEvaluationReport({
      mode: config.mode,
      authorityLabel: config.mode === 'provisional'
        ? 'provisional_pre_triage'
        : 'deterministic_fixture',
      fixtureVersion: 'topic-replay-v1',
      schemaVersion: 'topic-replay-v1',
      promptVersion: config.mode === 'provisional'
        ? 'provisional-sequential-prefix-v1'
        : 'fixture-output-v1',
      startedAt,
      finishedAt,
      fixtureCaseCount: cases.length,
      caseScores: execution.scores.map(score => ({
        caseId: score.caseId,
        metrics: { ...score.metrics },
        alignment: score.alignment,
        unmatchedExpectedTopicKeys: score.unmatchedExpectedTopicKeys,
        unmatchedPredictedTopicKeys: score.unmatchedPredictedTopicKeys,
        summaryOutcomes: score.summaryOutcomes,
      })),
      telemetry: execution.telemetry,
      caseFailures: execution.failures,
      runFailures,
      provenance,
      hostSamples: {
        cpuUserMicros: afterCpu.user,
        cpuSystemMicros: afterCpu.system,
        memoryRssBytes: process.memoryUsage().rss,
      },
    })
    const reportPath = writeEvaluationReport(report, resultsDirectory)
    stdout(formatHumanSummary(report))
    stdout(`Report: ${reportPath}`)
    return {
      exitCode: runFailures.length > 0 || execution.failures.length > 0 ? 1 : 0,
      reportPath,
    }
  } catch (error) {
    stderr(`Contextual Topic Replay aborted [${getSafeErrorCode(error)}]`)
    return { exitCode: 1 }
  }
}

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  if (index === -1) return undefined
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new HarnessConfigError(`missing_${name.slice(2).replaceAll('-', '_')}_value`)
  }
  return value
}

function getSafeErrorCode(error: unknown): string {
  if (
    error instanceof ReplayFixtureError
    || error instanceof HarnessConfigError
    || error instanceof ReplayInvariantError
    || error instanceof ReplayCaseOperationalError
    || error instanceof AdapterOperationalError
  ) {
    return SAFE_ERROR_CODES.has(error.code) ? error.code : 'harness_failure'
  }
  return 'harness_failure'
}

const SAFE_ERROR_CODES = new Set([
  'adapter_terminal_failure',
  'attached_topic_does_not_exist',
  'broken_anchor_reference',
  'broken_promotion_reference',
  'broken_reply_reference',
  'broken_topic_reference',
  'domain_invalid_output',
  'duplicate_case_id',
  'duplicate_category',
  'duplicate_message_id',
  'duplicate_predicted_topic',
  'duplicate_promotion',
  'duplicate_topic_id',
  'empty_fixture',
  'empty_model_content',
  'harness_failure',
  'incomplete_adapter_script',
  'incomplete_expected_dispositions',
  'invalid_adapter_output',
  'invalid_adapter_promotion',
  'invalid_adapter_step_reference',
  'invalid_adapter_topic_reference',
  'invalid_anchor',
  'invalid_candidate_id',
  'invalid_hokim_truth',
  'invalid_json',
  'invalid_message_text',
  'invalid_metric_eligibility',
  'invalid_mode',
  'invalid_model_json',
  'invalid_ollama_model',
  'invalid_ollama_url',
  'invalid_promotion',
  'invalid_promotion_order',
  'invalid_resident_count_truth',
  'invalid_response_json',
  'invalid_schema',
  'invalid_summary_assertion',
  'invalid_summary_pattern',
  'irrelevant_message_has_topic',
  'missing_event_eligibility',
  'missing_fixture_value',
  'missing_mode_value',
  'missing_results_dir_value',
  'multiple_topic_membership',
  'new_topic_reused_existing_topic',
  'nonchronological_messages',
  'provider_http_error',
  'provider_metadata_error',
  'provider_metadata_invalid',
  'provider_network_error',
  'provider_timeout',
  'promotion_event_missing',
  'promotion_origin_not_irrelevant',
  'promotion_target_invalid',
  'promotion_trigger_mismatch',
  'schema_invalid_output',
  'summary_topic_missing',
  'supported_message_missing_topic',
  'topic_state_regressed',
  'unsafe_summary_pattern',
  'unsupported_category',
  ...[
    'EVAL_OLLAMA_URL',
    'EVAL_OLLAMA_MODEL',
    'EVAL_TIMEOUT_MS',
    'EVAL_SEED',
    'EVAL_TEMPERATURE',
    'EVAL_NUM_CTX',
    'EVAL_NUM_PREDICT',
    'EVAL_KEEP_ALIVE',
    'EVAL_THINK',
  ].flatMap(key => [
    `missing_${key.toLocaleLowerCase('en-US')}`,
    `invalid_${key.toLocaleLowerCase('en-US')}`,
  ]),
])

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const result = await runEvaluationCli({
    argv: process.argv.slice(2),
    environment: process.env,
  })
  process.exitCode = result.exitCode
}
