import type { IRouter } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'
import { isBatchRunning } from '../classifier/index.js'
import { getActiveDistrict } from './route-helpers.js'

export function registerHealthRoutes(router: IRouter): void {
  router.get('/system-health', async (_req, res) => {
    try {
      const district = await getActiveDistrict()
      if (!district) {
        return res.status(503).json({ error: 'No active district' })
      }

      const dbStart = Date.now()
      let dbStatus: 'ok' | 'error' = 'ok'
      let dbLatencyMs: number | null = null
      try {
        await prisma.$queryRaw`SELECT 1`
        dbLatencyMs = Date.now() - dbStart
      } catch {
        dbStatus = 'error'
      }

      const mahallas = await prisma.mahalla.findMany({
        where:  { district_id: district.id },
        select: { id: true, name: true, bot_status: true, bot_last_seen_at: true },
      })

      const botConnectivity = mahallas.map(m => ({
        mahallaId:     m.id,
        mahallaName:   m.name,
        botStatus:     m.bot_status as 'active' | 'removed' | 'unknown',
        botLastSeenAt: m.bot_last_seen_at?.toISOString() ?? null,
      }))

      const hasActive = mahallas.some(m => m.bot_status === 'active')
      const botStatus: 'ok' | 'error' = hasActive ? 'ok' : 'error'

      return res.json({
        database:  { status: dbStatus, latencyMs: dbLatencyMs },
        scheduler: {
          status:           isBatchRunning() ? 'running' : 'stopped',
          nextRunInSeconds: null,
        },
        aiApi: {
          status:        'unknown',
          lastCheckedAt: null,
        },
        bot: { status: botStatus },
        botConnectivity,
      })
    } catch (err) {
      logger.error({ err }, 'Ops system-health query failed')
      return res.status(500).json({
        statusCode: 500,
        error:      'Internal Server Error',
        message:    'System health query failed',
      })
    }
  })
}
