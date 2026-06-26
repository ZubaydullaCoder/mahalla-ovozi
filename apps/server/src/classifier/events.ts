import type { RawMessage } from '../generated/prisma/client.js'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

export async function writeClassifierEvent(params: {
  eventType: 'classifier_signal' | 'classifier_ignore' | 'classifier_error'
  rawMessage: RawMessage
  signalId: number | null
  detail: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.pipelineEvent.create({
      data: {
        event_type:         params.eventType,
        district_id:        params.rawMessage.district_id,
        mahalla_id:         params.rawMessage.mahalla_id,
        telegram_update_id: params.rawMessage.telegram_update_id,
        raw_message_id:     params.rawMessage.id,
        signal_id:          params.signalId,
        detail: {
          telegramUpdateId:  params.rawMessage.telegram_update_id,
          telegramMessageId: params.rawMessage.telegram_message_id,
          rawMessageId:      params.rawMessage.id,
          signalId:          params.signalId,
          mahallaId:         params.rawMessage.mahalla_id,
          textSource:        params.rawMessage.text_source,
          textSnippet:       params.rawMessage.text.slice(0, 160),
          ...params.detail,
        },
      },
    })
  } catch (err) {
    logger.error(
      { rawMessageId: params.rawMessage.id, eventType: params.eventType, err },
      'classifier pipelineEvent.create failed',
    )
  }
}
