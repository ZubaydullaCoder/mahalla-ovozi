// apps/server/src/health/index.ts
import { Router, type IRouter } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

export const healthRouter: IRouter = Router()

const DELAY_THRESHOLD_MS = 25 * 60 * 1000 // 25 minutes (inclusive → delayed)

healthRouter.get('/health', async (req, res) => {
  const districtId = req.session.districtId
  if (districtId === undefined) {
    return res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  try {
    // Run both queries in parallel — independent, no race
    const [latest, queueDepth] = await Promise.all([
      prisma.batchHealth.findFirst({
        where: {
          district_id: districtId,
          completed_at: { not: null },
        },
        orderBy: { completed_at: 'desc' },
        select: {
          completed_at:     true,
          status:           true,
          signals_written:  true,
          messages_fetched: true,
        },
      }),
      prisma.rawMessage.count({
        where: { district_id: districtId },
      }),
    ])

    const completedAt = latest?.completed_at ?? null
    const lastBatchAt = completedAt?.toISOString() ?? null

    // status derivation
    let status: 'current' | 'delayed' | 'no_data'
    if (completedAt === null) {
      status = 'no_data'
    } else {
      const ageMs = Date.now() - completedAt.getTime()
      status = ageMs >= DELAY_THRESHOLD_MS ? 'delayed' : 'current'
    }

    // lastBatchStatus mapping: 'ok' → 'success', 'failed' → 'failed', absent → null
    let lastBatchStatus: 'success' | 'failed' | null = null
    if (latest !== null) {
      lastBatchStatus = latest.status === 'ok' ? 'success' : 'failed'
    }

    return res.json({
      status,
      lastBatchAt,
      lastBatchStatus,
      messagesProcessed: latest?.messages_fetched ?? null,
      signalsWritten:    latest?.signals_written ?? null,
      queueDepth,
    })
  } catch (err) {
    logger.error({ err, districtId }, 'Health endpoint query failed')
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Health check failed',
    })
  }
})
