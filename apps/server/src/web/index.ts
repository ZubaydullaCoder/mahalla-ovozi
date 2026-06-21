import express from 'express'
import morgan from 'morgan'
import cron from 'node-cron'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { Pool } from 'pg'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import webhookRouter from '../bot/webhook.js'
import { prisma } from '../shared/db.js'
import { purgeOldSignals, runClassifyBatchWithLock } from '../classifier/index.js'
import { authRouter, requireAuth } from '../auth/index.js'
import { signalsRouter } from '../signals/index.js'
import { healthRouter } from '../health/index.js'
import { opsRouter } from '../ops/index.js'

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
app.use('/api/ops', opsRouter)     // ops guard replaces auth; must be BEFORE requireAuth

// All /api/* routes below this point require a valid session
app.use('/api', requireAuth)

app.use('/api', signalsRouter)
app.use('/api', healthRouter)

// TODO: Replace when dashboard mahalla filter route is implemented
app.get('/api/mahallas', async (req, res) => {
  try {
    const mahallas = await prisma.mahalla.findMany({
      where: { district_id: req.session.districtId },
      select: { id: true, district_id: true, name: true },
    })
    res.json(mahallas.map(m => ({
      id: m.id,
      districtId: m.district_id,
      name: m.name,
    })))
  } catch (err) {
    logger.error({ err, districtId: req.session.districtId }, 'Mahallas query failed')
    res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to load mahallas' })
  }
})

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
