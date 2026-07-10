import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { Pool } from 'pg'
import { env } from '../shared/env.js'
import { logger } from '../shared/logger.js'
import webhookRouter from '../bot/webhook.js'
import { authRouter, requireAuth } from '../auth/index.js'
import { signalsRouter } from '../signals/index.js'
import { healthRouter } from '../health/index.js'
import { opsRouter } from '../ops/index.js'
import { mahallasRouter } from '../mahallas/index.js'
import { healthzRouter } from '../healthz/index.js'
import { getSessionCookieOptions } from '../auth/session-cookie.js'
import { registerScheduler, triggerStartupDrain } from './scheduler.js'

const app = express()

const PgStore = connectPgSimple(session)
const pgPool = new Pool({ connectionString: env.DATABASE_URL })

if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// Security headers — helmet must be first middleware so every response is covered.
// CSP is relaxed in development to avoid breaking Vite HMR websocket and eval.
app.use(
  helmet({
    contentSecurityPolicy:
      env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],  // Vite-bundled SPA inlines boot scripts
              styleSrc: ["'self'", "'unsafe-inline'"],   // Ant Design injects styles at runtime
              imgSrc: ["'self'", 'data:', 'https://t.me', 'https://cdn5.telesco.pe'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false, // disable CSP in development
    crossOriginEmbedderPolicy: false, // avoid breaking third-party resources during pilot
  }),
)

if (env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}
app.use(session({
  store: new PgStore({
    pool: pgPool,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: getSessionCookieOptions(),
}))
app.use(express.json({ limit: '10kb' }))
app.use(healthzRouter)
app.use(webhookRouter)
app.use('/api/auth', authRouter)
app.use('/api/ops', opsRouter)     // ops guard replaces auth; must be BEFORE requireAuth

// All /api/* routes below this point require a valid session
app.use('/api', requireAuth)

app.use('/api', signalsRouter)
app.use('/api', healthRouter)
app.use('/api', mahallasRouter)

registerScheduler()

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started')
  triggerStartupDrain()
})
