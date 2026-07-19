import type {
  AdapterStepOutput,
  Disposition,
  ReplayCase,
  ReplayMessage,
  TopicState,
} from '../schema.js'

export interface ReplayState {
  dispositions: Record<string, Disposition>
  topics: TopicState[]
  promotedMessageKeys: string[]
}

export interface ReplayAdapterInput {
  replayCase: ReplayCase
  message: ReplayMessage
  messageIndex: number
  priorMessages: ReplayMessage[]
  state: ReplayState
}

export interface ReplayAdapter {
  readonly name: 'fixture_output' | 'provisional_ollama'
  readonly authorityLabel: 'deterministic_fixture' | 'provisional_pre_triage'
  classifyStep(input: ReplayAdapterInput): Promise<unknown>
  getProvenance?(): Promise<Record<string, unknown>>
}

export interface ValidatedReplayAdapter extends ReplayAdapter {
  classifyStep(input: ReplayAdapterInput): Promise<AdapterStepOutput>
}

export class AdapterOperationalError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly telemetry?: {
      attempts: number
      retries: number
      terminalFailure: true
      latencyMs: number
      promptCharacters?: number
    },
  ) {
    super(message)
    this.name = 'AdapterOperationalError'
  }
}
