// apps/server/src/shared/types.ts
// All API response shape types. DB snake_case rows are mapped to these in signals/mapper.ts

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
