// apps/server/src/signals/mapper.ts
import type { Prisma } from '../generated/prisma/client.js'
import type { Signal } from '../shared/types.js'

export type SignalMessageWithMahalla = Prisma.SignalMessageGetPayload<{
  include: { mahalla: { select: { name: true; telegram_chat_id: true } } }
}>

type SignalTextSource = Signal['textSource']
type SignalCategory = Signal['category']

/**
 * Builds the Telegram message URL for private supergroups.
 * Format: t.me/c/<internalChatId>/<messageId>
 * Supergroup chat_ids have the prefix -100 (e.g. -1001234567890).
 * Strip -100 to get the internal chat ID: 1234567890.
 * Returns null if chatId or messageId are unavailable or don't match the supergroup pattern.
 */
export function buildTelegramMessageUrl(
  chatId: bigint | null,
  messageId: number | null,
): string | null {
  if (chatId === null || messageId === null) return null
  const chatStr = String(chatId)
  if (!chatStr.startsWith('-100')) return null
  const internalId = chatStr.slice(4) // strip '-100'
  if (!internalId) return null
  return `https://t.me/c/${internalId}/${messageId}`
}

function toSignalTextSource(value: string): SignalTextSource {
  if (value === 'text' || value === 'caption') {
    return value
  }
  throw new Error(`Invalid signal text_source: ${value}`)
}

function toSignalCategory(value: string): SignalCategory {
  if (value === 'water' || value === 'electricity' || value === 'gas' || value === 'waste') {
    return value
  }
  throw new Error(`Invalid signal category: ${value}`)
}

export function mapSignalRow(row: SignalMessageWithMahalla): Signal {
  return {
    id:                 row.id,
    telegramUpdateId:   row.telegram_update_id,
    telegramMessageId:  row.telegram_message_id,
    telegramMessageUrl: buildTelegramMessageUrl(
      row.mahalla.telegram_chat_id,
      row.telegram_message_id,
    ),
    districtId:         row.district_id,
    mahallaId:          row.mahalla_id,
    mahallaName:        row.mahalla.name,
    senderDisplayName:  row.sender_display_name ?? null,
    senderUsername:     row.sender_username ?? null,
    telegramTimestamp:  row.telegram_timestamp.toISOString(),
    rawText:            row.raw_text,
    textSource:         toSignalTextSource(row.text_source),
    category:           toSignalCategory(row.category),
    hokimRelated:       row.hokim_related,
    keywordMatched:     row.keyword_matched,
    matchedKeyword:     row.matched_keyword ?? null,
    shortLabel:         row.short_label ?? null,
    classifiedAt:       row.classified_at.toISOString(),
  }
}
