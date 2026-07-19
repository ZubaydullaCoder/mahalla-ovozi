import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadReplayJsonl } from './topic-replay/fixture-loader.js'
import { runEvaluation, runEvaluationCli } from './run-classifier-eval.js'
import { AdapterOperationalError, type ReplayAdapter } from './topic-replay/adapters/types.js'

const tempDirectories: string[] = []

afterEach(() => {
  vi.unstubAllGlobals()
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('contextual replay CLI', () => {
  it('runs deterministic fixtures without network or application secrets and exits zero on quality', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-replay-cli-'))
    tempDirectories.push(directory)
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('network must not be used')
    }))
    const stdout: string[] = []

    const result = await runEvaluationCli({
      argv: [
        '--mode', 'deterministic',
        '--fixture', path.resolve('eval/fixtures/topic-replay.example.jsonl'),
        '--results-dir', directory,
      ],
      environment: {},
      stdout: value => stdout.push(value),
      stderr: value => stdout.push(value),
    })

    expect(result.exitCode).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
    expect(stdout.join('\n')).toContain('Contextual Topic Replay')
    expect(stdout.join('\n')).toContain('deterministic_fixture')
    expect(result.reportPath).toBeDefined()
    const report = fs.readFileSync(result.reportPath!, 'utf8')
    expect(report).not.toContain('Тест:')
    expect(report).not.toContain('resident-')
  })

  it('continues safe cases after a case-local provider failure and returns non-zero', async () => {
    const cases = loadReplayJsonl(fs.readFileSync(
      path.resolve('eval/fixtures/topic-replay.example.jsonl'),
      'utf8',
    )).slice(0, 2)
    const visited: string[] = []
    const adapter: ReplayAdapter = {
      name: 'provisional_ollama',
      authorityLabel: 'provisional_pre_triage',
      async classifyStep(input) {
        visited.push(input.replayCase.id)
        if (input.replayCase.id === cases[0]!.id) {
          throw new AdapterOperationalError('provider_http_error', 'safe failure')
        }
        return structuredClone(input.replayCase.adapterScript.steps[input.messageIndex])
      },
    }

    const result = await runEvaluation(cases, () => adapter)

    expect(visited).toContain(cases[1]!.id)
    expect(result.failures).toEqual([{
      caseId: cases[0]!.id,
      code: 'provider_http_error',
    }])
    expect(result.telemetry[0]).toMatchObject({
      caseId: cases[0]!.id,
      attempts: 1,
      terminalFailure: true,
    })
    expect(result.telemetry.some(item =>
      item.caseId === cases[1]!.id && !item.terminalFailure)).toBe(true)
    expect(result.exitCode).toBe(1)
  })

  it('writes a safe report after provisional case failures, continues, then exits non-zero', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-replay-failure-'))
    tempDirectories.push(directory)
    let requestCount = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      requestCount += 1
      if (requestCount === 1) return jsonResponse({ version: '0.12.0' })
      if (requestCount === 2) {
        return jsonResponse({ models: [{ name: 'gemma4:12b', digest: 'safe-digest' }] })
      }
      if (requestCount === 3) return jsonResponse({ details: { family: 'gemma4' } })
      if (requestCount === 4) return jsonResponse({ models: [] })
      return new Response('', { status: 503 })
    }))
    const output: string[] = []

    const result = await runEvaluationCli({
      argv: [
        '--mode', 'provisional',
        '--fixture', path.resolve('eval/fixtures/topic-replay.example.jsonl'),
        '--results-dir', directory,
      ],
      environment: {
        EVAL_OLLAMA_URL: 'http://localhost:11434',
        EVAL_OLLAMA_MODEL: 'gemma4:12b',
        EVAL_TIMEOUT_MS: '1000',
        EVAL_SEED: '7',
        EVAL_TEMPERATURE: '0',
        EVAL_NUM_CTX: '8192',
        EVAL_NUM_PREDICT: '512',
        EVAL_KEEP_ALIVE: '5m',
        EVAL_THINK: 'false',
      },
      stdout: value => output.push(value),
      stderr: value => output.push(value),
    })

    expect(result.exitCode).toBe(1)
    expect(result.reportPath).toBeDefined()
    expect(requestCount).toBe(11)
    const report = fs.readFileSync(result.reportPath!, 'utf8')
    expect(report).toContain('provisional_pre_triage')
    expect(report).toContain('provider_http_error')
    expect(JSON.parse(report).aggregates).toMatchObject({
      attempts: 7,
      terminalFailures: 7,
      failedCaseCount: 7,
      caseCount: 7,
    })
    expect(`${report}\n${output.join('\n')}`).not.toContain('Тест:')
  })

  it('aborts immediately on a harness invariant instead of continuing cases', async () => {
    const cases = loadReplayJsonl(fs.readFileSync(
      path.resolve('eval/fixtures/topic-replay.example.jsonl'),
      'utf8',
    )).slice(0, 2)
    const visited: string[] = []
    const adapter: ReplayAdapter = {
      name: 'provisional_ollama',
      authorityLabel: 'provisional_pre_triage',
      async classifyStep(input) {
        visited.push(input.replayCase.id)
        return {}
      },
    }

    await expect(runEvaluation(cases, () => adapter)).rejects.toMatchObject({
      code: 'invalid_adapter_output',
    })
    expect(visited).toEqual([cases[0]!.id])
  })

  it('canonicalizes unapproved operational error codes before reporting', async () => {
    const cases = loadReplayJsonl(fs.readFileSync(
      path.resolve('eval/fixtures/topic-replay.example.jsonl'),
      'utf8',
    )).slice(0, 1)
    const adapter: ReplayAdapter = {
      name: 'provisional_ollama',
      authorityLabel: 'provisional_pre_triage',
      async classifyStep() {
        throw new AdapterOperationalError('private_fixture_text', 'safe message')
      },
    }

    const result = await runEvaluation(cases, () => adapter)

    expect(result.failures[0]?.code).toBe('harness_failure')
    expect(JSON.stringify(result)).not.toContain('private_fixture_text')
  })

  it('keeps metadata failures separate from fixture case counts and sends no fixture text', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-replay-metadata-'))
    tempDirectories.push(directory)
    let requestCount = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      requestCount += 1
      if (requestCount === 1) return jsonResponse({})
      if (requestCount === 2) return jsonResponse({ models: [] })
      if (requestCount === 3) return jsonResponse({ details: {} })
      return jsonResponse({ models: [] })
    }))

    const result = await runEvaluationCli({
      argv: [
        '--mode', 'provisional',
        '--fixture', path.resolve('eval/fixtures/topic-replay.example.jsonl'),
        '--results-dir', directory,
      ],
      environment: {
        EVAL_OLLAMA_URL: 'http://localhost:11434',
        EVAL_OLLAMA_MODEL: 'gemma4:12b',
        EVAL_TIMEOUT_MS: '1000',
        EVAL_SEED: '7',
        EVAL_TEMPERATURE: '0',
        EVAL_NUM_CTX: '8192',
        EVAL_NUM_PREDICT: '512',
        EVAL_KEEP_ALIVE: '5m',
        EVAL_THINK: 'false',
      },
      stdout: () => undefined,
      stderr: () => undefined,
    })

    expect(requestCount).toBe(4)
    expect(result.reportPath).toBeDefined()
    const report = JSON.parse(fs.readFileSync(result.reportPath!, 'utf8'))
    expect(report.aggregates).toMatchObject({
      caseCount: 7,
      measuredCaseCount: 0,
      failedCaseCount: 0,
      runFailureCount: 1,
    })
    expect(report.failures.run).toEqual([{ code: 'provider_metadata_invalid' }])
  })

  it('rejects missing path-flag values with a canonical configuration error', async () => {
    const output: string[] = []
    const result = await runEvaluationCli({
      argv: ['--fixture', '--mode', 'deterministic'],
      environment: {},
      stdout: value => output.push(value),
      stderr: value => output.push(value),
    })

    expect(result).toEqual({ exitCode: 1 })
    expect(output.join('\n')).toContain('missing_fixture_value')
  })
})

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
