// packages/contracts/src/index.ts

// --- Auth DTOs ---
export interface LoginSuccessResponse {
  ok: true
}

export interface LogoutSuccessResponse {
  ok: true
}

export interface CurrentSessionResponse {
  authenticated: true
  userId:        number
  districtId:    number
}

export interface ApiErrorResponse {
  statusCode: number
  error: string
  message: string
}

// --- Main Application DTOs ---
export interface Signal {
  id:                 number
  telegramUpdateId:   number
  telegramMessageId:  number
  telegramMessageUrl: string | null
  districtId:         number
  mahallaId:          number
  mahallaName:        string
  senderDisplayName:  string | null
  senderUsername:     string | null
  telegramTimestamp:  string    // ISO 8601 UTC
  rawText:            string
  textSource:         'text' | 'caption'
  category:           'water' | 'electricity' | 'gas' | 'waste'
  hokimRelated:       boolean
  keywordMatched:     boolean
  matchedKeyword:     string | null
  shortLabel:         string | null
  aiSummary:          string | null
  classifiedAt:       string    // ISO 8601 UTC
}

export interface Mahalla {
  id:         number
  districtId: number
  name:       string
}

export interface Keyword {
  id:        number
  phrase:    string
  isActive:  boolean
  createdAt: string
  updatedAt: string
}

export interface BotConnectivity {
  mahallaId:    number
  mahallaName:  string
  botStatus:    'active' | 'removed' | 'unknown'
  botLastSeenAt: string | null
}

export interface HealthStatus {
  status:            'current' | 'delayed' | 'no_data'
  lastBatchAt:       string | null
  lastBatchStatus:   'success' | 'failed' | null
  messagesProcessed: number | null
  signalsWritten:    number | null
  queueDepth:        number
}

// --- Ops Console DTOs ---
export type OpsSignal = Signal

export interface RawMessageRow {
  id:                number
  mahallaId:         number
  mahallaName:       string
  text:              string
  textSource:        'text' | 'caption'
  keywordMatched:    boolean
  matchedKeyword:    string | null
  telegramTimestamp: string
  isSimulated:       boolean
}

export interface OpsSystemHealth {
  database:        { status: 'ok' | 'error'; latencyMs: number | null }
  scheduler:       { status: 'running' | 'stopped'; nextRunInSeconds: number | null }
  aiApi:           { status: 'ok' | 'error' | 'unknown'; lastCheckedAt: string | null }
  bot:             { status: 'ok' | 'error' }
  botConnectivity: Array<BotConnectivity>
}

export interface OpsSignalsFilters {
  category?:    'water' | 'electricity' | 'gas' | 'waste' | ''
  mahallaId?:   number | null
  hokimRelated?: boolean | null
}

export type OpsKeyword = Keyword

export interface PipelineEvent {
  id:               number
  eventType:        string
  districtId:       number
  mahallaId:        number | null
  telegramUpdateId: number | null
  rawMessageId:     number | null
  signalId:         number | null
  detail:           unknown
  createdAt:        string
}

export interface OpsMahalla {
  id:   number
  name: string
}

export interface SimulateWebhookBody {
  mahallaId:           number
  senderDisplayName?:  string
  text:                string
  textSource?:         'text' | 'caption'
  simulatedTimestamp?: string
}

export interface SimulateWebhookResult {
  decision:       'queued' | 'structural_discard' | 'keyword_skip'
  reason?:        string
  filterMode:     string
  keywordMatched: boolean
  matchedPhrase:  string | null
}

export interface SimulateMessageBody {
  mahallaId:           number
  senderDisplayName?:  string
  senderUsername?:     string
  text:                string
  textSource?:         'text' | 'caption'
  simulatedTimestamp?: string
}

export interface OpsBatchStatus {
  schedulerStatus: 'idle' | 'running'
  lastBatchAt: string | null
  lastBatchDuration: number | null
  queueDepth: number
  lastBatchResult: {
    filterMode: string
    messagesFetched: number
    signalsWritten: number
    ignoredCount: number
    preFilterDiscards: number
    keywordMatchedCount: number
    keywordSkippedCount: number
    keywordAiSignalCount: number
    keywordAiIgnoreCount: number
    noKeywordAiSignalCount: number
    noKeywordAiIgnoreCount: number
    errors: string | null
  } | null
  recentErrors: Array<{ message: string, occurredAt: string }>
}

export interface OpsStatus {
  isEnabled: boolean
  isForbidden: boolean
  data: OpsBatchStatus | null
}
