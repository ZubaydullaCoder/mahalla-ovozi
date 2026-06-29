import type { Update } from 'grammy/types'
import { logger } from '../../shared/logger.js'
import { prisma } from '../../shared/db.js'
import { env } from '../../shared/env.js'
import { matchesAnyKeyword } from '../../keywords/matcher.js'
import { getActiveKeywords } from '../../keywords/query.js'
import { triggerClassifierDrain } from '../../classifier/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// Exported filter predicates — individually testable pure functions
// ─────────────────────────────────────────────────────────────────────────────

/** F0 — returns true when message.from is missing (channel-post forward, etc.) */
export function hasMissingSender(update: Update): boolean {
  return update.message?.from === undefined
}

/** F1 — returns true when the sender is a bot (includes GroupAnonymousBot) */
export function isBot(update: Update): boolean {
  return update.message?.from?.is_bot === true
}

/** F2 — returns true when the message has neither text nor caption */
export function hasNoText(update: Update): boolean {
  return update.message?.text === undefined && update.message?.caption === undefined
}

/**
 * F3 — returns true when the text is trivial and should be discarded.
 * Rules (narrow — NO length threshold):
 *   • starts with '/'  → bot command
 *   • pure emoji       → no \w alphanumeric chars after trim
 *   • empty after trim → whitespace-only
 * Short civic texts like 'gaz?', 'suv?', 'tok?' PASS (they contain \w chars).
 */
export function isTrivialContent(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return true
  if (trimmed.startsWith('/')) return true
  // Pure emoji: matches only Extended_Pictographic/Emoji_Component/whitespace chars
  // with zero word-character (\w) chars. This correctly allows 'gaz?', '?', etc.
  if (/^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u.test(trimmed) && !/\w/u.test(trimmed)) {
    return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Main pipeline — only called for 'message' updates
// ─────────────────────────────────────────────────────────────────────────────

export async function pipeline(update: Update): Promise<void> {
  const updateId = update.update_id

  // F0 — missing sender (channel post forwarded into group)
  if (hasMissingSender(update)) {
    logger.warn({ updateId }, 'Pre-filter discard: missing sender (from undefined)')
    return
  }

  const from = update.message!.from!

  // F1 — bot sender (also catches GroupAnonymousBot)
  if (isBot(update)) {
    logger.info(
      { updateId, chatId: update.message!.chat.id.toString(), filter: 'F1' },
      'Pre-filter discard: bot sender',
    )
    return
  }

  // F2 — no text and no caption
  if (hasNoText(update)) {
    logger.info(
      { updateId, chatId: update.message!.chat.id.toString(), filter: 'F2' },
      'Pre-filter discard: no text or caption',
    )
    return
  }

  const rawText = update.message!.text ?? update.message!.caption!
  const text_source: 'text' | 'caption' = update.message!.text !== undefined ? 'text' : 'caption'

  // F3 — trivial content (bot command, pure emoji, empty-after-trim)
  if (isTrivialContent(rawText)) {
    logger.info(
      { updateId, chatId: update.message!.chat.id.toString(), filter: 'F3', text: rawText.slice(0, 50) },
      'Pre-filter discard: trivial content',
    )
    return
  }

  // ── After F0/F1/F2/F3 pass ──

  const chatId = BigInt(update.message!.chat.id)

  // Mahalla lookup — resolve district_id and mahalla_id
  const mahalla = await prisma.mahalla.findUnique({
    where: { telegram_chat_id: chatId },
  })

  if (!mahalla) {
    logger.warn(
      { updateId, chatId: chatId.toString() },
      'Pre-filter discard: unmonitored group (no mahalla match)',
    )
    return
  }

  const senderDisplayName =
    [from.first_name, from.last_name].filter(Boolean).join(' ') || null

  // ── Stage 2: Keyword-gate (AR4) ──
  // Load active keywords for this district, run matcher against message text.
  // districtId is ALWAYS from mahalla.district_id — never from request body (AC #5).
  let activeKeywords: Awaited<ReturnType<typeof getActiveKeywords>> = []
  let keywordLookupError: unknown = null
  try {
    activeKeywords = await getActiveKeywords(mahalla.district_id)
  } catch (err) {
    keywordLookupError = err
    logger.error(
      { updateId, mahallaId: mahalla.id, districtId: mahalla.district_id, err },
      'getActiveKeywords failed — message not written (keyword_gate fail-closed)',
    )
  }
  const matchResult = matchesAnyKeyword(rawText, activeKeywords)

  const filterMode = env.FILTER_MODE

  // Shared pipeline event detail fields (all three paths)
  const baseDetail = {
    telegramUpdateId:  update.update_id,
    telegramMessageId: update.message!.message_id,
    mahallaId:         mahalla.id,
    mahallaName:       mahalla.name,
    textSnippet:       rawText.slice(0, 160),
    filterMode,
    keywordMatched:    matchResult.matched,
    matchedPhrase:     matchResult.phrase,
  }

  // P3 patch: shared upsert helper — eliminates verbatim duplication across branches.
  const upsertRawMessage = () => prisma.rawMessage.upsert({
    where:  { telegram_update_id: update.update_id },
    update: {},
    create: {
      telegram_update_id:  update.update_id,
      telegram_message_id: update.message!.message_id,
      chat_id:             chatId,
      district_id:         mahalla.district_id,
      mahalla_id:          mahalla.id,
      sender_display_name: senderDisplayName,
      sender_username:     from.username ?? null,
      text:                rawText,
      text_source,
      keyword_matched:     matchResult.matched,
      matched_keyword:     matchResult.phrase,
      telegram_timestamp:  new Date(update.message!.date * 1000),
    },
  })

  // P2 patch: pipelineEvent.create failure isolation.
  const createPipelineEvent = async (data: Parameters<typeof prisma.pipelineEvent.create>[0]['data']) => {
    try {
      await prisma.pipelineEvent.create({ data })
    } catch (err) {
      logger.error({ updateId, eventType: data.event_type, err }, 'pipelineEvent.create failed')
    }
  }

  if (keywordLookupError) {
    await createPipelineEvent({
      event_type:         'keyword_skip',
      district_id:        mahalla.district_id,
      mahalla_id:         mahalla.id,
      telegram_update_id: update.update_id,
      raw_message_id:     null,
      detail: {
        ...baseDetail,
        keywordLookupFailed: true,
        reason:              'Keyword lookup failed; message not written in keyword_gate mode',
      },
    })

    logger.warn(
      {
        updateId,
        chatId:    chatId.toString(),
        mahallaId: mahalla.id,
        filterMode,
      },
      'Keyword lookup failed — message not written',
    )
    return
  } else if (matchResult.matched) {
    // keyword_gate + keyword match -> write to raw_messages, record keyword_match event
    const rawMessage = await upsertRawMessage()

    await createPipelineEvent({
      event_type:         'keyword_match',
      district_id:        mahalla.district_id,
      mahalla_id:         mahalla.id,
      telegram_update_id: update.update_id,
      raw_message_id:     rawMessage.id,
      detail:             baseDetail,
    })

    logger.info(
      {
        updateId,
        chatId:        chatId.toString(),
        mahallaId:     mahalla.id,
        filterMode,
        keywordMatched: true,
        matchedPhrase:  matchResult.phrase,
      },
      'Keyword match — message written to raw_messages',
    )

    if (env.CLASSIFIER_AUTO_TRIGGER_ENABLED) {
      void triggerClassifierDrain('webhook').catch((err: unknown) => {
        logger.error({ updateId, rawMessageId: rawMessage.id, err }, 'Webhook classifier drain trigger failed')
      })
    }
  } else {
    // keyword_gate + no match -> skip upsert, record keyword_skip event, return
    await createPipelineEvent({
      event_type:         'keyword_skip',
      district_id:        mahalla.district_id,
      mahalla_id:         mahalla.id,
      telegram_update_id: update.update_id,
      raw_message_id:     null,
      detail: {
        ...baseDetail,
        reason: 'No keyword match in keyword_gate mode',
      },
    })

    logger.info(
      {
        updateId,
        chatId:    chatId.toString(),
        mahallaId: mahalla.id,
        filterMode,
      },
      'Keyword skip — message not written (keyword_gate, no match)',
    )
    return
  }
}
