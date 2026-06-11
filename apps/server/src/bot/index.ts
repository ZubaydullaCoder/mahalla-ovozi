import { Bot } from 'grammy'
import { env } from '../shared/env.js'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { pipeline } from './filters/pipeline.js'

export const bot = new Bot(env.BOT_TOKEN)

type TelegramId = bigint | number | string
type BotMembershipStatus =
  | 'administrator'
  | 'creator'
  | 'kicked'
  | 'left'
  | 'member'
  | 'restricted'

export interface MyChatMemberContext {
  chat: { id: TelegramId }
  from?: { id?: TelegramId }
  myChatMember: {
    date: number
    new_chat_member: { status: BotMembershipStatus }
  }
}

export async function handleMyChatMember(ctx: MyChatMemberContext): Promise<void> {
  const chatId = BigInt(ctx.chat.id)
  const newStatus = ctx.myChatMember.new_chat_member.status
  const eventTimestamp = new Date(ctx.myChatMember.date * 1000)
  const logContext = {
    actorUserId: ctx.from?.id?.toString(),
    chatId:      chatId.toString(),
    newStatus,
  }

  const botStatus =
    newStatus === 'kicked' || newStatus === 'left'
      ? 'removed'
      : newStatus === 'member' || newStatus === 'administrator'
        ? 'active'
        : undefined

  if (botStatus === undefined) {
    logger.debug(logContext, 'Bot connectivity status ignored')
    return
  }

  try {
    const result = await prisma.mahalla.updateMany({
      where: { telegram_chat_id: chatId },
      data:  { bot_status: botStatus, bot_last_seen_at: eventTimestamp },
    })

    logger.info(
      { ...logContext, botStatus, matchedCount: result.count },
      'Bot connectivity status updated',
    )
  } catch (err) {
    logger.error(
      { ...logContext, botStatus, err },
      'Bot connectivity status update failed',
    )
  }
}

export function handleEditedMessage(ctx: {
  update: {
    update_id: number
    edited_message?: { chat: { id: TelegramId }; message_id: number }
  }
}): void {
  logger.info(
    {
      updateId:  ctx.update.update_id,
      chatId:    ctx.update.edited_message?.chat.id.toString(),
      messageId: ctx.update.edited_message?.message_id,
    },
    'Pre-filter discard: edited_message ignored',
  )
}

bot.on('message', async (ctx) => {
  await pipeline(ctx.update)
})

bot.on('edited_message', (ctx) => {
  handleEditedMessage(ctx)
})

bot.on('my_chat_member', handleMyChatMember)
