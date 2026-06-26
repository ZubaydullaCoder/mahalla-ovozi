import type { RawMessage } from '../generated/prisma/client.js'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import type { ClassifierOutput } from './schema.js'
import { isPrismaRecordNotFoundError, isPrismaUniqueConstraintError } from './prisma-errors.js'

export type PersistSignalsResult = {
  signalsWritten: number
  lastSignalId: number | null
}

export async function persistSignals(
  rawMessage: RawMessage,
  aiResult: Extract<ClassifierOutput, { decision: 'signal' }>,
  categories: string[],
): Promise<PersistSignalsResult> {
  const baseSignalRow = {
    telegram_update_id:  rawMessage.telegram_update_id,
    telegram_message_id: rawMessage.telegram_message_id,
    district_id:         rawMessage.district_id,
    mahalla_id:          rawMessage.mahalla_id,
    sender_display_name: rawMessage.sender_display_name,
    sender_username:     rawMessage.sender_username,
    telegram_timestamp:  rawMessage.telegram_timestamp,
    raw_text:            rawMessage.text,
    text_source:         rawMessage.text_source,
    hokim_related:       aiResult.hokim_related ?? false,
    keyword_matched:     rawMessage.keyword_matched,
    matched_keyword:     rawMessage.matched_keyword,
    short_label:         aiResult.short_label ?? null,
    classified_at:       new Date(),
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existingSignals = await tx.signalMessage.findMany({
        where: {
          telegram_update_id: rawMessage.telegram_update_id,
          category: { in: categories },
        },
        select: { category: true, id: true },
      })

      const existingCategories = new Set(existingSignals.map((s) => s.category))
      let lastSignalId: number | null = existingSignals.length > 0 ? existingSignals[existingSignals.length - 1].id : null
      let signalsWritten = 0

      for (const category of categories) {
        if (!existingCategories.has(category)) {
          const created = await tx.signalMessage.create({
            data: {
              ...baseSignalRow,
              category,
            },
          })
          lastSignalId = created.id
          signalsWritten += 1
        }
      }

      try {
        await tx.rawMessage.delete({ where: { id: rawMessage.id } })
      } catch (err) {
        if (!isPrismaRecordNotFoundError(err)) {
          throw err
        }
        logger.info(
          { rawMessageId: rawMessage.id },
          'Raw message already deleted by concurrent process — idempotent',
        )
      }

      return { signalsWritten, lastSignalId }
    })
  } catch (err) {
    if (isPrismaUniqueConstraintError(err)) {
      logger.info(
        { rawMessageId: rawMessage.id, updateId: rawMessage.telegram_update_id },
        'Signal already exists for categories; deleting raw_message only',
      )
      try {
        await prisma.rawMessage.delete({ where: { id: rawMessage.id } })
      } catch (deleteErr) {
        if (!isPrismaRecordNotFoundError(deleteErr)) {
          throw deleteErr
        }
      }
      return { signalsWritten: 0, lastSignalId: null }
    }
    throw err
  }
}
