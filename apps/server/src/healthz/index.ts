// apps/server/src/healthz/index.ts
import { Router, type IRouter } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

export const healthzRouter: IRouter = Router()

healthzRouter.get('/healthz', (req, res) => {
  return res.json({ status: 'ok' })
})

healthzRouter.get('/readyz', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return res.json({
      status: 'ok',
      database: 'ok',
    })
  } catch (err) {
    logger.error({ err }, 'Readiness check failed')
    return res.status(503).json({
      status: 'error',
      database: 'error',
    })
  }
})
