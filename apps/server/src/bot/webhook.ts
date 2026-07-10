import { timingSafeEqual } from 'node:crypto'
import express, { Router, type IRouter, type RequestHandler } from 'express'
import { webhookCallback } from 'grammy'
import { env } from '../shared/env.js'
import { bot } from './index.js'

const router: IRouter = Router()
const TELEGRAM_WEBHOOK_JSON_LIMIT = '64kb'

function matchesSecretToken(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false

  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  if (providedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(providedBuffer, expectedBuffer)
}

export const validateTelegramWebhookSecret: RequestHandler = (req, res, next) => {
  if (!matchesSecretToken(req.header('X-Telegram-Bot-Api-Secret-Token'), env.TELEGRAM_WEBHOOK_SECRET)) {
    res.status(401).send('unauthorized')
    return
  }

  next()
}

router.post(
  '/webhook',
  validateTelegramWebhookSecret,
  express.json({ limit: TELEGRAM_WEBHOOK_JSON_LIMIT }),
  webhookCallback(bot, 'express', { secretToken: env.TELEGRAM_WEBHOOK_SECRET }),
)

export default router
