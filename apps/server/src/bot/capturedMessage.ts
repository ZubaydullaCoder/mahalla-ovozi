// apps/server/src/bot/capturedMessage.ts
//
// Persist helper: maps a structurally valid Telegram Update to a CapturedMessage row.
// Called after F0/F1/F2/F3 filters pass, before the keyword gate — unconditionally.
// Architecture §4: Telegram-source mapping and captured-message persistence belong in bot/.
import type { Update } from 'grammy/types'
import type { Mahalla } from '../generated/prisma/client.js'
import { prisma } from '../shared/db.js'

/**
 * Persists a structurally valid Telegram Update as a CapturedMessage.
 *
 * - Upsert on `telegram_update_id` is idempotent: duplicate calls are a no-op.
 * - Reply metadata pair enforced: both null or both non-null.
 * - `sender_display_name` truncated to 300 chars (schema VarChar(300)).
 * - `sender_username` truncated to 100 chars (schema VarChar(100)).
 * - `processing_state` starts as `queued`.
 */
export async function persistCapturedMessage(
  update: Update,
  mahalla: Mahalla,
): Promise<void> {
  const message = update.message!
  const from = message.from!

  // Reply metadata: must be both null or both non-null (DB constraint)
  const replyMsg = message.reply_to_message
  const replyToChatId    = replyMsg?.chat?.id    != null ? BigInt(replyMsg.chat.id) : null
  const replyToMessageId = replyMsg?.message_id  ?? null
  const replyPair =
    replyToChatId !== null && replyToMessageId !== null
      ? { reply_to_chat_id: replyToChatId, reply_to_message_id: replyToMessageId }
      : { reply_to_chat_id: null, reply_to_message_id: null }

  const senderDisplayName =
    [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 300) || null

  await prisma.capturedMessage.upsert({
    where:  { telegram_update_id: BigInt(update.update_id) },
    update: {}, // idempotent no-op on duplicate
    create: {
      telegram_update_id:  BigInt(update.update_id),
      telegram_chat_id:    BigInt(message.chat.id),
      telegram_message_id: message.message_id ?? null,
      ...replyPair,
      district_id:         mahalla.district_id,
      mahalla_id:          mahalla.id,
      sender_stable_id:    from.id ? BigInt(from.id) : null,
      sender_display_name: senderDisplayName,
      sender_username:     from.username?.slice(0, 100) ?? null,
      text:                message.text ?? message.caption ?? null,
      text_source:         message.text !== undefined ? 'text' : 'caption',
      telegram_timestamp:  new Date(message.date * 1000),
      processing_state:    'queued',
    },
  })
}
