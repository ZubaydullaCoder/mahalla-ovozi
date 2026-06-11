import express from 'express'
import morgan from 'morgan'
import cron from 'node-cron'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import webhookRouter from '../bot/webhook.js'
import { purgeOldSignals, runClassifyBatchWithLock } from '../classifier/index.js'

const app = express()

app.use(morgan('dev'))
app.use(webhookRouter)
app.use(express.json())

cron.schedule('*/20 * * * *', () => {
  runClassifyBatchWithLock('cron').catch((err: unknown) => {
    logger.error({ err }, 'Unhandled error in classify batch cron')
  })
})

cron.schedule('0 3 * * *', () => {
  purgeOldSignals().catch((err: unknown) => {
    logger.error({ err }, 'Unhandled error in retention purge cron')
  })
}, {
  timezone: 'UTC',
})

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started')
})
