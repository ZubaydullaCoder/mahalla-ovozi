import express from 'express'
import morgan from 'morgan'
import cron from 'node-cron'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { Pool } from 'pg'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import webhookRouter from '../bot/webhook.js'
import { purgeOldSignals, runClassifyBatchWithLock } from '../classifier/index.js'
import { authRouter } from '../auth/index.js'

const app = express()

const PgStore = connectPgSimple(session)
const pgPool = new Pool({ connectionString: env.DATABASE_URL })

app.use(morgan('dev'))
app.use(session({
  store: new PgStore({
    pool: pgPool,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  },
}))
app.use(express.json())
app.use(webhookRouter)
app.use('/api/auth', authRouter)

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

