// apps/server/src/ops/simulator.ts

import type { Update } from 'grammy/types'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { pipeline } from '../bot/filters/pipeline.js'

// In-process counter for simulated telegram_update_id values.
// Real Telegram update IDs are always positive. Simulated ones use a
// descending negative sequence. Runtime simulation initializes the counter
// below the smallest existing simulated raw-message ID to avoid restart
// collisions.
let simulatedUpdateIdCounter = -1
let simulatedCounterInitialized = false
let simulatedCounterInitPromise: Promise<void> | null = null

export function nextSimulatedId(): number {
  return simulatedUpdateIdCounter--
}

export function resetSimulatedIdCounterForTest(startAt = -1): void {
  simulatedUpdateIdCounter = startAt
  simulatedCounterInitialized = false
  simulatedCounterInitPromise = null
}

async function initializeSimulatedIdCounter(): Promise<void> {
  if (simulatedCounterInitialized) {
    return
  }

  simulatedCounterInitPromise ??= (async () => {
    const existing = await prisma.rawMessage.findFirst({
      where:   { telegram_update_id: { lt: 0 } },
      orderBy: { telegram_update_id: 'asc' },
      select:  { telegram_update_id: true },
    })

    if (existing) {
      simulatedUpdateIdCounter = Math.min(simulatedUpdateIdCounter, existing.telegram_update_id - 1)
    }

    simulatedCounterInitialized = true
  })()

  await simulatedCounterInitPromise
}

async function reserveSimulatedId(): Promise<number> {
  await initializeSimulatedIdCounter()
  return nextSimulatedId()
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SimulateWebhookInput {
  mahallaId:           number
  senderDisplayName?:  string
  text:                string
  textSource?:         'text' | 'caption'
  simulatedTimestamp?: string // ISO 8601
}

export interface SimulateWebhookResult {
  decision:       'queued' | 'structural_discard' | 'keyword_skip'
  reason?:        string
  filterMode:     string
  keywordMatched: boolean
  matchedPhrase:  string | null
}

export interface SimulateMessageInput {
  mahallaId:           number
  senderDisplayName?:  string
  senderUsername?:     string
  text:                string
  textSource?:         'text' | 'caption'
  simulatedTimestamp?: string // ISO 8601
}

// ── Simulation functions ─────────────────────────────────────────────────────

export async function simulateWebhook(params: SimulateWebhookInput): Promise<SimulateWebhookResult> {
  const district = await prisma.district.findFirst({ where: { is_active: true } })
  if (!district) throw new Error('No active district')

  const mahalla = await prisma.mahalla.findUnique({
    where:  { id: params.mahallaId },
    select: { district_id: true, telegram_chat_id: true },
  })
  if (!mahalla || mahalla.district_id !== district.id) throw new Error('Mahalla not found in active district')

  const simId = await reserveSimulatedId()
  const textSource = params.textSource ?? 'text'
  const messageBase = {
    message_id: Math.abs(simId),
    chat:       {
      id:    Number(mahalla.telegram_chat_id),
      type:  'supergroup',
      title: 'Simulated mahalla',
    },
    from: {
      id:         999999,
      is_bot:     false,
      first_name: params.senderDisplayName ?? 'Test User',
    },
    date: params.simulatedTimestamp
      ? Math.floor(new Date(params.simulatedTimestamp).getTime() / 1000)
      : Math.floor(Date.now() / 1000),
  } satisfies Omit<NonNullable<Update['message']>, 'text' | 'caption'>

  const message: NonNullable<Update['message']> =
    textSource === 'caption'
      ? { ...messageBase, caption: params.text }
      : { ...messageBase, text: params.text }

  // Construct a minimal fake grammY Update that passes F0/F1/F2 automatically
  // (from is present, is_bot=false, message has text/caption)
  const fakeUpdate: Update = {
    update_id: simId,
    message,
  }

  // Run through the actual pipeline — F0/F1/F2/F3 filters execute.
  // pipeline() returns void; result is detected via pipeline_events table.
  await pipeline(fakeUpdate)

  // Read outcome from the pipeline_event created for this update_id.
  // pipeline.ts only writes events after mahalla resolution + keyword gate.
  // F0/F1/F2/F3/unmonitored-group discards return before writing any event.
  const event = await prisma.pipelineEvent.findFirst({
    where:   { telegram_update_id: simId },
    orderBy: { created_at: 'desc' },
    select:  { event_type: true, detail: true },
  })

  const eventType = event?.event_type ?? 'no_event'
  const detail    = (event?.detail ?? {}) as Record<string, unknown>

  const decision: SimulateWebhookResult['decision'] =
    eventType === 'keyword_skip'
      ? 'keyword_skip'
      : eventType === 'no_event' || eventType === 'prefilter_discard'
        ? 'structural_discard'
        : 'queued'

  logger.info({ mode: 'webhook', simId, decision }, 'Simulated webhook processed')

  return {
    decision,
    reason:
      typeof detail.reason === 'string'
        ? detail.reason
        : event
          ? undefined
          : 'No pipeline event was written; pipeline returned before DB-backed intake',
    filterMode:     typeof detail.filterMode === 'string' ? detail.filterMode : 'keyword_gate',
    keywordMatched: Boolean(detail.keywordMatched),
    matchedPhrase:  typeof detail.matchedPhrase === 'string' ? detail.matchedPhrase : null,
  }
}

export async function injectSimulatedMessage(params: SimulateMessageInput): Promise<number> {
  const district = await prisma.district.findFirst({ where: { is_active: true } })
  if (!district) throw new Error('No active district')

  const mahalla = await prisma.mahalla.findUnique({
    where:  { id: params.mahallaId },
    select: { district_id: true, telegram_chat_id: true },
  })
  if (!mahalla || mahalla.district_id !== district.id) throw new Error('Mahalla not found in active district')

  const simId = await reserveSimulatedId()

  const raw = await prisma.rawMessage.create({
    data: {
      telegram_update_id:  simId,
      telegram_message_id: simId,
      chat_id:             mahalla.telegram_chat_id,
      district_id:         mahalla.district_id,   // ALWAYS from DB — never from body
      mahalla_id:          params.mahallaId,
      sender_display_name: params.senderDisplayName ?? 'Test User',
      sender_username:     params.senderUsername ?? null,
      text:                params.text,
      text_source:         params.textSource ?? 'text',
      telegram_timestamp:  params.simulatedTimestamp
                             ? new Date(params.simulatedTimestamp)
                             : new Date(),
    },
  })

  logger.info({ rawMessageId: raw.id, mahallaId: params.mahallaId }, 'Simulated message seeded (Mode B)')
  return raw.id
}
